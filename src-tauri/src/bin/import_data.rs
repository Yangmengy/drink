use sqlx::sqlite::SqlitePool;
use std::fs;
use serde_json::Value;

#[path = "../db/mod.rs"]
mod db;

#[path = "../models/mod.rs"]
mod models;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let pool = db::init_database().await?;
    
    // Read test.json
    let test_json_path = "../test.json";
    let data = fs::read_to_string(test_json_path).expect("Failed to read test.json");
    let recipes: Vec<Value> = serde_json::from_str(&data).expect("Failed to parse JSON");
    
    let current_time = chrono::Utc::now().timestamp();
    
    for item in recipes {
        let recipe_id = item["id"].as_str().unwrap();
        let tags_str = if item["tags"].is_null() { None } else { Some(serde_json::to_string(&item["tags"]).unwrap()) };
        let flavor_profile_str = if item["flavor_profile"].is_null() { None } else { Some(serde_json::to_string(&item["flavor_profile"]).unwrap()) };
        let occasion_str = if item["occasion"].is_null() { None } else { Some(serde_json::to_string(&item["occasion"]).unwrap()) };
        let season_str = if item["season"].is_null() { None } else { Some(serde_json::to_string(&item["season"]).unwrap()) };
        let mood_str = if item["mood"].is_null() { None } else { Some(serde_json::to_string(&item["mood"]).unwrap()) };
        let variations_str = if item["variations"].is_null() { None } else { Some(serde_json::to_string(&item["variations"]).unwrap()) };
        let pairing_str = if item["pairing"].is_null() { None } else { Some(serde_json::to_string(&item["pairing"]).unwrap()) };

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO recipes (
                id, name_zh, name_en, category, description, story, method, color, 
                tags, flavor_profile, occasion, season, mood, origin, year_created, 
                creator, variations, pairing, image_url, glass_type, ice_type, 
                garnish, abv, difficulty, prep_time, source, is_iba, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(recipe_id)
        .bind(item["name_zh"].as_str().unwrap())
        .bind(item["name_en"].as_str())
        .bind(item["category"].as_str().unwrap_or("classic"))
        .bind(item["description"].as_str())
        .bind(item["story"].as_str())
        .bind(item["method"].as_str())
        .bind(item["color"].as_str())
        .bind(tags_str)
        .bind(flavor_profile_str)
        .bind(occasion_str)
        .bind(season_str)
        .bind(mood_str)
        .bind(item["origin"].as_str())
        .bind(item["year_created"].as_i64().map(|v| v as i32))
        .bind(item["creator"].as_str())
        .bind(variations_str)
        .bind(pairing_str)
        .bind(item["image_url"].as_str())
        .bind(item["glass_type"].as_str())
        .bind(item["ice_type"].as_str())
        .bind(item["garnish"].as_str())
        .bind(item["abv"].as_f64().map(|v| v as f32))
        .bind(item["difficulty"].as_i64().unwrap_or(3) as i32)
        .bind(item["prep_time"].as_i64().map(|v| v as i32))
        .bind(item["source"].as_str().unwrap_or("AI Generated"))
        .bind(item["is_iba"].as_bool().unwrap_or(false))
        .bind(current_time)
        .bind(current_time)
        .execute(&pool).await?;
        
        // Insert ingredients
        if let Some(ingredients) = item["ingredients"].as_array() {
            let mut display_order = 1;
            for ing in ingredients {
                let name_zh = ing["name_zh"].as_str().unwrap();
                let ingredient_id = format!("ing-{}", uuid::Uuid::new_v4().to_string().chars().take(8).collect::<String>());
                
                // Try to find existing ingredient by name, or insert new
                let existing_ing: Option<(String,)> = sqlx::query_as(
                    "SELECT id FROM ingredients WHERE name_zh = ?"
                )
                .bind(name_zh)
                .fetch_optional(&pool).await?;
                
                let actual_ing_id = if let Some(row) = existing_ing {
                    row.0
                } else {
                    sqlx::query(
                        r#"
                        INSERT INTO ingredients (
                            id, name_zh, name_en, category, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?)
                        "#
                    )
                    .bind(&ingredient_id)
                    .bind(name_zh)
                    .bind(ing["name_en"].as_str())
                    .bind("other") // Default category
                    .bind(current_time)
                    .bind(current_time)
                    .execute(&pool).await?;
                    ingredient_id
                };

                let ri_id = format!("ri-{}", uuid::Uuid::new_v4());
                sqlx::query(
                    r#"
                    INSERT INTO recipe_ingredients (
                        id, recipe_id, ingredient_id, amount, unit, is_optional, display_order, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    "#
                )
                .bind(ri_id)
                .bind(recipe_id)
                .bind(actual_ing_id)
                .bind(ing["amount"].as_f64().map(|v| v as f32))
                .bind(ing["unit"].as_str())
                .bind(ing["is_optional"].as_bool().unwrap_or(false))
                .bind(display_order)
                .bind(current_time)
                .execute(&pool).await?;
                
                display_order += 1;
            }
        }

        // Insert steps
        if let Some(steps) = item["steps"].as_array() {
            for step in steps {
                let rs_id = format!("rs-{}", uuid::Uuid::new_v4());
                sqlx::query(
                    r#"
                    INSERT INTO recipe_steps (
                        id, recipe_id, step_number, title, instruction, duration, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    "#
                )
                .bind(rs_id)
                .bind(recipe_id)
                .bind(step["step_number"].as_i64().unwrap_or(1) as i32)
                .bind(step["title"].as_str())
                .bind(step["instruction"].as_str().unwrap())
                .bind(step["duration"].as_i64().map(|v| v as i32))
                .bind(current_time)
                .execute(&pool).await?;
            }
        }

        println!("Successfully inserted recipe: {}", item["name_zh"].as_str().unwrap());
    }

    Ok(())
}
