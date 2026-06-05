// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod db;
mod models;

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

    tauri::Builder::default()
        .manage(pool)
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // 配方相关命令
            search_recipes,
            get_recipe_by_id,
            get_recipes,
            get_recommended_recipes,
            get_favorite_recipes,
            toggle_favorite,
            get_recipe_history,
            add_to_history,
            
            // 库存相关命令
            get_inventory,
            add_to_inventory,
            remove_from_inventory,
            get_all_ingredients,
            get_ingredients_by_category,
            search_ingredients,
            get_recipes_by_inventory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
