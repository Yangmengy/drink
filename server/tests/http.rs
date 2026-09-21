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
    let email = format!("{}{}", uuid::Uuid::new_v4().simple(), EMAIL_HOST);
    sqlx::query("DELETE FROM users WHERE email LIKE $1")
        .bind(format!("%{EMAIL_HOST}"))
        .execute(&database)
        .await?;

    let state = AppState {
        pool: database,
        jwt_secret: "integration-test-secret-with-32-characters".to_owned(),
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
