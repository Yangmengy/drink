// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;
mod recommendation;
pub mod error;
pub mod repositories;
pub mod services;

use commands::*;

#[tokio::main]
async fn main() {
    // 初始化数据库
    let pool = db::init_database()
        .await
        .expect("Failed to initialize database");
    
    println!("Database initialized successfully!");
    
    // 健康检查
    match db::health_check(&pool).await {
        Ok(true) => println!("Database health check: OK"),
        Ok(false) => println!("Database health check: FAILED"),
        Err(e) => println!("Database health check error: {}", e),
    }

    let session_service = std::sync::Arc::new(
        init_session_service().await.expect("Failed to initialize chat session service")
    );

    tauri::Builder::default()
        .manage(pool)
        .manage(session_service)
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
