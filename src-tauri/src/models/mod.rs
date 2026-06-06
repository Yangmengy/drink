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
