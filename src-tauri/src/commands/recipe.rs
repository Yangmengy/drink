use sqlx::SqlitePool;
use tauri::State;
use crate::models::{Recipe, RecipeDetail, RecipeFilter, RecipeIngredient, RecipeIngredientDetail, RecipeStep, SearchArgs, Ingredient};

/// 搜索配方
#[tauri::command]
pub async fn search_recipes(
    args: SearchArgs,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, String> {
    let mut query = String::from("SELECT * FROM recipes WHERE 1=1");
    
    // 如果有搜索关键词，使用 FTS 全文搜索
    if let Some(q) = &args.query {
        if !q.is_empty() {
            query = format!(
                "SELECT r.* FROM recipes r 
                 JOIN recipes_fts f ON r.id = f.recipe_id 
                 WHERE recipes_fts MATCH ? "
            );
        }
    }
    
    // 分类过滤
    if let Some(category) = &args.category {
        query.push_str(&format!(" AND category = '{}'", category));
    }
    
    // 难度过滤
    if let Some(difficulty) = args.difficulty {
        query.push_str(&format!(" AND difficulty = {}", difficulty));
    }
    
    // 酒精度过滤
    if let Some(max_abv) = args.max_abv {
        query.push_str(&format!(" AND (abv IS NULL OR abv <= {})", max_abv));
    }
    
    // IBA 筛选
    if let Some(is_iba) = args.is_iba {
        query.push_str(&format!(" AND is_iba = {}", if is_iba { 1 } else { 0 }));
    }
    
    // 限制数量
    let limit = args.limit.unwrap_or(50);
    query.push_str(&format!(" LIMIT {}", limit));
    
    let recipes = if let Some(q) = &args.query {
        if !q.is_empty() {
            sqlx::query_as::<_, Recipe>(&query)
                .bind(q)
                .fetch_all(pool.inner())
                .await
                .map_err(|e| e.to_string())?
        } else {
            sqlx::query_as::<_, Recipe>(&query)
                .fetch_all(pool.inner())
                .await
                .map_err(|e| e.to_string())?
        }
    } else {
        sqlx::query_as::<_, Recipe>(&query)
            .fetch_all(pool.inner())
            .await
            .map_err(|e| e.to_string())?
    };
    
    Ok(recipes)
}

/// 根据 ID 获取配方详情
#[tauri::command]
pub async fn get_recipe_by_id(
    id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<RecipeDetail>, String> {
    // 获取配方基本信息
    let recipe = sqlx::query_as::<_, Recipe>(
        "SELECT * FROM recipes WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    if recipe.is_none() {
        return Ok(None);
    }
    
    let recipe = recipe.unwrap();
    
    // 获取配方原料
    let recipe_ingredients = sqlx::query_as::<_, RecipeIngredient>(
        "SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY display_order"
    )
    .bind(&id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    // 获取每个原料的详细信息
    let mut ingredients_detail = Vec::new();
    for ri in recipe_ingredients {
        let ingredient = sqlx::query_as::<_, Ingredient>(
            "SELECT * FROM ingredients WHERE id = ?"
        )
        .bind(&ri.ingredient_id)
        .fetch_one(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
        
        ingredients_detail.push(RecipeIngredientDetail {
            recipe_ingredient: ri,
            ingredient,
        });
    }
    
    // 获取制作步骤
    let steps = sqlx::query_as::<_, RecipeStep>(
        "SELECT * FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number"
    )
    .bind(&id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(Some(RecipeDetail {
        recipe,
        ingredients: ingredients_detail,
        steps,
    }))
}

/// 获取推荐配方
#[tauri::command]
pub async fn get_recommended_recipes(
    limit: Option<i32>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, String> {
    let limit = limit.unwrap_or(10);
    
    let recipes = sqlx::query_as::<_, Recipe>(
        "SELECT * FROM recipes 
         WHERE is_iba = 1 
         ORDER BY view_count DESC, difficulty ASC 
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(recipes)
}

/// 获取收藏的配方
#[tauri::command]
pub async fn get_favorite_recipes(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, String> {
    let recipes = sqlx::query_as::<_, Recipe>(
        "SELECT * FROM recipes WHERE is_favorite = 1 ORDER BY updated_at DESC"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(recipes)
}

/// 切换收藏状态
#[tauri::command]
pub async fn toggle_favorite(
    recipe_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<bool, String> {
    // 获取当前收藏状态
    let current: bool = sqlx::query_scalar(
        "SELECT is_favorite FROM recipes WHERE id = ?"
    )
    .bind(&recipe_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    // 切换状态
    let new_state = !current;
    sqlx::query(
        "UPDATE recipes SET is_favorite = ?, updated_at = strftime('%s', 'now') WHERE id = ?"
    )
    .bind(new_state)
    .bind(&recipe_id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(new_state)
}

/// 获取历史记录
#[tauri::command]
pub async fn get_recipe_history(
    limit: Option<i32>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, String> {
    let limit = limit.unwrap_or(20);
    
    let recipes = sqlx::query_as::<_, Recipe>(
        "SELECT DISTINCT r.* FROM recipes r
         JOIN history h ON r.id = h.recipe_id
         ORDER BY h.viewed_at DESC
         LIMIT ?"
    )
    .bind(limit)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(recipes)
}

/// 添加到历史记录
#[tauri::command]
pub async fn add_to_history(
    recipe_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let history_id = uuid::Uuid::new_v4().to_string();
    
    sqlx::query(
        "INSERT INTO history (id, recipe_id, viewed_at) VALUES (?, ?, strftime('%s', 'now'))"
    )
    .bind(history_id)
    .bind(&recipe_id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    // 更新配方的查看次数和最后查看时间
    sqlx::query(
        "UPDATE recipes 
         SET view_count = view_count + 1, 
             last_viewed_at = strftime('%s', 'now')
         WHERE id = ?"
    )
    .bind(&recipe_id)
    .execute(pool.inner())
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(())
}

/// 获取配方列表（带过滤）
#[tauri::command]
pub async fn get_recipes(
    filter: Option<RecipeFilter>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Recipe>, String> {
    let mut query = String::from("SELECT * FROM recipes WHERE 1=1");
    
    if let Some(f) = filter {
        if let Some(category) = f.category {
            query.push_str(&format!(" AND category = '{}'", category));
        }
        if let Some(difficulty) = f.difficulty {
            query.push_str(&format!(" AND difficulty = {}", difficulty));
        }
        if let Some(is_iba) = f.is_iba {
            query.push_str(&format!(" AND is_iba = {}", if is_iba { 1 } else { 0 }));
        }
        if let Some(is_favorite) = f.is_favorite {
            query.push_str(&format!(" AND is_favorite = {}", if is_favorite { 1 } else { 0 }));
        }
    }
    
    query.push_str(" ORDER BY updated_at DESC LIMIT 50");
    
    let recipes = sqlx::query_as::<_, Recipe>(&query)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(recipes)
}
