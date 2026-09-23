use crate::{
    agent,
    auth::{self, login, register, CurrentUser, OwnerUser},
    local, menu,
    models::*,
    observability, settings,
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{get, patch, post},
    Json, Router,
};

pub async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

pub async fn ready(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    sqlx::query("SELECT 1").execute(&state.pool).await?;
    Ok(Json(
        serde_json::json!({ "status": "ready", "database": "ok" }),
    ))
}

pub fn api() -> Router<AppState> {
    Router::new()
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/me", get(auth::me))
        .route("/ingredients", get(list_ingredients).post(add_ingredient))
        .route("/ingredients/{id}/owned", patch(set_ingredient_owned))
        .route("/recipes", get(search_recipes).post(save_recipe))
        .route("/recipes/{id}", get(get_recipe).delete(delete_recipe))
        .route("/recommendations/local", post(recommend_local))
        .route("/settings", get(get_settings).put(save_settings))
        .route("/chat", get(chat_history).delete(clear_chat))
        .route("/chat/send", post(send_chat))
        .route("/traces", get(list_traces))
        .route("/observability/summary", get(observability_summary))
}

async fn list_ingredients(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<Ingredient>>, crate::error::AppError> {
    Ok(Json(menu::inventory(&state.pool, user.id).await?))
}

async fn add_ingredient(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<NewIngredientInput>,
) -> Result<Json<AddIngredientResult>, crate::error::AppError> {
    Ok(Json(
        menu::add_ingredient(&state.pool, user.id, &input).await?,
    ))
}

async fn set_ingredient_owned(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
    Json(input): Json<OwnedInput>,
) -> Result<StatusCode, crate::error::AppError> {
    menu::set_inventory(&state.pool, user.id, &id, input.owned).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn search_recipes(
    State(state): State<AppState>,
    user: CurrentUser,
    Query(query): Query<MenuQuery>,
) -> Result<Json<Vec<Recipe>>, crate::error::AppError> {
    Ok(Json(menu::search(&state.pool, user.id, &query).await?))
}

async fn recommend_local(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<LocalRecommendationInput>,
) -> Result<Json<LocalRecommendationResult>, crate::error::AppError> {
    Ok(Json(local::recommend(&state.pool, user.id, &input).await?))
}

async fn get_recipe(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> Result<Json<Recipe>, crate::error::AppError> {
    Ok(Json(menu::get(&state.pool, user.id, &id).await?))
}

async fn save_recipe(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<RecipeInput>,
) -> Result<Json<serde_json::Value>, crate::error::AppError> {
    let id = menu::save_custom(&state.pool, user.id, &input).await?;
    Ok(Json(serde_json::json!({ "id": id })))
}

async fn delete_recipe(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<String>,
) -> Result<StatusCode, crate::error::AppError> {
    menu::delete_custom(&state.pool, user.id, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_settings(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Settings>, crate::error::AppError> {
    Ok(Json(settings::get(&state.pool, user.id).await?))
}

async fn save_settings(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<SettingsInput>,
) -> Result<Json<Settings>, crate::error::AppError> {
    Ok(Json(settings::save(&state.pool, user.id, &input).await?))
}

async fn chat_history(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<ChatMessage>>, crate::error::AppError> {
    Ok(Json(agent::history(&state.pool, user.id).await?))
}

async fn clear_chat(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<StatusCode, crate::error::AppError> {
    agent::clear(&state.pool, user.id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn send_chat(
    State(state): State<AppState>,
    user: CurrentUser,
    Json(input): Json<ChatSendInput>,
) -> Result<Json<ChatMessage>, crate::error::AppError> {
    let profile = settings::get(&state.pool, user.id).await?;
    agent::send(&state.pool, user.id, &profile, &input)
        .await
        .map(Json)
}

async fn list_traces(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<Vec<AgentTrace>>, crate::error::AppError> {
    Ok(Json(agent::traces(&state.pool, user.id).await?))
}

async fn observability_summary(
    State(state): State<AppState>,
    _owner: OwnerUser,
) -> Result<Json<observability::ObservabilitySnapshot>, crate::error::AppError> {
    Ok(Json(observability::summary(&state.pool).await?))
}
