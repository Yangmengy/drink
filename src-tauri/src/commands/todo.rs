use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteRow, Row};
use tauri::{AppHandle, State};

use sqlx::SqlitePool;
use crate::models::Recipe;

#[derive(Debug, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: String,
    pub recipe_id: String,
    pub created_at: i64,
    pub recipe: Recipe,
    pub owned_ingredients: i32,
    pub total_ingredients: i32,
}

#[tauri::command]
pub async fn get_todos(pool: State<'_, SqlitePool>) -> Result<Vec<TodoItem>, String> {
    let pool = pool.inner();
    
    // Get all todos with recipe details
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
    .await
    .map_err(|e| e.to_string())?;

    let mut todos = Vec::new();
    
    for row in rows {
        let recipe = Recipe {
            id: row.get("id"),
            name_zh: row.get("name_zh"),
            name_en: row.get("name_en"),
            category: row.get("category"),
            description: row.get("description"),
            story: row.get("story"),
            method: row.get("method"),
            color: row.get("color"),
            tags: row.get("tags"),
            flavor_profile: row.get("flavor_profile"),
            occasion: row.get("occasion"),
            season: row.get("season"),
            mood: row.get("mood"),
            origin: row.get("origin"),
            year_created: row.get("year_created"),
            creator: row.get("creator"),
            variations: row.get("variations"),
            pairing: row.get("pairing"),
            image_url: row.get("image_url"),
            glass_type: row.get("glass_type"),
            ice_type: row.get("ice_type"),
            garnish: row.get("garnish"),
            abv: row.get("abv"),
            difficulty: row.get("difficulty"),
            prep_time: row.get("prep_time"),
            source: row.get("source"),
            is_iba: row.get("is_iba"),
            is_favorite: row.get("is_favorite"),
            view_count: row.get("view_count"),
            last_viewed_at: row.get("last_viewed_at"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            synced_at: row.get("synced_at"),
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

#[tauri::command]
pub async fn add_todo(recipe_id: String, pool: State<'_, SqlitePool>) -> Result<bool, String> {
    let pool = pool.inner();
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
    .await
    .map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub async fn remove_todo(recipe_id: String, pool: State<'_, SqlitePool>) -> Result<bool, String> {
    let pool = pool.inner();
    
    sqlx::query("DELETE FROM todo_list WHERE recipe_id = ?")
        .bind(recipe_id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub async fn is_todo(recipe_id: String, pool: State<'_, SqlitePool>) -> Result<bool, String> {
    let pool = pool.inner();
    
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM todo_list WHERE recipe_id = ?")
        .bind(recipe_id)
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(count.0 > 0)
}
