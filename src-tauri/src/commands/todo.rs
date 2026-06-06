use tauri::State;
use sqlx::SqlitePool;
use crate::models::TodoItem;
use crate::error::AppError;
use crate::services::todo::TodoService;

#[tauri::command]
pub async fn get_todos(pool: State<'_, SqlitePool>) -> Result<Vec<TodoItem>, AppError> {
    TodoService::get_todos(&pool).await
}

#[tauri::command]
pub async fn add_todo(recipe_id: String, pool: State<'_, SqlitePool>) -> Result<bool, AppError> {
    TodoService::add_todo(recipe_id, &pool).await
}

#[tauri::command]
pub async fn remove_todo(recipe_id: String, pool: State<'_, SqlitePool>) -> Result<bool, AppError> {
    TodoService::remove_todo(recipe_id, &pool).await
}

#[tauri::command]
pub async fn is_todo(recipe_id: String, pool: State<'_, SqlitePool>) -> Result<bool, AppError> {
    TodoService::is_todo(recipe_id, &pool).await
}
