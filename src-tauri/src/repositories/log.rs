use sqlx::{SqlitePool, Row};
use crate::models::{Recipe, DrinkLog};
use crate::error::AppError;

pub struct LogRepository;

impl LogRepository {
    pub async fn get_logs(date_str: Option<String>, pool: &SqlitePool) -> Result<Vec<DrinkLog>, AppError> {
        let query = if let Some(ref date) = date_str {
            format!("SELECT l.*, r.name_zh, r.name_en, r.image_url, r.category FROM drink_logs l LEFT JOIN recipes r ON l.recipe_id = r.id WHERE l.date_str = '{}' ORDER BY l.created_at DESC", date)
        } else {
            "SELECT l.*, r.name_zh, r.name_en, r.image_url, r.category FROM drink_logs l LEFT JOIN recipes r ON l.recipe_id = r.id ORDER BY l.created_at DESC".to_string()
        };
        
        let rows = sqlx::query(&query)
            .fetch_all(pool)
            .await?;

        let mut logs = Vec::new();
        
        for row in rows {
            let mut recipe = None;
            let recipe_id: String = row.get("recipe_id");
            if !recipe_id.is_empty() {
                let name_zh: Option<String> = row.get("name_zh");
                if let Some(n) = name_zh {
                    let category: Option<String> = row.try_get("category").ok().flatten();
                    let dummy_recipe = Recipe {
                        id: recipe_id.clone(),
                        name_zh: n,
                        name_en: row.get("name_en"),
                        category: category.unwrap_or_default(),
                        image_url: row.get("image_url"),
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
                images: row.try_get("images").ok().flatten(),
                created_at: row.get("created_at"),
                recipe,
            });
        }

        Ok(logs)
    }

    pub async fn add_log(
        recipe_id: String, 
        date_str: String, 
        rating: Option<i32>, 
        notes: Option<String>, 
        images: Option<Vec<String>>, 
        pool: &SqlitePool
    ) -> Result<bool, AppError> {
        let id = format!("log-{}", uuid::Uuid::new_v4());
        let current_time = chrono::Utc::now().timestamp();
        
        let images_json = if let Some(imgs) = images {
            if imgs.is_empty() { None } else { Some(serde_json::to_string(&imgs).unwrap_or_default()) }
        } else {
            None
        };
        
        sqlx::query(
            r#"
            INSERT INTO drink_logs (id, recipe_id, date_str, rating, notes, images, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(id)
        .bind(recipe_id)
        .bind(date_str)
        .bind(rating)
        .bind(notes)
        .bind(images_json)
        .bind(current_time)
        .execute(pool)
        .await?;

        Ok(true)
    }

    pub async fn delete_log(log_id: String, pool: &SqlitePool) -> Result<bool, AppError> {
        let result = sqlx::query("DELETE FROM drink_logs WHERE id = ?")
            .bind(log_id)
            .execute(pool)
            .await?;
            
        Ok(result.rows_affected() > 0)
    }
}
