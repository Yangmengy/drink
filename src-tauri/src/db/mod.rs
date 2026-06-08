use sqlx::{sqlite::SqlitePool, Row};
use std::path::PathBuf;
use anyhow::Result;
use tauri::Manager;  // 需要这个 trait 来使用 path() 方法

/// 从 Tauri 资源加载 seed.sql
/// Android: 从 APK 资源读取，桌面: 从文件系统读取
fn load_seed_sql(app_handle: Option<&tauri::AppHandle>) -> Result<String> {
    #[cfg(target_os = "android")]
    {
        if let Some(handle) = app_handle {
            let resolver = handle.path();
            
            // 尝试从 APK assets 读取 seed.sql
            if let Ok(resource_dir) = resolver.resource_dir() {
                let seed_path = resource_dir.as_path().join("seed.sql");
                
                if let Ok(content) = std::fs::read_to_string(&seed_path) {
                    return Ok(content);
                }
            }
        }
        
        // Fallback: 如果 assets 读取失败，返回空 SQL（应用启动时会是空数据库）
        // 这样可以避免将大量数据编译进 .so 文件
        Ok(String::new())
    }
    
    #[cfg(not(target_os = "android"))]
    {
        // 桌面版：继续使用编译时嵌入
        Ok(include_str!("../../data/seed.sql").to_string())
    }
}

/// 初始化 Android assets
/// 这个函数在有 AppHandle 之前被调用，只做基础检查
pub fn init_android_assets() -> Result<()> {
    #[cfg(target_os = "android")]
    {
        let cache_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("TMPDIR"))
            .unwrap_or_else(|_| "/data/local/tmp".to_string());
        
        let cocktail_dir = format!("{}/cocktail-app", cache_dir);
        std::fs::create_dir_all(&cocktail_dir)?;
    }
    
    Ok(())
}

/// 获取数据库文件路径
fn get_db_path() -> Result<PathBuf> {
    let base_path = if cfg!(target_os = "android") {
        std::env::var("HOME")
            .or_else(|_| std::env::var("TMPDIR"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("/data/local/tmp"))
    } else {
        dirs::data_dir().unwrap_or_else(|| PathBuf::from("."))
    };
    
    let mut path = base_path;
    path.push("cocktail-app");
    
    std::fs::create_dir_all(&path)
        .map_err(|e| anyhow::anyhow!("Failed to create data directory: {}", e))?;
    
    path.push("cocktail.db");
    
    Ok(path)
}

/// 初始化数据库连接池
pub async fn init_database(app_handle: Option<&tauri::AppHandle>) -> Result<SqlitePool> {
    let db_path = get_db_path()?;
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    
    let pool = SqlitePool::connect(&db_url).await
        .map_err(|e| anyhow::anyhow!("Failed to connect to database: {}", e))?;
    
    let schema = include_str!("../../data/schema.sql");
    sqlx::query(schema).execute(&pool).await
        .map_err(|e| anyhow::anyhow!("Failed to create schema: {}", e))?;
    
    let _ = sqlx::query("ALTER TABLE drink_logs ADD COLUMN images TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN bio TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN mbti TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN zodiac TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN llm_api_key TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN llm_model TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN llm_base_url TEXT").execute(&pool).await;
    
    let count: i64 = sqlx::query("SELECT COUNT(*) as count FROM recipes")
        .fetch_one(&pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query recipes: {}", e))?
        .get("count");
    
    if count == 0 {
        let seed = load_seed_sql(app_handle)?;
        
        sqlx::query(&seed).execute(&pool).await
            .map_err(|e| anyhow::anyhow!("Failed to seed data: {}", e))?;
    }
    
    Ok(pool)
}

/// 执行数据库迁移（未来扩展用）
pub async fn migrate_database(_pool: &SqlitePool) -> Result<()> {
    // 预留给未来的数据库迁移逻辑
    Ok(())
}

/// 数据库健康检查
pub async fn health_check(pool: &SqlitePool) -> Result<bool> {
    let result: i64 = sqlx::query("SELECT 1")
        .fetch_one(pool)
        .await?
        .get(0);
    
    Ok(result == 1)
}
