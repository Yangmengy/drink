use serde::{Deserialize, Serialize};
use sqlx::types::Json;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlavorProfile {
    pub sweet: i32,
    pub sour: i32,
    pub bitter: i32,
    pub strong: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pairing {
    pub food: Vec<String>,
    pub music: Vec<String>,
}

/// 配方
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Recipe {
    pub id: String,
    pub name_zh: String,
    pub name_en: Option<String>,
    pub category: String,
    pub description: Option<String>,
    pub story: Option<String>,
    pub method: Option<String>,
    pub color: Option<String>,
    pub tags: Option<Json<Vec<String>>>,
    pub flavor_profile: Option<Json<FlavorProfile>>,
    pub occasion: Option<Json<Vec<String>>>,
    pub season: Option<Json<Vec<String>>>,
    pub mood: Option<Json<Vec<String>>>,
    pub origin: Option<String>,
    pub year_created: Option<i32>,
    pub creator: Option<String>,
    pub variations: Option<Json<Vec<String>>>,
    pub pairing: Option<Json<Pairing>>,
    pub image_url: Option<String>,
    pub glass_type: Option<String>,
    pub ice_type: Option<String>,
    pub garnish: Option<String>,
    pub abv: Option<f32>,
    pub difficulty: i32,
    pub prep_time: Option<i32>,
    pub source: Option<String>,
    pub is_iba: bool,
    pub is_favorite: bool,
    pub view_count: i32,
    pub last_viewed_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
    pub synced_at: Option<i64>,
}

/// 原料
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Ingredient {
    pub id: String,
    pub name_zh: String,
    pub name_en: Option<String>,
    pub category: String,
    pub subcategory: Option<String>,
    pub abv: Option<f32>,
    pub description: Option<String>,
    pub emoji: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub synced_at: Option<i64>,
}

/// 配方原料关联
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecipeIngredient {
    pub id: String,
    pub recipe_id: String,
    pub ingredient_id: String,
    pub amount: Option<f32>,
    pub unit: Option<String>,
    pub is_optional: bool,
    pub display_order: Option<i32>,
    pub created_at: i64,
}

/// 制作步骤
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecipeStep {
    pub id: String,
    pub recipe_id: String,
    pub step_number: i32,
    pub title: Option<String>,
    pub instruction: String,
    pub duration: Option<i32>,
    pub created_at: i64,
}

/// 库存项
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct InventoryItem {
    pub id: String,
    pub ingredient_id: String,
    pub amount: Option<f32>,
    pub unit: Option<String>,
    pub added_at: i64,
    pub updated_at: i64,
}

/// 用户偏好
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserPreference {
    pub id: String,
    pub preferred_language: String,
    pub theme: String,
    pub unit_system: String,
    pub difficulty_preference: Option<i32>,
    pub abv_preference: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

/// 搜索参数
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchArgs {
    pub query: Option<String>,
    pub category: Option<String>,
    pub difficulty: Option<i32>,
    pub max_abv: Option<f32>,
    pub has_ingredients: Option<Vec<String>>,
    pub is_iba: Option<bool>,
    pub limit: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomRecipeIngredientInput {
    pub ingredient_id: String,
    pub amount: f64,
    pub unit: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomRecipeDetails {
    pub name_en: Option<String>,
    pub description: Option<String>,
    pub method: Option<String>,
    pub glass_type: Option<String>,
    pub difficulty: Option<i32>,
    pub prep_time: Option<i32>,
    pub base_spirit: Option<String>,
    pub tags: Option<Vec<String>>,
    pub occasion: Option<Vec<String>>,
    pub season: Option<Vec<String>>,
    pub mood: Option<Vec<String>>,
    pub flavor_profile: Option<serde_json::Value>,
    pub ingredients: Option<Vec<CustomRecipeIngredientInput>>,
    pub steps: Option<Vec<String>>,
}

/// 配方过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeFilter {
    pub category: Option<String>,
    pub difficulty: Option<i32>,
    pub is_iba: Option<bool>,
    pub is_favorite: Option<bool>,
}

/// 完整配方详情 (包含原料和步骤)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeDetail {
    pub recipe: Recipe,
    pub ingredients: Vec<RecipeIngredientDetail>,
    pub steps: Vec<RecipeStep>,
}

/// 配方原料详情 (包含原料信息)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecipeIngredientDetail {
    pub recipe_ingredient: RecipeIngredient,
    pub ingredient: Ingredient,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DrinkLog {
    pub id: String,
    pub recipe_id: String,
    pub date_str: String,
    pub rating: Option<i32>,
    pub notes: Option<String>,
    pub images: Option<String>,
    pub created_at: i64,
    pub recipe: Option<Recipe>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TodoItem {
    pub id: String,
    pub recipe_id: String,
    pub created_at: i64,
    pub recipe: Recipe,
    pub owned_ingredients: i32,
    pub total_ingredients: i32,
}

// ============================================
// AI 调酒师模型
// ============================================

/// 用户个人资料 (扩展版)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserProfile {
    pub id: i32,
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

/// 推荐历史记录
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecommendationHistory {
    pub id: String,
    pub user_id: i32,
    pub recipe_id: String,
    pub mood_tags: String,                // JSON array
    pub weather: Option<String>,
    pub temperature: Option<f32>,
    pub mbti: Option<String>,
    pub zodiac: Option<String>,
    pub algorithm_score: f32,
    pub score_breakdown: Option<String>,  // JSON object
    pub llm_reason: Option<String>,
    pub llm_model: Option<String>,
    pub user_feedback: Option<i32>,
    pub feedback_at: Option<i64>,
    pub created_at: i64,
}

/// 推荐请求
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationRequest {
    pub mood_tags: Vec<String>,           // ["happy", "tired", "stressed"]
    pub weather: Option<String>,          // "sunny", "rainy", "cloudy", "snowy"
    pub temperature: Option<f32>,         // 摄氏度
    pub use_llm: bool,                    // 是否使用 LLM 生成推介词
}

/// 推荐响应
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationResponse {
    pub recipe: Recipe,
    pub score: f32,
    pub score_breakdown: ScoreBreakdown,
    pub reason: String,                   // LLM 生成的推介词 或 模板生成的推介词
    pub memory_context: Option<MemoryContext>,
    pub recommendation_id: String,        // 用于后续反馈
}

/// 评分详情
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScoreBreakdown {
    pub inventory: f32,
    pub mood: f32,
    pub weather: f32,
    pub mbti: f32,
    pub zodiac: f32,
    pub memory: f32,
    pub total: f32,
}

/// 记忆上下文
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryContext {
    pub total_recommendations: i32,
    pub recent_favorites: Vec<String>,    // 最近喜欢的酒款名称
    pub preference_summary: String,       // "您似乎偏好清爽的朗姆酒"
}

/// 推荐反馈
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecommendationFeedback {
    pub recommendation_id: String,
    pub feedback: i32,                    // 1=喜欢, 0=不喜欢
}

/// 待做清单项 (扩展版)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TodoItemExtended {
    pub id: String,
    pub recipe_id: String,
    pub source: String,
    pub mood_context: Option<String>,     // JSON array
    pub priority: i32,
    pub status: String,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub notes: Option<String>,
}

/// 扩展配方 (包含 AI 相关字段)
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RecipeExtended {
    // 基础字段
    pub id: String,
    pub name_zh: String,
    pub name_en: Option<String>,
    pub category: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub glass_type: Option<String>,
    pub difficulty: i32,
    
    // AI 相关字段
    pub flavor_sweet: Option<i32>,
    pub flavor_sour: Option<i32>,
    pub flavor_bitter: Option<i32>,
    pub flavor_strong: Option<i32>,
    pub base_spirit: Option<String>,
    pub has_ice: Option<i32>,
    pub has_sparkling: Option<i32>,
    pub season: Option<String>,
    pub mood: Option<String>,              // JSON array
}

/// 每日推荐统计
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DailyRecommendationStats {
    pub id: String,
    pub user_id: i32,
    pub date_str: String,
    pub total_recommendations: i32,
    pub likes: i32,
    pub dislikes: i32,
    pub created_at: i64,
    pub updated_at: i64,
}
