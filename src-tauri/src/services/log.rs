use sqlx::SqlitePool;
use crate::error::AppError;
use crate::models::DrinkLog;
use crate::repositories::log::LogRepository;

pub struct LogService;

impl LogService {
    pub async fn get_drink_logs(date_str: Option<String>, pool: &SqlitePool) -> Result<Vec<DrinkLog>, AppError> {
        LogRepository::get_logs(date_str, pool).await
    }

    pub async fn add_drink_log(
        recipe_id: String, 
        date_str: String, 
        rating: Option<i32>, 
        notes: Option<String>, 
        images: Option<Vec<String>>, 
        pool: &SqlitePool
    ) -> Result<bool, AppError> {
        LogRepository::add_log(recipe_id, date_str, rating, notes, images, pool).await
    }

    pub async fn delete_drink_log(log_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        LogRepository::delete_log(log_id, pool).await
    }
}
