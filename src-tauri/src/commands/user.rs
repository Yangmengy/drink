use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::error::AppError;

// ============================================
// 类型定义
// ============================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserProfile {
    pub id: i64,
    pub username: String,
    pub avatar: Option<String>,
    pub bio: Option<String>,
    pub mbti: Option<String>,
    pub zodiac: Option<String>,
    pub llm_api_key: Option<String>,
    pub llm_model: Option<String>,
    pub llm_base_url: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
pub struct UserStats {
    pub favorite_count: i64,
    pub history_count: i64,
    pub rating_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileArgs {
    pub username: Option<String>,
    pub avatar: Option<String>,
    pub bio: Option<String>,
}

// ============================================
// 命令实现
// ============================================

/// 获取用户信息
#[tauri::command]
pub async fn get_user_profile(pool: State<'_, SqlitePool>) -> Result<UserProfile, AppError> {
    let profile = sqlx::query_as::<sqlx::Sqlite, UserProfile>(
        "SELECT id, username, avatar, bio, mbti, zodiac, llm_api_key, llm_model, llm_base_url, created_at, updated_at FROM user_profile WHERE id = 1"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| AppError::NotFound(format!("User profile not found: {}", e)))?;

    Ok(profile)
}

/// 更新用户信息
#[tauri::command]
pub async fn update_user_profile(
    args: UpdateProfileArgs,
    pool: State<'_, SqlitePool>,
) -> Result<UserProfile, AppError> {
    let now = chrono::Utc::now().timestamp();

    // 获取当前用户信息
    let current = get_user_profile(pool.clone()).await?;

    // 更新字段
    let username = args.username.unwrap_or(current.username);
    let avatar = args.avatar.or(current.avatar);
    let bio = args.bio.or(current.bio);

    sqlx::query(
        "UPDATE user_profile SET username = ?, avatar = ?, bio = ?, updated_at = ? WHERE id = 1"
    )
    .bind(&username)
    .bind(&avatar)
    .bind(&bio)
    .bind(now)
    .execute(pool.inner())
    .await?;

    get_user_profile(pool).await
}

/// 获取用户统计数据
#[tauri::command]
pub async fn get_user_stats(pool: State<'_, SqlitePool>) -> Result<UserStats, AppError> {
    // 收藏数：以 recipes.is_favorite 为准（toggle_favorite 更新的是这个字段）
    let favorite_count = sqlx::query_scalar::<sqlx::Sqlite, i64>(
        "SELECT COUNT(*) FROM recipes WHERE is_favorite = 1"
    )
    .fetch_one(pool.inner())
    .await
    .unwrap_or(0);

    // 浏览历史数（去重）
    let history_count = sqlx::query_scalar::<sqlx::Sqlite, i64>(
        "SELECT COUNT(DISTINCT recipe_id) FROM history"
    )
    .fetch_one(pool.inner())
    .await
    .unwrap_or(0);

    // 评分数：以 drink_logs 有评分的记录为准（实际评分数据在这里）
    let rating_count = sqlx::query_scalar::<sqlx::Sqlite, i64>(
        "SELECT COUNT(*) FROM drink_logs WHERE rating IS NOT NULL AND rating > 0"
    )
    .fetch_one(pool.inner())
    .await
    .unwrap_or(0);

    Ok(UserStats {
        favorite_count,
        history_count,
        rating_count,
    })
}
