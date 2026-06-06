use sqlx::SqlitePool;
use crate::models::{InventoryItem, Ingredient, Recipe};
use crate::error::AppError;

pub struct InventoryRepository;

impl InventoryRepository {
    pub async fn get_inventory(pool: &SqlitePool) -> Result<Vec<InventoryItem>, AppError> {
        let items = sqlx::query_as::<_, InventoryItem>(
            "SELECT * FROM user_inventory ORDER BY added_at DESC"
        )
        .fetch_all(pool)
        .await?;
        
        Ok(items)
    }

    pub async fn add_to_inventory(ingredient_id: String, pool: &SqlitePool) -> Result<(), AppError> {
        let exists: bool = sqlx::query_scalar(
            "SELECT COUNT(*) > 0 FROM user_inventory WHERE ingredient_id = ?"
        )
        .bind(&ingredient_id)
        .fetch_one(pool)
        .await?;
        
        if exists {
            return Err(AppError::Validation("Ingredient already in inventory".to_string()));
        }
        
        let id = uuid::Uuid::new_v4().to_string();
        
        sqlx::query(
            "INSERT INTO user_inventory (id, ingredient_id, added_at, updated_at) 
             VALUES (?, ?, strftime('%s', 'now'), strftime('%s', 'now'))"
        )
        .bind(id)
        .bind(ingredient_id)
        .execute(pool)
        .await?;
        
        Ok(())
    }

    pub async fn remove_from_inventory(ingredient_id: String, pool: &SqlitePool) -> Result<(), AppError> {
        sqlx::query("DELETE FROM user_inventory WHERE ingredient_id = ?")
            .bind(ingredient_id)
            .execute(pool)
            .await?;
        
        Ok(())
    }

    pub async fn get_all_ingredients(pool: &SqlitePool) -> Result<Vec<Ingredient>, AppError> {
        let ingredients = sqlx::query_as::<_, Ingredient>(
            "SELECT * FROM ingredients ORDER BY category, name_zh"
        )
        .fetch_all(pool)
        .await?;
        
        Ok(ingredients)
    }

    pub async fn create_custom_ingredient(name_zh: String, pool: &SqlitePool) -> Result<String, AppError> {
        // Check if exists first
        if let Ok(existing) = sqlx::query_as::<_, Ingredient>("SELECT * FROM ingredients WHERE name_zh = ?")
            .bind(&name_zh)
            .fetch_one(pool)
            .await 
        {
            return Ok(existing.id);
        }

        let id = uuid::Uuid::new_v4().to_string();
        let current_time = chrono::Utc::now().timestamp();
        
        sqlx::query(
            "INSERT INTO ingredients (id, name_zh, category, created_at, updated_at) 
             VALUES (?, ?, 'other', ?, ?)"
        )
        .bind(&id)
        .bind(&name_zh)
        .bind(current_time)
        .bind(current_time)
        .execute(pool)
        .await?;
        
        Ok(id)
    }

    pub async fn get_ingredients_by_category(category: String, pool: &SqlitePool) -> Result<Vec<Ingredient>, AppError> {
        let ingredients = sqlx::query_as::<_, Ingredient>(
            "SELECT * FROM ingredients WHERE category = ? ORDER BY name_zh"
        )
        .bind(category)
        .fetch_all(pool)
        .await?;
        
        Ok(ingredients)
    }

    pub async fn search_ingredients(query: String, pool: &SqlitePool) -> Result<Vec<Ingredient>, AppError> {
        let search_pattern = format!("%{}%", query);
        
        let ingredients = sqlx::query_as::<_, Ingredient>(
            "SELECT * FROM ingredients 
             WHERE name_zh LIKE ? OR name_en LIKE ?
             ORDER BY name_zh
             LIMIT 50"
        )
        .bind(&search_pattern)
        .bind(&search_pattern)
        .fetch_all(pool)
        .await?;
        
        Ok(ingredients)
    }

    pub async fn get_recipes_by_inventory(pool: &SqlitePool) -> Result<Vec<Recipe>, AppError> {
        let inventory_ids: Vec<String> = sqlx::query_scalar(
            "SELECT ingredient_id FROM user_inventory"
        )
        .fetch_all(pool)
        .await?;
        
        if inventory_ids.is_empty() {
            return Ok(vec![]);
        }
        
        let placeholders = inventory_ids.iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        
        let query = format!(
            "SELECT DISTINCT r.* FROM recipes r
             WHERE NOT EXISTS (
                 SELECT 1 FROM recipe_ingredients ri
                 WHERE ri.recipe_id = r.id
                 AND ri.is_optional = 0
                 AND ri.ingredient_id NOT IN ({})
             )
             ORDER BY r.difficulty ASC, r.view_count DESC
             LIMIT 20",
            placeholders
        );
        
        let mut q = sqlx::query_as::<_, Recipe>(&query);
        for id in inventory_ids {
            q = q.bind(id);
        }
        
        let recipes = q
            .fetch_all(pool)
            .await?;
        
        Ok(recipes)
    }
}
