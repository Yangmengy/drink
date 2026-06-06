// AI 调酒师 Tauri 命令接口

use crate::models::*;
use crate::recommendation::RecommendationEngine;
use sqlx::{Pool, Sqlite};
use std::collections::HashMap;
use tauri::State;

/// 获取推荐
#[tauri::command]
pub async fn get_ai_recommendation(
    request: RecommendationRequest,
    pool: State<'_, Pool<Sqlite>>,
) -> Result<RecommendationResponse, String> {
    // 1. 获取用户信息
    let user_profile = get_user_profile(&pool).await?;

    // 2. 获取所有可用酒款
    let recipes = get_all_recipes_extended(&pool).await?;

    // 3. 获取用户库存
    let inventory = get_user_inventory(&pool).await?;

    // 4. 获取酒款所需原料映射
    let recipe_ingredients = get_recipe_ingredients_map(&pool).await?;

    // 5. 获取推荐历史
    let history = get_recommendation_history(&pool, user_profile.id, 20).await?;

    // 6. 运行推荐算法
    let mut recommendations = RecommendationEngine::recommend(
        recipes,
        inventory,
        recipe_ingredients,
        &request,
        &user_profile,
        &history,
    )?;

    if recommendations.is_empty() {
        return Err("未找到合适的酒款".to_string());
    }

    // 7. 取分数最高的酒款
    let (best_recipe, score, breakdown) = recommendations.remove(0);

    // 8. 生成记忆上下文
    let memory_context = RecommendationEngine::generate_memory_context(&history);

    // 9. 生成推介词
    let reason = if request.use_llm {
        // TODO: Phase 2 - 调用 LLM
        RecommendationEngine::generate_reason_template(&best_recipe, &request, &memory_context)
    } else {
        RecommendationEngine::generate_reason_template(&best_recipe, &request, &memory_context)
    };

    // 10. 保存推荐历史
    let recommendation_id = save_recommendation_history(
        &pool,
        user_profile.id,
        &best_recipe.id,
        &request,
        &user_profile,
        score,
        &breakdown,
        &reason,
        None,
    )
    .await?;

    // 11. 转换为完整的 Recipe 结构
    let full_recipe = get_full_recipe(&pool, &best_recipe.id).await?;

    Ok(RecommendationResponse {
        recipe: full_recipe,
        score,
        score_breakdown: breakdown,
        reason,
        memory_context,
        recommendation_id,
    })
}

/// 提交推荐反馈
#[tauri::command]
pub async fn submit_recommendation_feedback(
    feedback: RecommendationFeedback,
    pool: State<'_, Pool<Sqlite>>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE recommendation_history 
         SET user_feedback = ?, feedback_at = ?
         WHERE id = ?"
    )
    .bind(feedback.feedback)
    .bind(chrono::Utc::now().timestamp())
    .bind(&feedback.recommendation_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("更新反馈失败: {}", e))?;

    Ok(())
}

/// 添加到待做清单
#[tauri::command]
pub async fn add_to_todo_from_ai(
    recipe_id: String,
    mood_context: Vec<String>,
    pool: State<'_, Pool<Sqlite>>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    let mood_json = serde_json::to_string(&mood_context).unwrap_or_else(|_| "[]".to_string());

    sqlx::query(
        "INSERT INTO todo_list (id, recipe_id, source, mood_context, priority, status, created_at)
         VALUES (?, ?, 'ai_bartender', ?, 3, 'pending', ?)"
    )
    .bind(&id)
    .bind(&recipe_id)
    .bind(&mood_json)
    .bind(now)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("添加到待做清单失败: {}", e))?;

    Ok(id)
}

/// 获取待做清单（扩展版）
#[tauri::command]
pub async fn get_todo_list_extended(
    pool: State<'_, Pool<Sqlite>>,
) -> Result<Vec<(TodoItemExtended, Recipe)>, String> {
    let items = sqlx::query_as::<_, TodoItemExtended>(
        "SELECT id, recipe_id, source, mood_context, priority, status, created_at, completed_at, notes
         FROM todo_list
         WHERE status = 'pending'
         ORDER BY priority DESC, created_at DESC"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("获取待做清单失败: {}", e))?;

    let mut result = Vec::new();
    for item in items {
        if let Ok(recipe) = get_full_recipe(&pool, &item.recipe_id).await {
            result.push((item, recipe));
        }
    }

    Ok(result)
}

/// 更新待做清单状态
#[tauri::command]
pub async fn update_todo_status(
    todo_id: String,
    status: String,
    pool: State<'_, Pool<Sqlite>>,
) -> Result<(), String> {
    let completed_at = if status == "completed" {
        Some(chrono::Utc::now().timestamp())
    } else {
        None
    };

    sqlx::query(
        "UPDATE todo_list SET status = ?, completed_at = ? WHERE id = ?"
    )
    .bind(&status)
    .bind(completed_at)
    .bind(&todo_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("更新状态失败: {}", e))?;

    Ok(())
}

/// 更新用户 MBTI 和星座
#[tauri::command]
pub async fn update_user_personality(
    mbti: Option<String>,
    zodiac: Option<String>,
    pool: State<'_, Pool<Sqlite>>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE user_profile SET mbti = ?, zodiac = ?, updated_at = ? WHERE id = 1"
    )
    .bind(mbti)
    .bind(zodiac)
    .bind(chrono::Utc::now().timestamp())
    .execute(pool.inner())
    .await
    .map_err(|e| format!("更新个性信息失败: {}", e))?;

    Ok(())
}

