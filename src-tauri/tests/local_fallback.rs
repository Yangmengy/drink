use adk_session::InMemorySessionService;
use cocktail_app_lib::{
    agent::{parse_reply, Companion},
    db, menu,
    models::*,
    settings, trace,
};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::{collections::HashMap, sync::Arc};

async fn setup() -> (SqlitePool, Companion, tempfile::TempDir) {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    db::initialize(&pool).await.unwrap();
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    (pool, companion, tempfile::tempdir().unwrap())
}
fn query(availability: LocalAvailability) -> LocalRecommendationInput {
    LocalRecommendationInput {
        availability,
        query: MenuQuery {
            query: "本地测试".into(),
            max_sweet: Some(2),
            min_sour: Some(3),
            max_strong: Some(2),
        },
        after_trace_id: None,
    }
}
async fn add(pool: &SqlitePool, name: &str, sweet: i32, material: &str) -> String {
    menu::save_custom(
        pool,
        &RecipeInput {
            id: None,
            name: format!("本地测试{name}"),
            description: "确定的本地配方".into(),
            method: "直调".into(),
            flavor: Flavor {
                sweet,
                sour: 3,
                bitter: 1,
                strong: 2,
            },
            ingredients: vec![
                IngredientInput {
                    name: material.into(),
                    amount: 30.0,
                    unit: "ml".into(),
                    optional: false,
                },
                IngredientInput {
                    name: "可选装饰测试".into(),
                    amount: 1.0,
                    unit: "片".into(),
                    optional: true,
                },
            ],
            steps: vec!["加入材料搅拌".into()],
        },
    )
    .await
    .unwrap()
}

#[tokio::test]
async fn local_queries_apply_all_constraints_and_share_custom_menu_inventory() {
    let (pool, companion, dir) = setup().await;
    let ready = add(&pool, "清爽", 1, "本地测试原料甲").await;
    let missing = add(&pool, "另一杯", 2, "本地测试原料乙").await;
    let too_sweet = add(&pool, "甜酒", 5, "本地测试原料甲").await;
    let ingredient = menu::inventory(&pool)
        .await
        .unwrap()
        .into_iter()
        .find(|i| i.name == "本地测试原料甲")
        .unwrap();
    menu::set_inventory(&pool, &ingredient.id, true)
        .await
        .unwrap();
    let result = companion
        .recommend_local(dir.path(), &query(LocalAvailability::Ready))
        .await
        .unwrap();
    assert_eq!(result.message.mode, ReplyMode::Local);
    assert_eq!(result.message.recipes.len(), 1);
    assert_eq!(result.message.recipes[0].id, ready);
    assert!(result.message.recipes[0].can_make); // Missing optional garnish is ignored.
    assert!(result.request.contains("甜度≤2/5"));
    let result = companion
        .recommend_local(dir.path(), &query(LocalAvailability::MissingOne))
        .await
        .unwrap();
    assert_eq!(result.message.recipes.len(), 1);
    assert_eq!(result.message.recipes[0].id, missing);
    assert_eq!(result.message.recipes[0].missing, vec!["本地测试原料乙"]);
    assert!(!result.message.recipes.iter().any(|r| r.id == too_sweet));
    menu::delete_custom(&pool, &missing).await.unwrap();
    let result = companion
        .recommend_local(dir.path(), &query(LocalAvailability::MissingOne))
        .await
        .unwrap();
    assert!(result.message.recipes.is_empty());
    assert!(result.message.text.contains("保留了全部筛选条件"));
    let traces = trace::list(&pool).await.unwrap();
    assert!(traces
        .iter()
        .all(|t| t.status == "local" && !t.events.iter().any(|e| e.phase.starts_with("model."))));
    assert!(
        traces[0]
            .events
            .iter()
            .any(|e| e.phase == "fallback.result"
                && e.detail.contains("\"constraintsRelaxed\":false"))
    );
    assert_eq!(companion.history().await.unwrap()[1].mode, ReplyMode::Local);
}

#[tokio::test]
async fn empty_inventory_never_claims_makeable_and_results_are_capped() {
    let (pool, companion, dir) = setup().await;
    for n in 0..5 {
        add(&pool, &n.to_string(), 1, "本地测试原料甲").await;
    }
    let result = companion
        .recommend_local(dir.path(), &query(LocalAvailability::Ready))
        .await
        .unwrap();
    assert!(result.message.recipes.is_empty());
    let result = companion
        .recommend_local(dir.path(), &query(LocalAvailability::Any))
        .await
        .unwrap();
    assert_eq!(result.message.recipes.len(), 3);
    assert!(result
        .message
        .recipes
        .iter()
        .all(|r| !r.can_make && r.missing == vec!["本地测试原料甲"]));
    assert!(result.message.text.contains("找到 5 款"));
    let traces = trace::list(&pool).await.unwrap();
    let event = traces[0]
        .events
        .iter()
        .find(|e| e.phase == "fallback.result")
        .unwrap();
    for recipe in result.message.recipes {
        assert!(event.detail.contains(&recipe.id));
    }
}

