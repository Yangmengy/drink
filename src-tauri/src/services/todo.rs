use sqlx::SqlitePool;
use crate::error::AppError;
use crate::models::TodoItem;
use crate::repositories::todo::TodoRepository;

pub struct TodoService;

impl TodoService {
    pub async fn get_todos(pool: &SqlitePool) -> Result<Vec<TodoItem>, AppError> {
        TodoRepository::get_todos(pool).await
    }

    pub async fn add_todo(recipe_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        TodoRepository::add_todo(recipe_id, pool).await
    }

    pub async fn remove_todo(recipe_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        TodoRepository::remove_todo(recipe_id, pool).await
    }

    pub async fn is_todo(recipe_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        TodoRepository::is_todo(recipe_id, pool).await
    }
}
