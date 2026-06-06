use tauri::State;
use sqlx::SqlitePool;
use crate::models::{InventoryItem, Ingredient, Recipe};
use crate::error::AppError;
use crate::services::inventory::InventoryService;

#[tauri::command]
pub async fn get_inventory(pool: State<'_, SqlitePool>) -> Result<Vec<InventoryItem>, AppError> {
    InventoryService::get_inventory(&pool).await
}

#[tauri::command]
pub async fn add_to_inventory(ingredient_id: String, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    InventoryService::add_to_inventory(ingredient_id, &pool).await
}

#[tauri::command]
pub async fn remove_from_inventory(ingredient_id: String, pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    InventoryService::remove_from_inventory(ingredient_id, &pool).await
}

#[tauri::command]
pub async fn get_all_ingredients(pool: State<'_, SqlitePool>) -> Result<Vec<Ingredient>, AppError> {
    InventoryService::get_all_ingredients(&pool).await
}

#[tauri::command]
pub async fn create_custom_ingredient(name_zh: String, pool: State<'_, SqlitePool>) -> Result<String, AppError> {
    InventoryService::create_custom_ingredient(name_zh, &pool).await
}

#[tauri::command]
pub async fn get_ingredients_by_category(category: String, pool: State<'_, SqlitePool>) -> Result<Vec<Ingredient>, AppError> {
    InventoryService::get_ingredients_by_category(category, &pool).await
}

#[tauri::command]
pub async fn search_ingredients(query: String, pool: State<'_, SqlitePool>) -> Result<Vec<Ingredient>, AppError> {
    InventoryService::search_ingredients(query, &pool).await
}

#[tauri::command]
pub async fn get_recipes_by_inventory(pool: State<'_, SqlitePool>) -> Result<Vec<Recipe>, AppError> {
    InventoryService::get_recipes_by_inventory(&pool).await
}
