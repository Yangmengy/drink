use sqlx::SqlitePool;
use tauri::State;
use crate::models::{Recipe, RecipeDetail, RecipeFilter, SearchArgs};
use crate::error::AppError;
use crate::services::recipe::RecipeService;

/// 搜索配方
#[tauri::command]
pub async fn search_recipes(
    args: SearchArgs,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, AppError> {
    RecipeService::search(args, &pool).await
}

/// 根据 ID 获取配方详情
#[tauri::command]
pub async fn get_recipe_by_id(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<RecipeDetail>, AppError> {
    RecipeService::get_by_id(id, &pool).await
}

/// 获取推荐配方
#[tauri::command]
pub async fn get_recommended_recipes(
    limit: Option<i32>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, AppError> {
    RecipeService::get_recommended(limit, &pool).await
}

/// 获取收藏的配方
#[tauri::command]
pub async fn get_favorite_recipes(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, AppError> {
    RecipeService::get_favorites(&pool).await
}

/// 切换收藏状态
#[tauri::command]
pub async fn toggle_favorite(
    recipe_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<bool, AppError> {
    RecipeService::toggle_favorite(recipe_id, &pool).await
}

/// 获取历史记录
#[tauri::command]
pub async fn get_recipe_history(
    limit: Option<i32>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, AppError> {
    RecipeService::get_history(limit, &pool).await
}

/// 添加到历史记录
#[tauri::command]
pub async fn add_to_history(
    recipe_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    RecipeService::add_to_history(recipe_id, &pool).await
}

/// 获取配方列表（带过滤）
#[tauri::command]
pub async fn get_recipes(
    filter: Option<RecipeFilter>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, AppError> {
    RecipeService::get_list(filter, &pool).await
}

#[tauri::command]
pub async fn create_custom_recipe(
    name_zh: String,
    category: String,
    image_url: Option<String>,
    details: Option<crate::models::CustomRecipeDetails>,
    pool: State<'_, SqlitePool>,
) -> Result<String, AppError> {
    RecipeService::create_custom(name_zh, category, image_url, details, &pool).await
}

#[tauri::command]
pub async fn update_recipe_image(
    recipe_id: String,
    image_url: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    RecipeService::update_image(recipe_id, image_url, &pool).await
}

#[tauri::command]
pub async fn delete_recipe(
    recipe_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), AppError> {
    RecipeService::delete_recipe(recipe_id, &pool).await
}
