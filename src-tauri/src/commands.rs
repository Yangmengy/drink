use crate::{agent::Companion, menu, models::*, settings};
use std::path::PathBuf;
use tauri::State;

pub struct AppState {
    pub companion: Companion,
    pub directory: PathBuf,
}
fn error(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn list_ingredients(state: State<'_, AppState>) -> Result<Vec<Ingredient>, String> {
    menu::inventory(&state.companion.pool).await.map_err(error)
}
#[tauri::command]
pub async fn set_ingredient_owned(
    id: String,
    owned: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    menu::set_inventory(&state.companion.pool, &id, owned)
        .await
        .map_err(error)
}
#[tauri::command]
pub async fn search_menu(
    query: MenuQuery,
    state: State<'_, AppState>,
) -> Result<Vec<Recipe>, String> {
    menu::search(&state.companion.pool, &query)
        .await
        .map_err(error)
}
#[tauri::command]
pub async fn save_custom_recipe(
    input: RecipeInput,
    state: State<'_, AppState>,
) -> Result<String, String> {
    menu::save_custom(&state.companion.pool, &input)
        .await
        .map_err(error)
}
#[tauri::command]
pub async fn delete_custom_recipe(id: String, state: State<'_, AppState>) -> Result<(), String> {
    menu::delete_custom(&state.companion.pool, &id)
        .await
        .map_err(error)
}
#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    settings::get(&state.companion.pool, &state.directory)
        .await
        .map_err(error)
}
#[tauri::command]
pub async fn save_settings(
    input: SettingsInput,
    state: State<'_, AppState>,
) -> Result<Settings, String> {
    settings::save(&state.companion.pool, &state.directory, input)
        .await
        .map_err(error)
}
#[tauri::command]
pub async fn get_chat_history(state: State<'_, AppState>) -> Result<Vec<ChatMessage>, String> {
    state.companion.history().await.map_err(error)
}
#[tauri::command]
pub async fn clear_chat_history(state: State<'_, AppState>) -> Result<(), String> {
    state.companion.clear().await.map_err(error)
}
#[tauri::command]
pub async fn send_chat_message(
    message: String,
    state: State<'_, AppState>,
) -> Result<ChatMessage, String> {
    state
        .companion
        .reply_configured(&state.directory, &message)
        .await
        .map_err(error)
}

#[tauri::command]
pub async fn list_agent_traces(
    state: State<'_, AppState>,
) -> Result<Vec<crate::trace::AgentTrace>, String> {
    crate::trace::list(&state.companion.pool)
        .await
        .map_err(error)
}