/// 更新 LLM 配置
#[tauri::command]
pub async fn update_llm_config(
    llm_api_key: Option<String>,
    llm_model: Option<String>,
    llm_base_url: Option<String>,
    pool: State<'_, Pool<Sqlite>>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE user_profile SET llm_api_key = ?, llm_model = ?, llm_base_url = ?, updated_at = ? WHERE id = 1"
    )
    .bind(llm_api_key)
    .bind(llm_model)
    .bind(llm_base_url)
    .bind(chrono::Utc::now().timestamp())
    .execute(pool.inner())
    .await
    .map_err(|e| format!("更新 LLM 配置失败: {}", e))?;

    Ok(())
}

/// 获取推荐历史
#[tauri::command]
pub async fn get_user_recommendation_history(
    limit: Option<i32>,
    pool: State<'_, Pool<Sqlite>>,
) -> Result<Vec<(RecommendationHistory, Recipe)>, String> {
    let limit_val = limit.unwrap_or(10);
    
    let histories = sqlx::query_as::<_, RecommendationHistory>(
        "SELECT * FROM recommendation_history WHERE user_id = 1 ORDER BY created_at DESC LIMIT ?"
    )
    .bind(limit_val)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("获取推荐历史失败: {}", e))?;

    let mut result = Vec::new();
    for history in histories {
        if let Ok(recipe) = get_full_recipe(&pool, &history.recipe_id).await {
            result.push((history, recipe));
        }
    }

    Ok(result)
}

// ============================================
// 辅助函数
// ============================================

async fn get_user_profile(pool: &Pool<Sqlite>) -> Result<UserProfile, String> {
    sqlx::query_as::<_, UserProfile>(
        "SELECT id, username, avatar, bio, mbti, zodiac, llm_api_key, llm_model, llm_base_url, created_at, updated_at 
         FROM user_profile WHERE id = 1"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("获取用户信息失败: {}", e))
}

async fn get_all_recipes_extended(pool: &Pool<Sqlite>) -> Result<Vec<RecipeExtended>, String> {
    sqlx::query_as::<_, RecipeExtended>(
        "SELECT id, name_zh, name_en, category, description, image_url, glass_type, difficulty,
                flavor_sweet, flavor_sour, flavor_bitter, flavor_strong, base_spirit,
                has_ice, has_sparkling, season, mood
         FROM recipes"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("获取酒款列表失败: {}", e))
}

async fn get_user_inventory(pool: &Pool<Sqlite>) -> Result<Vec<String>, String> {
    let items: Vec<(String,)> = sqlx::query_as(
        "SELECT ingredient_id FROM user_inventory"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("获取库存失败: {}", e))?;

    Ok(items.into_iter().map(|(id,)| id).collect())
}

async fn get_recipe_ingredients_map(pool: &Pool<Sqlite>) -> Result<HashMap<String, Vec<String>>, String> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT recipe_id, ingredient_id FROM recipe_ingredients WHERE is_optional = 0"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("获取配方原料失败: {}", e))?;

    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for (recipe_id, ingredient_id) in rows {
        map.entry(recipe_id).or_insert_with(Vec::new).push(ingredient_id);
    }

    Ok(map)
}

async fn get_recommendation_history(
    pool: &Pool<Sqlite>,
    user_id: i32,
    limit: i32,
) -> Result<Vec<RecommendationHistory>, String> {
    sqlx::query_as::<_, RecommendationHistory>(
        "SELECT * FROM recommendation_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("获取推荐历史失败: {}", e))
}

async fn save_recommendation_history(
    pool: &Pool<Sqlite>,
    user_id: i32,
    recipe_id: &str,
    request: &RecommendationRequest,
    user_profile: &UserProfile,
    score: f32,
    breakdown: &ScoreBreakdown,
    reason: &str,
    llm_model: Option<&str>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().timestamp();
    
    let mood_json = serde_json::to_string(&request.mood_tags).unwrap_or_else(|_| "[]".to_string());
    let breakdown_json = serde_json::to_string(breakdown).unwrap_or_else(|_| "{}".to_string());

    sqlx::query(
        "INSERT INTO recommendation_history 
         (id, user_id, recipe_id, mood_tags, weather, temperature, mbti, zodiac, 
          algorithm_score, score_breakdown, llm_reason, llm_model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(user_id)
    .bind(recipe_id)
    .bind(&mood_json)
    .bind(&request.weather)
    .bind(request.temperature)
    .bind(&user_profile.mbti)
    .bind(&user_profile.zodiac)
    .bind(score)
    .bind(&breakdown_json)
    .bind(reason)
    .bind(llm_model)
    .bind(now)
    .execute(pool)
    .await
    .map_err(|e| format!("保存推荐历史失败: {}", e))?;

    Ok(id)
}

async fn get_full_recipe(pool: &Pool<Sqlite>, recipe_id: &str) -> Result<Recipe, String> {
    sqlx::query_as::<_, Recipe>(
        "SELECT * FROM recipes WHERE id = ?"
    )
    .bind(recipe_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("获取酒款详情失败: {}", e))
}
