use sqlx::SqlitePool;
use tauri::State;
use crate::models::{InventoryItem, Ingredient, Recipe};

/// 获取用户库存
#[tauri::command]
pub async fn get_inventory(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<InventoryItem>, String> {
    let items = sqlx::query_as::<_, InventoryItem>(
        "SELECT * FROM user_inventory ORDER BY added_at DESC"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(items)
}

/// 添加到库存
#[tauri::command]
pub async fn add_to_inventory(
    ingredient_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    // 检查是否已存在
    let exists: bool = sqlx::query_scalar(
        "SELECT COUNT(*) > 0 FROM user_inventory WHERE ingredient_id = ?"
    )
    .bind(&ingredient_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    if exists {
        return Err("Ingredient already in inventory".to_string());
    }
    
    let id = uuid::Uuid::new_v4().to_string();
    
    sqlx::query(
        "INSERT INTO user_inventory (id, ingredient_id, added_at, updated_at) 
         VALUES (?, ?, strftime('%s', 'now'), strftime('%s', 'now'))"
    )
    .bind(id)
    .bind(ingredient_id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 从库存移除
#[tauri::command]
pub async fn remove_from_inventory(
    ingredient_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("DELETE FROM user_inventory WHERE ingredient_id = ?")
        .bind(ingredient_id)
        .execute(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 获取所有原料
#[tauri::command]
pub async fn get_all_ingredients(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Ingredient>, String> {
    let ingredients = sqlx::query_as::<_, Ingredient>(
        "SELECT * FROM ingredients ORDER BY category, name_zh"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(ingredients)
}

/// 根据分类获取原料
#[tauri::command]
pub async fn get_ingredients_by_category(
    category: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Ingredient>, String> {
    let ingredients = sqlx::query_as::<_, Ingredient>(
        "SELECT * FROM ingredients WHERE category = ? ORDER BY name_zh"
    )
    .bind(category)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(ingredients)
}

/// 搜索原料
#[tauri::command]
pub async fn search_ingredients(
    query: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Ingredient>, String> {
    let search_pattern = format!("%{}%", query);
    
    let ingredients = sqlx::query_as::<_, Ingredient>(
        "SELECT * FROM ingredients 
         WHERE name_zh LIKE ? OR name_en LIKE ?
         ORDER BY name_zh
         LIMIT 50"
    )
    .bind(&search_pattern)
    .bind(&search_pattern)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(ingredients)
}

/// 根据库存推荐配方
#[tauri::command]
pub async fn get_recipes_by_inventory(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, String> {
    // 获取用户库存的原料 ID
    let inventory_ids: Vec<String> = sqlx::query_scalar(
        "SELECT ingredient_id FROM user_inventory"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    if inventory_ids.is_empty() {
        return Ok(vec![]);
    }
    
    // 查找可以完全用库存原料制作的配方
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
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(recipes)
}
