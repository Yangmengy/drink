// Tauri Library Entry Point for Mobile Platforms
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;
mod recommendation;
pub mod error;
pub mod repositories;
pub mod services;

use commands::*;
use tauri::Manager;  // 需要这个 trait 来使用 manage() 方法

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "android")]
    {
        if let Err(_) = db::init_android_assets() {
            // Silent failure - continue anyway
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // 配方相关命令
            search_recipes,
            get_recipe_by_id,
            get_recipes,
            create_custom_recipe,
            update_recipe_image,
            delete_recipe,
            get_recommended_recipes,
            get_favorite_recipes,
            toggle_favorite,
            get_recipe_history,
            add_to_history,
            
            // 库存相关命令
            commands::inventory::get_inventory,
            commands::inventory::add_to_inventory,
            commands::inventory::remove_from_inventory,
            commands::inventory::get_all_ingredients,
            commands::inventory::create_custom_ingredient,
            commands::inventory::get_ingredients_by_category,
            commands::inventory::search_ingredients,
            commands::inventory::get_recipes_by_inventory,
            
            // 图片相关命令
            get_image_url,
            upload_image,
            
            // 待做相关命令
            get_todos,
            add_todo,
            remove_todo,
            is_todo,
            
            // 记录相关命令
            get_drink_logs,
            add_drink_log,
            delete_drink_log,
            
            // 用户相关命令
            get_user_profile,
            update_user_profile,
            get_user_stats,
            update_mood_weather,
            
            // AI 调酒师命令
            get_ai_recommendation,
            submit_recommendation_feedback,
            add_to_todo_from_ai,
            get_todo_list_extended,
            update_todo_status,
            update_user_personality,
            update_llm_config,
            get_user_recommendation_history,
            
            // Chat commands
            send_chat_message,
            get_chat_history,
            clear_chat_history,
            

        ])
        .setup(|app| {
            let handle = app.handle().clone();
            
            // 异步初始化数据库
            tauri::async_runtime::block_on(async move {
                let pool = match db::init_database(Some(&handle)).await {
                    Ok(pool) => pool,
                    Err(_) => panic!("Cannot start app without database"),
                };
                
                let _ = db::health_check(&pool).await;

                let session_service = match init_session_service().await {
                    Ok(service) => std::sync::Arc::new(service),
                    Err(_) => panic!("Cannot start app without session service"),
                };
                
                let memory_service = match init_memory_service().await {
                    Ok(service) => std::sync::Arc::new(service),
                    Err(_) => panic!("Cannot start app without memory service"),
                };
                
                handle.manage(pool);
                handle.manage(session_service);
                handle.manage(memory_service);
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
