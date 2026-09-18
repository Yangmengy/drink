use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Flavor {
    pub sweet: i32,
    pub sour: i32,
    pub bitter: i32,
    pub strong: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Ingredient {
    pub id: String,
    pub name: String,
    pub category: String,
    pub owned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RecipeIngredient {
    pub id: String,
    pub name: String,
    pub amount: Option<f64>,
    pub unit: Option<String>,
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Recipe {
    pub id: String,
    pub name: String,
    pub name_en: String,
    pub description: String,
    pub category: String,
    pub source: String,
    pub image: Option<String>,
    pub method: String,
    pub flavor: Option<Flavor>,
    pub ingredients: Vec<RecipeIngredient>,
    pub steps: Vec<String>,
    pub missing: Vec<String>,
    pub can_make: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngredientInput {
    pub name: String,
    pub amount: f64,
    pub unit: String,
    #[serde(default)]
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecipeInput {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
    pub method: String,
    pub flavor: Flavor,
    pub ingredients: Vec<IngredientInput>,
    pub steps: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, schemars::JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct MenuQuery {
    /// A short cocktail name or ingredient keyword. Empty means browse all. Do not pass the full conversation.
    #[serde(default)]
    pub query: String,
    pub max_sweet: Option<i32>,
    pub min_sour: Option<i32>,
    pub max_strong: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub name: String,
    pub preferences: String,
    pub model: String,
    pub base_url: String,
    pub api_key_configured: bool,
    pub data_directory: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsInput {
    pub name: String,
    pub preferences: String,
    pub model: String,
    pub base_url: String,
    /// None preserves the existing key; an empty string explicitly clears it.
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub trace_id: Option<String>,
    pub id: String,
    pub role: String,
    pub text: String,
    pub recipes: Vec<Recipe>,
}
