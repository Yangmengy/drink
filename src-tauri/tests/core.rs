use adk_rust::{async_trait, Content, Llm, LlmRequest, LlmResponse, LlmResponseStream, Part};
use adk_session::{InMemorySessionService, SqliteSessionService};
use cocktail_app_lib::{agent::Companion, db, menu, models::*, settings, trace};
use serde_json::json;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::sync::{Arc, Mutex};

async fn database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    db::initialize(&pool).await.unwrap();
    pool
}
fn recipe() -> RecipeInput {
    RecipeInput {
        id: None,
        name: "晚风测试特调".into(),
        description: "清爽柑橘香".into(),
        method: "直调".into(),
        flavor: Flavor {
            sweet: 1,
            sour: 3,
            bitter: 1,
            strong: 2,
        },
        ingredients: vec![
            IngredientInput {
                name: "测试青柠".into(),
                amount: 20.0,
                unit: "ml".into(),
                optional: false,
            },
            IngredientInput {
                name: "测试薄荷".into(),
                amount: 1.0,
                unit: "枝".into(),
                optional: true,
            },
        ],
        steps: vec!["加冰并搅拌".into()],
    }
}
fn profile() -> Settings {
    Settings {
        name: "测试用户".into(),
        preferences: "不太甜".into(),
        model: "mock".into(),
        base_url: "http://localhost/v1".into(),
        api_key_configured: true,
        data_directory: String::new(),
    }
}

#[tokio::test]
async fn fresh_database_seed_and_reinitialization_are_persistent() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("cocktail.db");
    let pool = db::open(&path).await.unwrap();
    let menu = menu::search(&pool, &MenuQuery::default()).await.unwrap();
    assert_eq!(menu.len(), 83);
    assert!(menu
        .iter()
        .all(|r| !r.ingredients.is_empty() && !r.steps.is_empty()));
    let id = menu::save_custom(&pool, &recipe()).await.unwrap();
    pool.close().await;
    let reopened = db::open(&path).await.unwrap();
    db::initialize(&reopened).await.unwrap();
    assert_eq!(
        menu::search(&reopened, &MenuQuery::default())
            .await
            .unwrap()
            .len(),
        84
    );
    assert_eq!(
        menu::get(&reopened, &id).await.unwrap().name,
        "晚风测试特调"
    );
}

#[tokio::test]
async fn legacy_schema_and_user_data_survive_migration() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();
    sqlx::raw_sql(include_str!("legacy_schema.sql"))
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO recipes (id,name_zh,category,source,created_at,updated_at) VALUES ('legacy','旧配方','自创','custom',1,1)").execute(&pool).await.unwrap();
    db::initialize(&pool).await.unwrap();
    assert_eq!(menu::get(&pool, "legacy").await.unwrap().name, "旧配方");
    assert_eq!(
        menu::search(&pool, &MenuQuery::default())
            .await
            .unwrap()
            .len(),
        84
    );
    let dir = tempfile::tempdir().unwrap();
    sqlx::query("UPDATE user_profile SET llm_api_key='test-legacy-credential' WHERE id=1")
        .execute(&pool)
        .await
        .unwrap();
    settings::migrate_key(&pool, dir.path()).await.unwrap();
    assert_eq!(
        settings::read_key(dir.path()).unwrap(),
        "test-legacy-credential"
    );
    let old: Option<String> = sqlx::query_scalar("SELECT llm_api_key FROM user_profile WHERE id=1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(old.is_none());
    assert!(
        !serde_json::to_string(&settings::get(&pool, dir.path()).await.unwrap())
            .unwrap()
            .contains("test-legacy-credential")
    );
}

