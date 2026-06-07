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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 在最开始就输出日志
    println!("🚀 ========== APP STARTING ==========");
    eprintln!("🚀 ========== APP STARTING ==========");
    
    #[cfg(target_os = "android")]
    {
        use std::panic;
        panic::set_hook(Box::new(|panic_info| {
            eprintln!("💥 PANIC: {:?}", panic_info);
            let msg = format!("💥 PANIC: {:?}", panic_info);
            // 尝试写入文件
            let _ = std::fs::write("/sdcard/cocktail_crash.log", msg);
        }));
    }
    
    tauri::async_runtime::block_on(async {
        println!("📱 Step 1: Starting async runtime");
        eprintln!("📱 Step 1: Starting async runtime");
        
        // 初始化数据库
        println!("📱 Step 2: Initializing database...");
        eprintln!("📱 Step 2: Initializing database...");
        
        let pool = match db::init_database().await {
            Ok(pool) => {
                println!("✅ Database initialized successfully!");
                eprintln!("✅ Database initialized successfully!");
                pool
            }
            Err(e) => {
                eprintln!("❌ Failed to initialize database: {}", e);
                eprintln!("Error details: {:?}", e);
                eprintln!("Please check:");
                eprintln!("1. App has storage permissions");
                eprintln!("2. Device has enough storage space");
                eprintln!("3. SQLite is available on the device");
                
                // 写入文件以便查看
                #[cfg(target_os = "android")]
                {
                    let error_msg = format!("Database init failed: {}\nDetails: {:?}", e, e);
                    let _ = std::fs::write("/sdcard/cocktail_error.log", error_msg);
                }
                
                panic!("Cannot start app without database: {}", e);
            }
        };
        
        println!("📱 Step 3: Database health check...");
        eprintln!("📱 Step 3: Database health check...");
        
        // 健康检查
        match db::health_check(&pool).await {
            Ok(true) => {
                println!("✅ Database health check: OK");
                eprintln!("✅ Database health check: OK");
            }
            Ok(false) => {
                println!("⚠️ Database health check: FAILED");
                eprintln!("⚠️ Database health check: FAILED");
            }
            Err(e) => {
                println!("❌ Database health check error: {}", e);
                eprintln!("❌ Database health check error: {}", e);
            }
        }

        println!("📱 Step 4: Initializing session service...");
        eprintln!("📱 Step 4: Initializing session service...");
        
        let session_service = match init_session_service().await {
            Ok(service) => {
                println!("✅ Chat session service initialized");
                eprintln!("✅ Chat session service initialized");
                std::sync::Arc::new(service)
            }
            Err(e) => {
                eprintln!("❌ Failed to initialize chat session service: {}", e);
                eprintln!("Error details: {:?}", e);
                
                #[cfg(target_os = "android")]
                {
                    let error_msg = format!("Session service init failed: {}\nDetails: {:?}", e, e);
                    let _ = std::fs::write("/sdcard/cocktail_session_error.log", error_msg);
                }
                
                panic!("Cannot start app without session service: {}", e);
            }
        };
        
        println!("📱 Step 5: Initializing memory service...");
        eprintln!("📱 Step 5: Initializing memory service...");
        
        let memory_service = match init_memory_service().await {
            Ok(service) => {
                println!("✅ Memory service initialized");
                eprintln!("✅ Memory service initialized");
                std::sync::Arc::new(service)
            }
            Err(e) => {
                eprintln!("❌ Failed to initialize memory service: {}", e);
                eprintln!("Error details: {:?}", e);
                
                #[cfg(target_os = "android")]
                {
                    let error_msg = format!("Memory service init failed: {}\nDetails: {:?}", e, e);
                    let _ = std::fs::write("/sdcard/cocktail_memory_error.log", error_msg);
                }
                
                panic!("Cannot start app without memory service: {}", e);
            }
        };
        
        println!("📱 Step 6: Building Tauri app...");
        eprintln!("📱 Step 6: Building Tauri app...");

        tauri::Builder::default()
            .manage(pool)
            .manage(session_service)
            .manage(memory_service)
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
                println!("📱 Step 7: Tauri setup hook");
                eprintln!("📱 Step 7: Tauri setup hook");
                Ok(())
            })
            .run(tauri::generate_context!())
            .expect("error while running tauri application");
        
        println!("🎉 App started successfully!");
        eprintln!("🎉 App started successfully!");
    });
}
