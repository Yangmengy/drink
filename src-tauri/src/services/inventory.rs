use sqlx::SqlitePool;
use crate::error::AppError;
use crate::models::{InventoryItem, Ingredient, Recipe};
use crate::repositories::inventory::InventoryRepository;

pub struct InventoryService;

impl InventoryService {
    pub async fn get_inventory(pool: &SqlitePool) -> Result<Vec<InventoryItem>, AppError> {
        InventoryRepository::get_inventory(pool).await
    }

    pub async fn add_to_inventory(ingredient_id: String, pool: &SqlitePool) -> Result<(), AppError> {
        InventoryRepository::add_to_inventory(ingredient_id, pool).await
    }

    pub async fn remove_from_inventory(ingredient_id: String, pool: &SqlitePool) -> Result<(), AppError> {
        InventoryRepository::remove_from_inventory(ingredient_id, pool).await
    }

    pub async fn get_all_ingredients(pool: &SqlitePool) -> Result<Vec<Ingredient>, AppError> {
        InventoryRepository::get_all_ingredients(pool).await
    }

    pub async fn get_ingredients_by_category(category: String, pool: &SqlitePool) -> Result<Vec<Ingredient>, AppError> {
        InventoryRepository::get_ingredients_by_category(category, pool).await
    }

    pub async fn search_ingredients(query: String, pool: &SqlitePool) -> Result<Vec<Ingredient>, AppError> {
        InventoryRepository::search_ingredients(query, pool).await
    }

    pub async fn get_recipes_by_inventory(pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        InventoryRepository::get_recipes_by_inventory(pool).await
    }
}
