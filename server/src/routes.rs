use crate::{
    auth::{self, login, register, CurrentUser},
    local, menu,
    models::*,
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