#[tokio::test]
async fn invalid_constraints_and_database_failures_are_errors_not_fake_recommendations() {
    let (pool, companion, dir) = setup().await;
    let mut input = query(LocalAvailability::Ready);
    input.query.max_sweet = Some(9);
    assert!(companion.recommend_local(dir.path(), &input).await.is_err());
    input.query.max_sweet = Some(2);
    input.after_trace_id = Some("not-a-trace".into());
    assert!(companion.recommend_local(dir.path(), &input).await.is_err());
    sqlx::query("DROP TABLE user_inventory")
        .execute(&pool)
        .await
        .unwrap();
    assert!(companion
        .recommend_local(dir.path(), &query(LocalAvailability::Ready))
        .await
        .is_err());
    let traces = trace::list(&pool).await.unwrap();
    assert_eq!(traces.len(), 3);
    assert!(traces.iter().all(|t| t.status == "error"));
    sqlx::query("CREATE TABLE user_inventory(id TEXT,ingredient_id TEXT,added_at INTEGER,updated_at INTEGER)").execute(&pool).await.unwrap();
    assert!(companion.history().await.unwrap().is_empty());
}

#[tokio::test]
async fn empty_key_is_local_but_unreadable_key_and_invalid_messages_are_not_successes() {
    let (pool, companion, dir) = setup().await;
    std::fs::write(dir.path().join(".model-key"), "  \n").unwrap();
    assert_eq!(
        companion
            .reply_configured(dir.path(), "你好")
            .await
            .unwrap()
            .mode,
        ReplyMode::Local
    );
    assert!(companion.reply_configured(dir.path(), "   ").await.is_err());
    assert!(companion
        .reply_configured(dir.path(), &"字".repeat(4001))
        .await
        .is_err());
    std::fs::remove_file(dir.path().join(".model-key")).unwrap();
    std::fs::create_dir(dir.path().join(".model-key")).unwrap();
    assert!(companion
        .reply_configured(dir.path(), "你好")
        .await
        .unwrap_err()
        .to_string()
        .contains("无法读取"));
    let traces = trace::list(&pool).await.unwrap();
    assert_eq!(traces.iter().filter(|t| t.status == "error").count(), 3);
    assert_eq!(companion.history().await.unwrap().len(), 2);
}

#[tokio::test]
async fn http_failure_remains_retryable_and_local_query_links_the_failed_trace() {
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };
    let (pool, companion, dir) = setup().await;
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        let mut data = [0; 16384];
        socket.read(&mut data).await.unwrap();
        let body = r#"{"error":{"message":"test unauthorized","type":"authentication_error"}}"#;
        let response = format!("HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
        socket.write_all(response.as_bytes()).await.unwrap();
    });
    settings::save(
        &pool,
        dir.path(),
        SettingsInput {
            name: String::new(),
            preferences: String::new(),
            model: "test-model".into(),
            base_url: format!("http://{address}/v1"),
            api_key: Some("test-local-credential".into()),
        },
    )
    .await
    .unwrap();
    let error = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        companion.reply_configured(dir.path(), "不要推荐酒，聊聊天"),
    )
    .await
    .unwrap()
    .unwrap_err();
    server.await.unwrap();
    assert!(!error.to_string().contains("test-local-credential"));
    assert!(companion.history().await.unwrap().is_empty());
    let failure = trace::list(&pool).await.unwrap().remove(0);
    assert_eq!(failure.status, "error");
    assert!(failure.events.iter().any(|e| e.phase == "model.error"));
    let mut input = query(LocalAvailability::Any);
    input.after_trace_id = Some(failure.id.clone());
    companion.recommend_local(dir.path(), &input).await.unwrap();
    let local = trace::list(&pool).await.unwrap().remove(0);
    assert_eq!(local.status, "local");
    assert!(local
        .events
        .iter()
        .any(|e| e.phase == "fallback.source" && e.detail.contains(&failure.id)));
    assert!(!local.events.iter().any(|e| e.phase.starts_with("model.")));
    assert_eq!(companion.history().await.unwrap().len(), 2);
}

#[test]
fn model_output_cannot_mislabel_itself_as_local() {
    let (reply, _) = parse_reply(
        r#"{"reply":"你好","recipeIds":[],"mode":"local"}"#,
        &HashMap::new(),
    )
    .unwrap();
    assert_eq!(reply.mode, ReplyMode::Agent);
}
