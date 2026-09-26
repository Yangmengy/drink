use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use drink_server::{models::*, router, AppState};
use http_body_util::BodyExt;
use serde::de::DeserializeOwned;
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use wiremock::{
    matchers::{method, path},
    Mock, MockServer, ResponseTemplate,
};

const EMAIL_HOST: &str = "@it.example.com";

async fn parse<T: DeserializeOwned>(response: axum::response::Response) -> anyhow::Result<T> {
    let bytes = response.into_body().collect().await?.to_bytes();
    Ok(serde_json::from_slice(&bytes)?)
}

async fn request_json(
    app: axum::Router,
    method: &str,
    path: &str,
    token: Option<&str>,
    body: Option<Value>,
) -> anyhow::Result<axum::response::Response> {
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json");
    if let Some(token) = token {
        builder = builder.header("authorization", format!("Bearer {token}"));
    }
    let body = match body {
        Some(value) => serde_json::to_vec(&value)?,
        None => Vec::new(),
    };
    Ok(app.oneshot(builder.body(Body::from(body))?).await?)
}

#[tokio::test]
async fn auth_inventory_and_custom_recipe_flow() -> anyhow::Result<()> {
    let Some(database_url) = std::env::var("DATABASE_URL").ok() else {
        eprintln!("DATABASE_URL is not set; PostgreSQL HTTP flow test skipped");
        return Ok(());
    };
    let database = PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&database).await?;
    const PROFILE_EMAIL_HOST: &str = "@profile-it.example.com";
    let email = format!("{}{}", uuid::Uuid::new_v4().simple(), PROFILE_EMAIL_HOST);
    sqlx::query("DELETE FROM users WHERE email LIKE $1")
        .bind(format!("%{EMAIL_HOST}"))
        .execute(&database)
        .await?;

    let state = AppState {
        pool: database.clone(),
        jwt_secret: "integration-test-secret-with-32-characters".to_owned(),
        owner_email: Some(email.clone()),
    };
    let app = router(state);

    let credentials = json!({
        "email": email,
        "password": "a-long-password"
    });
    let response = request_json(
        app.clone(),
        "POST",
        "/auth/register",
        None,
        Some(credentials.clone()),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let registered: Value = parse(response).await?;
    let registered_token = registered["token"].as_str().expect("register token");

    let response =
        request_json(app.clone(), "POST", "/auth/login", None, Some(credentials)).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let logged_in: Value = parse(response).await?;
    assert!(!logged_in["token"].as_str().unwrap_or_default().is_empty());

    let response =
        request_json(app.clone(), "GET", "/auth/me", Some(registered_token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);

    let response = request_json(
        app.clone(),
        "GET",
        "/ingredients",
        Some(registered_token),
        None,
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let ingredients: Vec<Ingredient> = parse(response).await?;
    assert!(!ingredients.is_empty());

    let new_ingredient = json!({
        "name": "Server Test Cherry",
        "category": "other",
        "owned": true
    });
    let response = request_json(
        app.clone(),
        "POST",
        "/ingredients",
        Some(registered_token),
        Some(new_ingredient),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let added: AddIngredientResult = parse(response).await?;
    assert!(added.created);
    assert!(added.ingredient.owned);

    let response = request_json(
        app.clone(),
        "GET",
        "/recipes?query=margarita",
        Some(registered_token),
        None,
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let recipes: Vec<Recipe> = parse(response).await?;
    assert!(recipes.iter().any(|recipe| recipe.name_en == "Margarita"));

    let custom = json!({
        "id": null,
        "name": "Server Flow Custom",
        "description": "integration test recipe",
        "method": "Stir",
        "flavor": {"sweet": 1, "sour": 1, "bitter": 0, "strong": 2},
        "ingredients": [{
            "name": "Server Test Cherry",
            "amount": 10,
            "unit": "ml",
            "optional": false
        }],
        "steps": ["Stir gently."]
    });
    let response = request_json(
        app.clone(),
        "POST",
        "/recipes",
        Some(registered_token),
        Some(custom),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let saved: Value = parse(response).await?;
    let recipe_id = saved["id"].as_str().unwrap().to_owned();

    let response = request_json(
        app.clone(),
        "GET",
        &format!("/recipes/{recipe_id}"),
        Some(registered_token),
        None,
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let recipe: Recipe = parse(response).await?;
    assert_eq!(recipe.source, "custom");
    assert!(recipe.can_make);

    let response = request_json(
        app.clone(),
        "POST",
        "/recommendations/local",
        Some(registered_token),
        Some(json!({
            "availability": "ready",
            "query": {"query": "Server Test Cherry"}
        })),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let recommended: Value = parse(response).await?;
    assert_eq!(recommended["message"]["mode"], "local");
    assert_eq!(recommended["message"]["role"], "assistant");
    let recommended_recipes = recommended["message"]["recipes"]
        .as_array()
        .expect("local recommendation recipes");
    assert!(
        recommended_recipes
            .iter()
            .any(|recipe| recipe["id"] == Value::String(recipe_id.clone())),
        "ready-to-make custom recipe should be recommended"
    );

    let response = request_json(
        app.clone(),
        "GET",
        "/settings",
        Some(registered_token),
        None,
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let loaded_settings: Value = parse(response).await?;
    assert_eq!(loaded_settings["apiKeyConfigured"], false);

    let response = request_json(
        app.clone(),
        "PUT",
        "/settings",
        Some(registered_token),
        Some(json!({
            "name": "Server Test",
            "preferences": "less sweet",
            "model": "test-model",
            "baseUrl": "https://model.example.com/v1",
            "apiKey": "must-not-be-persisted"
        })),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let saved_settings: Value = parse(response).await?;
    assert_eq!(saved_settings["model"], "test-model");
    assert_eq!(saved_settings["apiKeyConfigured"], false);
    assert_eq!(
        saved_settings["dataDirectory"],
        "浏览器本机；服务器不保存 API Key"
    );

    let response = request_json(
        app.clone(),
        "POST",
        "/chat/send",
        Some(registered_token),
        Some(json!({"message": "hello", "apiKey": null})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    let missing_key: Value = parse(response).await?;
    assert!(missing_key["message"]
        .as_str()
        .unwrap()
        .contains("请先在设置中填写 API Key"));

    let response = request_json(app.clone(), "GET", "/chat", Some(registered_token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let chat: Value = parse(response).await?;
    assert_eq!(chat.as_array().unwrap().len(), 0);

    let response =
        request_json(app.clone(), "GET", "/traces", Some(registered_token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let traces: Value = parse(response).await?;
    let traces = traces.as_array().unwrap();
    assert_eq!(traces.len(), 1);
    assert_eq!(traces[0]["status"], "error");

    let other_email = format!("{}{}", uuid::Uuid::new_v4().simple(), EMAIL_HOST);
    let other_credentials = json!({
        "email": other_email,
        "password": "a-long-password"
    });
    let response = request_json(
        app.clone(),
        "POST",
        "/auth/register",
        None,
        Some(other_credentials),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let registered: Value = parse(response).await?;
    let other_token = registered["token"].as_str().expect("other token");

    let response = request_json(
        app.clone(),
        "POST",
        "/chat/send",
        Some(other_token),
        Some(json!({"message": "hello", "apiKey": null})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let response = request_json(
        app.clone(),
        "GET",
        "/observability/summary",
        Some(registered_token),
        None,
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let snapshot: Value = parse(response).await?;
    assert_eq!(snapshot["source"], "server");
    assert_eq!(snapshot["database"], "ok");
    assert!(snapshot["traces"].as_array().unwrap().len() >= 2);

    let response = request_json(
        app.clone(),
        "GET",
        "/observability/summary",
        Some(other_token),
        None,
    )
    .await?;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let response = request_json(app.clone(), "POST", "/recommendations/local", None, None).await?;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let response = request_json(
        app,
        "DELETE",
        &format!("/recipes/{recipe_id}"),
        Some(registered_token),
        None,
    )
    .await?;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    Ok(())
}

#[tokio::test]
async fn web_agent_uses_adk_runner_tool_loop() -> anyhow::Result<()> {
    let Some(database_url) = std::env::var("DATABASE_URL").ok() else {
        eprintln!("DATABASE_URL is not set; ADK Runner PostgreSQL test skipped");
        return Ok(());
    };
    let database = PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&database).await?;
    let email = format!("{}{}", uuid::Uuid::new_v4().simple(), EMAIL_HOST);
    sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(&email)
        .execute(&database)
        .await?;

    let model_server = MockServer::start().await;
    let recipe_id: String = sqlx::query_scalar(
        "SELECT id FROM recipes WHERE name_en = 'Margarita' ORDER BY id LIMIT 1",
    )
    .fetch_one(&database)
    .await?;
    let final_reply = json!({
        "reply": "ADK Runner completed the real menu tool loop.",
        "recipeIds": [recipe_id]
    });
    let tool_call = json!({
        "choices": [{
            "delta": {
                "tool_calls": [{
                    "index": 0,
                    "id": "call-menu",
                    "type": "function",
                    "function": {
                        "name": "search_menu",
                        "arguments": "{\"query\":\"Margarita\"}"
                    }
                }]
            },
            "finish_reason": "tool_calls"
        }]
    });
    let final_call = json!({
        "choices": [{
            "delta": {"content": serde_json::to_string(&final_reply)?},
            "finish_reason": "stop"
        }],
        "usage": {"prompt_tokens": 22, "completion_tokens": 9, "total_tokens": 31}
    });
    let stream_body = |chunk: &Value| {
        format!(
            "data: {}\n\ndata: [DONE]\n\n",
            serde_json::to_string(chunk).expect("stream chunk")
        )
    };
    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(move |_request: &_| {
            ResponseTemplate::new(200)
                .append_header("content-type", "text/event-stream")
                .set_body_string(stream_body(&tool_call))
        })
        .up_to_n_times(1)
        .mount(&model_server)
        .await;
    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(move |_request: &_| {
            ResponseTemplate::new(200)
                .append_header("content-type", "text/event-stream")
                .set_body_string(stream_body(&final_call))
        })
        .mount(&model_server)
        .await;

    let state = AppState {
        pool: database.clone(),
        jwt_secret: "integration-test-secret-with-32-characters".to_owned(),
        owner_email: Some(email.clone()),
    };
    let app = router(state);
    let credentials = json!({"email": email, "password": "a-long-password"});
    let response = request_json(
        app.clone(),
        "POST",
        "/auth/register",
        None,
        Some(credentials),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let registered: Value = parse(response).await?;
    let token = registered["token"].as_str().expect("token");
    let user_id: uuid::Uuid = registered["user"]["id"]
        .as_str()
        .expect("user id")
        .parse()?;

    let response = request_json(app.clone(), "GET", "/conversations", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let conversations: Value = parse(response).await?;
    let conversation_id = conversations[0]["id"]
        .as_str()
        .expect("active conversation id")
        .to_owned();

    sqlx::query(
        r#"
        INSERT INTO companion_settings (user_id, name, preferences, model, base_url)
        VALUES ($1, 'Owner', '', 'test-model', $2)
        ON CONFLICT (user_id) DO UPDATE SET model = 'test-model', base_url = $2
        "#,
    )
    .bind(user_id)
    .bind(model_server.uri())
    .execute(&database)
    .await?;

    let response = request_json(
        app.clone(),
        "POST",
        "/chat/send",
        Some(token),
        Some(json!({"message": "recommend a cocktail", "apiKey": "test-key", "conversationId": conversation_id})),
    )
    .await?;
    let reply: ChatMessage = parse(response).await?;
    assert_eq!(reply.mode, "agent");
    assert!(reply.text.contains("ADK Runner"));
    assert_eq!(reply.recipes.len(), 1);
    assert_eq!(reply.recipes[0].id, recipe_id);

    let response = request_json(app.clone(), "GET", "/traces", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let traces: Vec<Value> = parse(response).await?;
    let phases = traces[0]["events"]
        .as_array()
        .unwrap()
        .iter()
        .map(|event| event["phase"].as_str().unwrap_or_default())
        .collect::<Vec<_>>();
    assert!(phases.contains(&"model.request"));
    assert!(phases.contains(&"tool.search_menu.start"));
    assert!(phases.contains(&"tool.search_menu.complete"));
    assert!(phases.contains(&"output.accepted"));

    let response = request_json(app, "DELETE", "/chat", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);
    Ok(())
}

#[tokio::test]
async fn profile_memory_and_context_foundations() -> anyhow::Result<()> {
    let Some(database_url) = std::env::var("DATABASE_URL").ok() else {
        eprintln!("DATABASE_URL is not set; profile/memory PostgreSQL test skipped");
        return Ok(());
    };
    let database = PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&database).await?;
    let email = format!("{}{}", uuid::Uuid::new_v4().simple(), EMAIL_HOST);
    sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(&email)
        .execute(&database)
        .await?;

    let state = AppState {
        pool: database.clone(),
        jwt_secret: "integration-test-secret-with-32-characters".to_owned(),
        owner_email: Some(email.clone()),
    };
    let app = router(state);
    let response = request_json(
        app.clone(),
        "POST",
        "/auth/register",
        None,
        Some(json!({"email": email, "password": "a-long-password"})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let registered: Value = parse(response).await?;
    let token = registered["token"].as_str().expect("token");

    let event = json!({
        "idempotencyKey": "onboarding:constraints",
        "type": "constraint_set",
        "payload": {
            "constraints": {
                "noAlcohol": true,
                "allergies": ["dairy"]
            },
            "preferences": {
                "flavor": {"sweet": 1.0, "sour": 4.0, "bitter": 1.0, "strong": 1.0}
            }
        }
    });
    let response = request_json(
        app.clone(),
        "POST",
        "/profile/events",
        Some(token),
        Some(event.clone()),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);

    let response = request_json(app.clone(), "GET", "/profile", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let profile: Value = parse(response).await?;
    assert_eq!(profile["constraints"]["noAlcohol"], true);
    assert_eq!(profile["preferences"]["flavor"]["sour"], 4.0);

    let response = request_json(
        app.clone(),
        "POST",
        "/profile/events",
        Some(token),
        Some(event),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let replayed_profile: Value =
        parse(request_json(app.clone(), "GET", "/profile", Some(token), None).await?).await?;
    assert_eq!(
        replayed_profile["profileRevision"],
        profile["profileRevision"]
    );

    let response = request_json(
        app.clone(),
        "POST",
        "/memory/statements",
        Some(token),
        Some(json!({
            "kind": "constraint",
            "content": "对乳制品过敏。",
            "source": "structured_ui",
            "retentionPolicy": "explicit",
            "constraintPayload": {
                "constraints": {"noAlcohol": true, "allergies": ["dairy"]}
            }
        })),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let statement: Value = parse(response).await?;
    assert_eq!(statement["status"], "active");

    let response =
        request_json(app.clone(), "GET", "/memory/statements", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let statements: Value = parse(response).await?;
    assert_eq!(statements.as_array().unwrap().len(), 1);

    let profile_after_memory: Value =
        parse(request_json(app.clone(), "GET", "/profile", Some(token), None).await?).await?;
    assert_eq!(profile_after_memory["constraints"]["noAlcohol"], true);
    assert_eq!(profile_after_memory["constraints"]["allergies"][0], "dairy");

    let response = request_json(app.clone(), "GET", "/memory/settings", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let settings: Value = parse(response).await?;
    assert_eq!(settings["allowAutoLowRisk"], false);
    assert_eq!(settings["allowTemporaryContext"], false);

    let response = request_json(
        app.clone(),
        "POST",
        "/chat/send",
        Some(token),
        Some(json!({"message": "hello", "apiKey": null})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);

    let response = request_json(app, "DELETE", "/memory/statements", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);

    sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(&email)
        .execute(&database)
        .await?;
    Ok(())
}

#[tokio::test]
async fn conversation_directory_isolates_history_traces_and_clears() -> anyhow::Result<()> {
    let Some(database_url) = std::env::var("DATABASE_URL").ok() else {
        eprintln!("DATABASE_URL is not set; conversation PostgreSQL test skipped");
        return Ok(());
    };
    let database = PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&database).await?;
    let email = format!("{}{}", uuid::Uuid::new_v4().simple(), EMAIL_HOST);
    sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(&email)
        .execute(&database)
        .await?;

    let state = AppState {
        pool: database.clone(),
        jwt_secret: "integration-test-secret-with-32-characters".to_owned(),
        owner_email: Some(email.clone()),
    };
    let app = router(state);
    let response = request_json(
        app.clone(),
        "POST",
        "/auth/register",
        None,
        Some(json!({"email": email, "password": "a-long-password"})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let registered: Value = parse(response).await?;
    let token = registered["token"].as_str().expect("token");
    let user_id = registered["user"]["id"].as_str().expect("user id");

    let conversations: Vec<Value> =
        parse(request_json(app.clone(), "GET", "/conversations", Some(token), None).await?).await?;
    assert_eq!(conversations.len(), 1);
    assert_eq!(conversations[0]["isActive"], true);
    let conversation_a = conversations[0]["id"].as_str().expect("conversation a");

    for (role, text) in [("user", "A 的第一条"), ("assistant", "A 的回复")] {
        sqlx::query(
            "INSERT INTO chat_messages (user_id, conversation_id, role, text, mode) VALUES ($1::uuid, $2::uuid, $3, $4, 'agent')",
        )
        .bind(user_id)
        .bind(conversation_a)
        .bind(role)
        .bind(text)
        .execute(&database)
        .await?;
    }

    let created_response = request_json(
        app.clone(),
        "POST",
        "/conversations",
        Some(token),
        Some(json!({"idempotencyKey": uuid::Uuid::new_v4().to_string()})),
    )
    .await?;
    assert_eq!(created_response.status(), StatusCode::OK);
    let created: Value = parse(created_response).await?;
    assert_eq!(created["title"], "新的对话");
    let conversation_b = created["id"].as_str().expect("conversation b");
    assert_ne!(conversation_a, conversation_b);

    for (role, text) in [("user", "B 的第一条"), ("assistant", "B 的回复")] {
        sqlx::query(
            "INSERT INTO chat_messages (user_id, conversation_id, role, text, mode) VALUES ($1::uuid, $2::uuid, $3, $4, 'agent')",
        )
        .bind(user_id)
        .bind(conversation_b)
        .bind(role)
        .bind(text)
        .execute(&database)
        .await?;
    }

    sqlx::query(
        "INSERT INTO agent_traces (id, user_id, conversation_id, started_at, duration_ms, status, events) VALUES ($1, $2::uuid, $3::uuid, NOW(), 5, 'complete', '[]'::jsonb)",
    )
    .bind(format!("trace-{conversation_a}"))
    .bind(user_id)
    .bind(conversation_a)
    .execute(&database)
    .await?;
    sqlx::query(
        "INSERT INTO agent_traces (id, user_id, conversation_id, started_at, duration_ms, status, events) VALUES ($1, $2::uuid, $3::uuid, NOW(), 5, 'complete', '[]'::jsonb)",
    )
    .bind(format!("trace-{conversation_b}"))
    .bind(user_id)
    .bind(conversation_b)
    .execute(&database)
    .await?;

    let history_a: Vec<Value> = parse(
        request_json(
            app.clone(),
            "GET",
            &format!("/conversations/{conversation_a}/chat"),
            Some(token),
            None,
        )
        .await?,
    )
    .await?;
    assert_eq!(history_a.len(), 2);
    let history_b: Vec<Value> = parse(
        request_json(
            app.clone(),
            "GET",
            &format!("/conversations/{conversation_b}/chat"),
            Some(token),
            None,
        )
        .await?,
    )
    .await?;
    assert_eq!(history_b.len(), 2);

    let traces_a: Vec<Value> = parse(
        request_json(
            app.clone(),
            "GET",
            &format!("/traces?conversationId={conversation_a}"),
            Some(token),
            None,
        )
        .await?,
    )
    .await?;
    let traces_b: Vec<Value> = parse(
        request_json(
            app.clone(),
            "GET",
            &format!("/traces?conversationId={conversation_b}"),
            Some(token),
            None,
        )
        .await?,
    )
    .await?;
    assert_eq!(traces_a.len(), 1);
    assert_eq!(traces_b.len(), 1);

    let response = request_json(
        app.clone(),
        "DELETE",
        "/chat",
        Some(token),
        Some(json!({"conversationId": conversation_a})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let remaining_a: (i64, i64) = sqlx::query_as(
        r#"
        SELECT
          (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = $1::uuid),
          (SELECT COUNT(*) FROM agent_traces WHERE conversation_id = $1::uuid)
        "#,
    )
    .bind(conversation_a)
    .fetch_one(&database)
    .await?;
    assert_eq!(remaining_a, (0, 0));
    let remaining_b: (i64, i64) = sqlx::query_as(
        r#"
        SELECT
          (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = $1::uuid),
          (SELECT COUNT(*) FROM agent_traces WHERE conversation_id = $1::uuid)
        "#,
    )
    .bind(conversation_b)
    .fetch_one(&database)
    .await?;
    assert_eq!(remaining_b, (2, 1));

    let deleted: Value = parse(
        request_json(
            app.clone(),
            "DELETE",
            &format!("/conversations/{conversation_b}"),
            Some(token),
            None,
        )
        .await?,
    )
    .await?;
    assert_ne!(deleted.as_str(), Some(conversation_b));
    let conversations: Vec<Value> =
        parse(request_json(app.clone(), "GET", "/conversations", Some(token), None).await?).await?;
    assert_eq!(conversations.len(), 1);
    assert_ne!(conversations[0]["id"].as_str(), Some(conversation_b));
    let remaining_b: (i64, i64) = sqlx::query_as(
        r#"
        SELECT
          (SELECT COUNT(*) FROM chat_messages WHERE conversation_id = $1::uuid),
          (SELECT COUNT(*) FROM agent_traces WHERE conversation_id = $1::uuid)
        "#,
    )
    .bind(conversation_b)
    .fetch_one(&database)
    .await?;
    assert_eq!(remaining_b, (0, 0));

    sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(&email)
        .execute(&database)
        .await?;
    Ok(())
}

#[tokio::test]
async fn context_maintain_compacts_old_messages() -> anyhow::Result<()> {
    let Some(database_url) = std::env::var("DATABASE_URL").ok() else {
        eprintln!("DATABASE_URL is not set; context summary PostgreSQL test skipped");
        return Ok(());
    };
    let database = PgPool::connect(&database_url).await?;
    sqlx::migrate!("./migrations").run(&database).await?;
    const CONTEXT_EMAIL_HOST: &str = "@context-it.example.com";
    let email = format!("{}{}", uuid::Uuid::new_v4().simple(), CONTEXT_EMAIL_HOST);
    sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(&email)
        .execute(&database)
        .await?;

    let model_server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/chat/completions"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({
            "choices": [{
                "message": {"content": "{\"summary\":\"用户在测试旧对话摘要。\",\"confirmedFacts\":[\"测试摘要\"]}"}
            }]
        })))
        .mount(&model_server)
        .await;

    let state = AppState {
        pool: database.clone(),
        jwt_secret: "integration-test-secret-with-32-characters".to_owned(),
        owner_email: Some(email.clone()),
    };
    let app = router(state);
    let response = request_json(
        app.clone(),
        "POST",
        "/auth/register",
        None,
        Some(json!({"email": email, "password": "a-long-password"})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::CREATED);
    let registered: Value = parse(response).await?;
    let token = registered["token"].as_str().expect("token");
    let user_id: uuid::Uuid = registered["user"]["id"]
        .as_str()
        .expect("user id")
        .parse()?;

    sqlx::query(
        r#"
        INSERT INTO companion_settings (user_id, model, base_url)
        VALUES ($1, 'test-model', $2)
        "#,
    )
    .bind(user_id)
    .bind(model_server.uri())
    .execute(&database)
    .await?;
    let response = request_json(app.clone(), "GET", "/conversations", Some(token), None).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let conversations: Value = parse(response).await?;
    let conversation_id = conversations[0]["id"]
        .as_str()
        .expect("active conversation id")
        .to_owned();

    for index in 1..=40 {
        sqlx::query(
            r#"
            INSERT INTO chat_messages (user_id, conversation_id, role, text, mode)
            VALUES ($1, $4::uuid, CASE WHEN $2 % 2 = 0 THEN 'assistant' ELSE 'user' END,
                    $3, 'agent')
            "#,
        )
        .bind(user_id)
        .bind(index)
        .bind(format!("old message {index}"))
        .bind(&conversation_id)
        .execute(&database)
        .await?;
    }

    let response = request_json(
        app.clone(),
        "POST",
        "/context/maintain",
        Some(token),
        Some(json!({"apiKey": "browser-key"})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let result_result: Result<Value, _> = parse(response).await;
    println!("maintain={result_result:?}");
    let result: Value = result_result?;
    assert_eq!(result["maintained"], true);
    assert_eq!(result["coveredMessages"], 24);

    let summary: (String, i64, i64) = sqlx::query_as(
        r#"
        SELECT summary, from_seq, to_seq
        FROM chat_context_summaries
        WHERE user_id = $1 AND status = 'active'
        "#,
    )
    .bind(user_id)
    .fetch_one(&database)
    .await?;
    assert_eq!(summary.0, "用户在测试旧对话摘要。");
    let max_seq: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(seq), 0) FROM chat_messages WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&database)
            .await?;
    assert_eq!(summary.2, max_seq - 16);
    let candidate_seqs: Vec<i64> = sqlx::query_scalar(
        "SELECT seq FROM chat_messages WHERE user_id = $1 AND seq <= $2 ORDER BY seq",
    )
    .bind(user_id)
    .bind(summary.2)
    .fetch_all(&database)
    .await?;
    assert_eq!(candidate_seqs.len(), 24);
    assert_eq!(*candidate_seqs.first().expect("candidate seqs"), summary.1);

    let response = request_json(
        app,
        "POST",
        "/context/maintain",
        Some(token),
        Some(json!({"apiKey": "browser-key"})),
    )
    .await?;
    assert_eq!(response.status(), StatusCode::OK);
    let result: Value = parse(response).await?;
    assert_eq!(result["maintained"], false);
    assert_eq!(result["reason"], "below_threshold");

    sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(&email)
        .execute(&database)
        .await?;
    Ok(())
}