#[tokio::test]
async fn custom_recipe_round_trip_inventory_and_safe_search() {
    let pool = database().await;
    let mut input = recipe();
    let id = menu::save_custom(&pool, &input).await.unwrap();
    let r = menu::get(&pool, &id).await.unwrap();
    assert_eq!(r.missing, vec!["测试青柠"]);
    assert!(!r.can_make);
    assert_eq!(
        menu::search(
            &pool,
            &MenuQuery {
                query: "晚风".into(),
                ..Default::default()
            }
        )
        .await
        .unwrap()[0]
            .id,
        id
    );
    assert_eq!(
        menu::search(
            &pool,
            &MenuQuery {
                query: "测试青柠".into(),
                ..Default::default()
            }
        )
        .await
        .unwrap()[0]
            .id,
        id
    );
    assert!(menu::search(
        &pool,
        &MenuQuery {
            query: "\"'; DROP TABLE recipes;--".into(),
            ..Default::default()
        }
    )
    .await
    .unwrap()
    .is_empty());
    menu::set_inventory(&pool, &r.ingredients[0].id, true)
        .await
        .unwrap();
    menu::set_inventory(&pool, &r.ingredients[0].id, true)
        .await
        .unwrap();
    assert!(menu::get(&pool, &id).await.unwrap().can_make);
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM user_inventory")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
    input.id = Some(id.clone());
    input.name = "新晚风".into();
    input.steps = vec!["先搅拌".into(), "再加冰".into()];
    menu::save_custom(&pool, &input).await.unwrap();
    let updated = menu::get(&pool, &id).await.unwrap();
    assert_eq!(updated.steps.len(), 2);
    assert_eq!(updated.ingredients.len(), 2);
    assert!(menu::search(
        &pool,
        &MenuQuery {
            query: "新晚风".into(),
            max_sweet: Some(0),
            ..Default::default()
        }
    )
    .await
    .unwrap()
    .is_empty());
    menu::delete_custom(&pool, &id).await.unwrap();
    assert!(menu::get(&pool, &id).await.is_err());
    let orphan: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM recipe_steps WHERE recipe_id=?")
        .bind(&id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(orphan, 0);
}

#[tokio::test]
async fn invalid_custom_recipe_is_rejected_without_partial_writes() {
    let pool = database().await;
    let mut input = recipe();
    input.ingredients[0].amount = -1.0;
    assert!(menu::save_custom(&pool, &input).await.is_err());
    assert_eq!(
        menu::search(&pool, &MenuQuery::default())
            .await
            .unwrap()
            .len(),
        83
    );
    input = recipe();
    input.id = Some("margarita-classic".into());
    assert!(menu::save_custom(&pool, &input).await.is_err());
    assert!(menu::delete_custom(&pool, "margarita-classic")
        .await
        .is_err());
}

struct ScriptedModel {
    recommend: bool,
    invalid: bool,
    requests: Arc<Mutex<Vec<LlmRequest>>>,
}
#[async_trait]
impl Llm for ScriptedModel {
    fn name(&self) -> &str {
        "scripted"
    }
    async fn generate_content(
        &self,
        request: LlmRequest,
        _stream: bool,
    ) -> adk_rust::Result<LlmResponseStream> {
        self.requests.lock().unwrap().push(request.clone());
        let response = request
            .contents
            .iter()
            .rev()
            .flat_map(|c| c.parts.iter())
            .find_map(|p| match p {
                Part::FunctionResponse {
                    function_response, ..
                } => Some(function_response.response.clone()),
                _ => None,
            });
        let part = if self.invalid {
            Part::Text {
                text: json!({"reply":"编造酒品","recipeIds":["nonexistent"]}).to_string(),
            }
        } else if !self.recommend {
            Part::Text {
                text: json!({"reply":"我在，慢慢说。","recipeIds":[]}).to_string(),
            }
        } else if let Some(result) = response {
            let recipes = result["recipes"].as_array().expect("tool returned menu");
            assert!(!recipes.is_empty());
            Part::Text{text:json!({"reply":"这杯晚风适合你，缺料已经列在卡片里。","recipeIds":[recipes[0]["id"]]}).to_string()}
        } else {
            Part::FunctionCall {
                name: "search_menu".into(),
                args: json!({"query":"晚风","maxSweet":2}),
                id: Some("call-menu".into()),
                thought_signature: None,
            }
        };
        let response = LlmResponse {
            content: Some(Content {
                role: "model".into(),
                parts: vec![part],
            }),
            turn_complete: true,
            ..Default::default()
        };
        Ok(Box::pin(adk_rust::futures::stream::once(async move {
            Ok(response)
        })))
    }
}

#[tokio::test]
async fn real_adk_tool_loop_recalls_custom_recipe_and_records_trace() {
    let pool = database().await;
    let id = menu::save_custom(&pool, &recipe()).await.unwrap();
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    let requests = Arc::new(Mutex::new(vec![]));
    let result = companion
        .reply(
            Arc::new(ScriptedModel {
                recommend: true,
                invalid: false,
                requests: requests.clone(),
            }),
            &profile(),
            "推荐晚风，不太甜",
        )
        .await
        .unwrap();
    assert_eq!(result.recipes[0].id, id);
    assert_eq!(result.recipes[0].missing, vec!["测试青柠"]);
    assert_eq!(requests.lock().unwrap().len(), 2);
    let history = companion.history().await.unwrap();
    assert_eq!(history.len(), 2);
    assert_eq!(history[1].recipes[0].id, id);
    let traces = trace::list(&pool).await.unwrap();
    assert_eq!(traces.len(), 1);
    assert_eq!(traces[0].id, result.trace_id.unwrap());
    assert!(traces[0]
        .events
        .iter()
        .any(|e| e.phase == "tool.search_menu.complete"));
    assert_eq!(traces[0].status, "ok");
}

#[tokio::test]
async fn casual_chat_persists_and_clear_removes_actual_model_context() {
    let dir = tempfile::tempdir().unwrap();
    let pool = database().await;
    let url = format!("sqlite:{}?mode=rwc", dir.path().join("chat.db").display());
    let sessions = SqliteSessionService::new(&url).await.unwrap();
    sessions.migrate().await.unwrap();
    let companion = Companion::new(pool.clone(), Arc::new(sessions))
        .await
        .unwrap();
    let requests = Arc::new(Mutex::new(vec![]));
    let model = Arc::new(ScriptedModel {
        recommend: false,
        invalid: false,
        requests: requests.clone(),
    });
    companion
        .reply(model.clone(), &profile(), "今天想聊聊")
        .await
        .unwrap();
    assert_eq!(requests.lock().unwrap().len(), 1);
    assert!(!trace::list(&pool).await.unwrap()[0]
        .events
        .iter()
        .any(|e| e.phase.starts_with("tool.")));
    drop(companion);
    let restored = Companion::new(
        pool,
        Arc::new(SqliteSessionService::new(&url).await.unwrap()),
    )
    .await
    .unwrap();
    assert_eq!(restored.history().await.unwrap().len(), 2);
    restored
        .reply(model.clone(), &profile(), "你还记得吗")
        .await
        .unwrap();
    assert!(requests
        .lock()
        .unwrap()
        .last()
        .unwrap()
        .contents
        .iter()
        .any(|c| c.parts.iter().any(|p| p.text() == Some("今天想聊聊"))));
    restored.clear().await.unwrap();
    assert!(restored.history().await.unwrap().is_empty());
    restored.reply(model, &profile(), "重新开始").await.unwrap();
    assert!(!requests
        .lock()
        .unwrap()
        .last()
        .unwrap()
        .contents
        .iter()
        .any(|c| c.parts.iter().any(|p| p.text() == Some("今天想聊聊"))));
}

#[tokio::test]
async fn ungrounded_recommendations_fail_without_saving_half_a_turn() {
    let pool = database().await;
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    let result = companion
        .reply(
            Arc::new(ScriptedModel {
                recommend: true,
                invalid: true,
                requests: Arc::new(Mutex::new(vec![])),
            }),
            &profile(),
            "推荐一杯",
        )
        .await;
    assert!(result.is_err());
    assert!(companion.history().await.unwrap().is_empty());
    let traces = trace::list(&pool).await.unwrap();
    assert_eq!(traces[0].status, "error");
    assert!(traces[0]
        .events
        .iter()
        .any(|e| e.phase == "output.validate"));
}

#[tokio::test]
async fn missing_configuration_has_a_trace_without_creating_chat_history() {
    let pool = database().await;
    let directory = tempfile::tempdir().unwrap();
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    let error = companion
        .reply_configured(directory.path(), "你好")
        .await
        .unwrap_err();
    let traces = trace::list(&pool).await.unwrap();
    assert_eq!(traces.len(), 1);
    assert_eq!(traces[0].status, "error");
    assert!(error.to_string().contains(&traces[0].id));
    assert!(traces[0]
        .events
        .iter()
        .any(|event| event.phase == "config.error"));
    assert!(!traces[0]
        .events
        .iter()
        .any(|event| event.phase.starts_with("model.")));
    assert!(companion.history().await.unwrap().is_empty());
}

#[tokio::test]
async fn trace_storage_failure_does_not_fail_an_accepted_reply() {
    let pool = database().await;
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    sqlx::query("DROP TABLE agent_traces")
        .execute(&pool)
        .await
        .unwrap();
    let response = companion
        .reply(
            Arc::new(ScriptedModel {
                recommend: false,
                invalid: false,
                requests: Arc::new(Mutex::new(vec![])),
            }),
            &profile(),
            "今天想聊聊",
        )
        .await
        .unwrap();
    assert_eq!(response.text, "我在，慢慢说。");
    assert_eq!(companion.history().await.unwrap().len(), 2);
}

#[tokio::test]
async fn compatible_http_model_runs_the_actual_adk_menu_tool() {
    use adk_rust::model::openai::{OpenAIClient, OpenAIConfig};
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };
    let pool = database().await;
    let expected_id = menu::save_custom(&pool, &recipe()).await.unwrap();
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let reply_id = expected_id.clone();
    let server = tokio::spawn(async move {
        for call in 0..2 {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            let mut buf = [0u8; 8192];
            let (header_end, length) = loop {
                let n = socket.read(&mut buf).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
                if let Some(end) = bytes.windows(4).position(|s| s == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&bytes[..end]);
                    let length = headers
                        .lines()
                        .find_map(|l| {
                            l.to_lowercase()
                                .strip_prefix("content-length:")
                                .map(|n| n.trim().parse::<usize>().unwrap())
                        })
                        .unwrap();
                    break (end + 4, length);
                }
            };
            while bytes.len() < header_end + length {
                let n = socket.read(&mut buf).await.unwrap();
                assert!(n > 0);
                bytes.extend_from_slice(&buf[..n]);
            }
            let request: serde_json::Value =
                serde_json::from_slice(&bytes[header_end..header_end + length]).unwrap();
            assert_eq!(request["stream"], true);
            let deltas = if call == 0 {
                assert!(request["tools"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|t| t["function"]["name"] == "search_menu"));
                vec![
                    json!({"role":"assistant","tool_calls":[{"index":0,"id":"menu-http","type":"function","function":{"name":"search_menu","arguments":"{\"query\":"}}]}),
                    json!({"tool_calls":[{"index":0,"function":{"arguments":"\"晚风\"}"}}]}),
                ]
            } else {
                let tool = request["messages"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .find(|m| m["role"] == "tool")
                    .unwrap();
                assert!(tool["content"].as_str().unwrap().contains(&reply_id));
                let content =
                    json!({"reply":"找到你的晚风，卡片列出了缺料。","recipeIds":[reply_id]})
                        .to_string();
                vec![json!({"role":"assistant","content":content})]
            };
            let mut body = String::new();
            for delta in deltas {
                let chunk = json!({"id":format!("completion-{call}"),"object":"chat.completion.chunk","created":1789600000,"model":"mock-compatible","choices":[{"index":0,"delta":delta,"finish_reason":null}]});
                body.push_str(&format!("data: {chunk}\n\n"));
            }
            let finished = json!({"id":format!("completion-{call}"),"object":"chat.completion.chunk","created":1789600000,"model":"mock-compatible","choices":[{"index":0,"delta":{},"finish_reason":if call==0{"tool_calls"}else{"stop"}}],"usage":{"prompt_tokens":30,"completion_tokens":20,"total_tokens":50}});
            body.push_str(&format!("data: {finished}\n\ndata: [DONE]\n\n"));
            let response=format!("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body);
            socket.write_all(response.as_bytes()).await.unwrap();
        }
    });
    let model = OpenAIClient::new(OpenAIConfig::compatible(
        "local-test-only",
        format!("http://{address}/v1"),
        "mock-compatible",
    ))
    .unwrap();
    let companion = Companion::new(pool.clone(), Arc::new(InMemorySessionService::new()))
        .await
        .unwrap();
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        companion.reply(Arc::new(model), &profile(), "想喝晚风"),
    )
    .await
    .unwrap()
    .unwrap();
    server.await.unwrap();
    assert_eq!(result.recipes[0].id, expected_id);
    let records = trace::list(&pool).await.unwrap();
    assert!(records[0].events.iter().any(|e| e.phase == "model.usage"));
    assert!(!serde_json::to_string(&records)
        .unwrap()
        .contains("local-test-only"));
}
