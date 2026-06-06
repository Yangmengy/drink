use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqliteRow, Row};
use tauri::{AppHandle, State};

use sqlx::SqlitePool;
use crate::models::Recipe;

#[derive(Debug, Serialize, Deserialize)]
pub struct DrinkLog {
    pub id: String,
    pub recipe_id: String,
    pub date_str: String,
    pub rating: Option<i32>,
    pub notes: Option<String>,
    pub created_at: i64,
    pub recipe: Option<Recipe>, // If mapped to a real recipe
}

#[tauri::command]
pub async fn get_drink_logs(date_str: Option<String>, pool: State<'_, SqlitePool>) -> Result<Vec<DrinkLog>, String> {
    let pool = pool.inner();
    
    let query = if let Some(ref date) = date_str {
        format!("SELECT l.*, r.name_zh, r.name_en, r.image_url, r.category FROM drink_logs l LEFT JOIN recipes r ON l.recipe_id = r.id WHERE l.date_str = '{}' ORDER BY l.created_at DESC", date)
    } else {
        "SELECT l.*, r.name_zh, r.name_en, r.image_url, r.category FROM drink_logs l LEFT JOIN recipes r ON l.recipe_id = r.id ORDER BY l.created_at DESC".to_string()
    };
    
    let rows = sqlx::query(&query)
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut logs = Vec::new();
    
    for row in rows {
        // Build a partial recipe if needed, or full
        let mut recipe = None;
        let recipe_id: String = row.get("recipe_id");
        if !recipe_id.is_empty() {
            let name_zh: Option<String> = row.get("name_zh");
            if let Some(n) = name_zh {
                let mut dummy_recipe = Recipe {
                    id: recipe_id.clone(),
                    name_zh: n,
                    name_en: row.get("name_en"),
                    category: row.get("category"),
                    image_url: row.get("image_url"),
                    // fill dummy for the rest
                    description: None, story: None, method: None, color: None, tags: None,
                    flavor_profile: None, occasion: None, season: None, mood: None, origin: None,
                    year_created: None, creator: None, variations: None, pairing: None, glass_type: None,
                    ice_type: None, garnish: None, abv: None, difficulty: 1, prep_time: None, source: None,
                    is_iba: false, is_favorite: false, view_count: 0, last_viewed_at: None, created_at: 0,
                    updated_at: 0, synced_at: None,
                };
                recipe = Some(dummy_recipe);
            }
        }

        logs.push(DrinkLog {
            id: row.get("id"),
            recipe_id,
            date_str: row.get("date_str"),
            rating: row.get("rating"),
            notes: row.get("notes"),
            created_at: row.get("created_at"),
            recipe,
        });
    }

    Ok(logs)
}

#[tauri::command]
pub async fn add_drink_log(recipe_id: String, date_str: String, rating: Option<i32>, notes: Option<String>, pool: State<'_, SqlitePool>) -> Result<bool, String> {
    let pool = pool.inner();
    let id = format!("log-{}", uuid::Uuid::new_v4());
    let current_time = chrono::Utc::now().timestamp();
    
    sqlx::query(
        r#"
        INSERT INTO drink_logs (id, recipe_id, date_str, rating, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id)
    .bind(recipe_id)
    .bind(date_str)
    .bind(rating)
    .bind(notes)
    .bind(current_time)
    .execute(pool)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(true)
}
