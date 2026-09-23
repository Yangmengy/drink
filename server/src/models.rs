use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Flavor {
    pub sweet: i32,
    pub sour: i32,
    pub bitter: i32,
    pub strong: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Ingredient {
    pub id: String,
    pub name: String,
    pub category: String,
    pub owned: bool,
}

fn default_owned() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewIngredientInput {
    pub name: String,
    pub category: String,
    #[serde(default = "default_owned")]
    pub owned: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddIngredientResult {
    pub ingredient: Ingredient,
    pub created: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedInput {
    pub owned: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RecipeIngredient {
    pub id: String,
    #[serde(skip)]
    pub ingredient_id: String,
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
    #[serde(skip)]
    pub score: f64,
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
    #[serde(default)]
    pub query: String,
    pub max_sweet: Option<i32>,
    pub min_sour: Option<i32>,
    pub max_strong: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LocalAvailability {
    Ready,
    MissingOne,
    Any,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRecommendationInput {
    pub availability: LocalAvailability,
    #[serde(default)]
    pub query: MenuQuery,
    #[serde(default)]
    pub after_trace_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalReplyMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    pub recipes: Vec<Recipe>,
    pub trace_id: Option<String>,
    pub mode: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalRecommendationResult {
    pub request: String,
    pub message: LocalReplyMessage,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
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
    #[serde(default)]
    pub api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub text: String,
    #[serde(default)]
    pub recipes: Vec<Recipe>,
    #[serde(default)]
    pub trace_id: Option<String>,
    #[serde(default = "default_agent_mode")]
    pub mode: String,
}

fn default_agent_mode() -> String {
    "agent".to_owned()
}

#[derive(Debug, Deserialize)]
pub struct MemoryListQuery {
    #[serde(default)]
    pub include_inactive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEvent {
    pub phase: String,
    pub elapsed_ms: u128,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTrace {
    pub id: String,
    pub started_at: i64,
    pub duration_ms: i32,
    pub status: String,
    pub events: Vec<TraceEvent>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSendInput {
    pub message: String,
    #[serde(default)]
    pub api_key: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AgentContext {
    pub profile: serde_json::Value,
    pub memories: Vec<MemoryContextItem>,
}

#[derive(Debug, Clone)]
pub struct MemoryContextItem {
    pub kind: String,
    pub content: String,
    pub confidence: f64,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}
