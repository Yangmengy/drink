use tauri::State;
use sqlx::SqlitePool;
use crate::models::DrinkLog;
use crate::error::AppError;
use crate::services::log::LogService;

#[tauri::command]
pub async fn get_drink_logs(date_str: Option<String>, pool: State<'_, SqlitePool>) -> Result<Vec<DrinkLog>, AppError> {
    LogService::get_drink_logs(date_str, &pool).await
}

#[tauri::command]
pub async fn add_drink_log(
    recipe_id: String, 
    date_str: String, 
    rating: Option<i32>, 
    notes: Option<String>, 
    images: Option<Vec<String>>, 
    pool: State<'_, SqlitePool>
) -> Result<bool, AppError> {
    LogService::add_drink_log(recipe_id, date_str, rating, notes, images, &pool).await
}

#[tauri::command]
pub async fn delete_drink_log(log_id: String, pool: State<'_, SqlitePool>) -> Result<bool, AppError> {
    LogService::delete_drink_log(log_id, &pool).await
}
