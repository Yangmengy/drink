pub mod agent;
mod local;
mod commands;
pub mod db;
pub mod menu;
pub mod models;
pub mod settings;
pub mod streaming;
pub mod trace;
use commands::*;
use std::sync::Arc;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_ingredients,
            add_ingredient,
            set_ingredient_owned,
            search_menu,
            save_custom_recipe,
            delete_custom_recipe,
            get_settings,
            save_settings,
            get_chat_history,
            clear_chat_history,
            send_chat_message,
            recommend_local,
            list_agent_traces
        ])
        .setup(|app| {
            let directory = db::data_directory()?;
            let state = tauri::async_runtime::block_on(async {
                let pool = db::open(&directory.join("cocktail.db")).await?;
                settings::migrate_key(&pool, &directory).await?;
                let session_url = format!(
                    "sqlite:{}?mode=rwc",
                    directory.join("cocktail-chat.db").display()
                );
                let sessions = adk_session::SqliteSessionService::new(&session_url).await?;
                sessions.migrate().await?;
                let companion = agent::Companion::new(pool, Arc::new(sessions)).await?;
                anyhow::Ok(AppState {
                    companion,
                    directory,
                })
            })?;
            app.manage(state);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Mixology 启动失败，请检查本地数据库与应用日志");
}
