use sqlx::{SqlitePool, Row};
use crate::models::{Recipe, TodoItem};
use crate::error::AppError;

pub struct TodoRepository;

impl TodoRepository {
    pub async fn get_todos(pool: &SqlitePool) -> Result<Vec<TodoItem>, AppError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id as todo_id, t.created_at as todo_created_at,
                r.*,
                (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) as total_ingredients,
                (SELECT COUNT(*) FROM recipe_ingredients ri 
                 JOIN user_inventory ui ON ri.ingredient_id = ui.ingredient_id 
                 WHERE ri.recipe_id = r.id) as owned_ingredients
            FROM todo_list t
            JOIN recipes r ON t.recipe_id = r.id
            ORDER BY t.created_at DESC
            "#
        )
        .fetch_all(pool)
        .await?;

        let mut todos = Vec::new();
        
        for row in rows {
            let recipe = Recipe {
                id: row.get("id"),
                name_zh: row.get("name_zh"),
                name_en: row.try_get("name_en").ok(),
                category: row.try_get("category").unwrap_or_else(|_| "".to_string()),
                description: row.try_get("description").ok(),
                story: row.try_get("story").ok(),
                method: row.try_get("method").ok(),
                color: row.try_get("color").ok(),
                tags: row.try_get("tags").ok(),
                flavor_profile: row.try_get("flavor_profile").ok(),
                occasion: row.try_get("occasion").ok(),
                season: row.try_get("season").ok(),
                mood: row.try_get("mood").ok(),
                origin: row.try_get("origin").ok(),
                year_created: row.try_get("year_created").ok(),
                creator: row.try_get("creator").ok(),
                variations: row.try_get("variations").ok(),
                pairing: row.try_get("pairing").ok(),
                image_url: row.try_get("image_url").ok(),
                glass_type: row.try_get("glass_type").ok(),
                ice_type: row.try_get("ice_type").ok(),
                garnish: row.try_get("garnish").ok(),
                abv: row.try_get("abv").ok(),
                difficulty: row.try_get("difficulty").unwrap_or(1),
                prep_time: row.try_get("prep_time").ok(),
                source: row.try_get("source").ok(),
                is_iba: row.try_get("is_iba").unwrap_or(false),
                is_favorite: row.try_get("is_favorite").unwrap_or(false),
                view_count: row.try_get("view_count").unwrap_or(0),
                last_viewed_at: row.try_get("last_viewed_at").ok(),
                created_at: row.try_get("created_at").unwrap_or(0),
                updated_at: row.try_get("updated_at").unwrap_or(0),
                synced_at: row.try_get("synced_at").ok(),
            };
            
            todos.push(TodoItem {
                id: row.get("todo_id"),
                recipe_id: row.get("id"),
                created_at: row.get("todo_created_at"),
                recipe,
                owned_ingredients: row.get("owned_ingredients"),
                total_ingredients: row.get("total_ingredients"),
            });
        }

        Ok(todos)
    }

    pub async fn add_todo(recipe_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        let id = format!("todo-{}", uuid::Uuid::new_v4());
        let current_time = chrono::Utc::now().timestamp();
        
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO todo_list (id, recipe_id, created_at)
            VALUES (?, ?, ?)
            "#
        )
        .bind(id)
        .bind(recipe_id)
        .bind(current_time)
        .execute(pool)
        .await?;

        Ok(true)
    }

    pub async fn remove_todo(recipe_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        sqlx::query("DELETE FROM todo_list WHERE recipe_id = ?")
            .bind(recipe_id)
            .execute(pool)
            .await?;

        Ok(true)
    }

    pub async fn is_todo(recipe_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM todo_list WHERE recipe_id = ?")
            .bind(recipe_id)
            .fetch_one(pool)
            .await?;

        Ok(count.0 > 0)
    }
}
