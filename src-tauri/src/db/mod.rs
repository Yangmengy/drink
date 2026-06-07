use sqlx::{sqlite::SqlitePool, Row};
use std::path::PathBuf;
use anyhow::Result;

/// 获取数据库文件路径
fn get_db_path() -> Result<PathBuf> {
    println!("📂 [PATH] Getting database path...");
    eprintln!("📂 [PATH] Getting database path...");
    
    // 优先使用 app-specific 目录（Android 上更可靠）
    let base_path = if cfg!(target_os = "android") {
        println!("📂 [PATH] Platform: Android");
        eprintln!("📂 [PATH] Platform: Android");
        
        // 尝试多个环境变量
        let home = std::env::var("HOME");
        let tmpdir = std::env::var("TMPDIR");
        let external = std::env::var("EXTERNAL_STORAGE");
        
        println!("📂 [PATH] HOME = {:?}", home);
        eprintln!("📂 [PATH] HOME = {:?}", home);
        println!("📂 [PATH] TMPDIR = {:?}", tmpdir);
        eprintln!("📂 [PATH] TMPDIR = {:?}", tmpdir);
        println!("📂 [PATH] EXTERNAL_STORAGE = {:?}", external);
        eprintln!("📂 [PATH] EXTERNAL_STORAGE = {:?}", external);
        
        // Android: 使用内部存储，不需要额外权限
        let path = std::env::var("HOME")
            .or_else(|_| std::env::var("TMPDIR"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                println!("📂 [PATH] Using fallback path: /data/local/tmp");
                eprintln!("📂 [PATH] Using fallback path: /data/local/tmp");
                PathBuf::from("/data/local/tmp")
            });
        
        println!("📂 [PATH] Selected base path: {:?}", path);
        eprintln!("📂 [PATH] Selected base path: {:?}", path);
        path
    } else {
        println!("📂 [PATH] Platform: Desktop");
        eprintln!("📂 [PATH] Platform: Desktop");
        
        let path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
        println!("📂 [PATH] Selected base path: {:?}", path);
        eprintln!("📂 [PATH] Selected base path: {:?}", path);
        path
    };
    
    let mut path = base_path;
    path.push("cocktail-app");
    
    println!("📂 [PATH] App directory: {:?}", path);
    eprintln!("📂 [PATH] App directory: {:?}", path);
    println!("📂 [PATH] Directory exists: {}", path.exists());
    eprintln!("📂 [PATH] Directory exists: {}", path.exists());
    
    // 创建目录，如果失败则返回错误
    println!("📂 [PATH] Creating directory...");
    eprintln!("📂 [PATH] Creating directory...");
    
    std::fs::create_dir_all(&path)
        .map_err(|e| {
            eprintln!("📂 [PATH] ❌ Failed to create directory: {}", e);
            eprintln!("📂 [PATH] ❌ Error kind: {:?}", e.kind());
            anyhow::anyhow!("Failed to create data directory: {}", e)
        })?;
    
    println!("📂 [PATH] ✅ Directory created/verified");
    eprintln!("📂 [PATH] ✅ Directory created/verified");
    
    path.push("cocktail.db");
    
    println!("📂 [PATH] Final database path: {}", path.display());
    eprintln!("📂 [PATH] Final database path: {}", path.display());
    println!("📂 [PATH] Database file exists: {}", path.exists());
    eprintln!("📂 [PATH] Database file exists: {}", path.exists());
    
    Ok(path)
}

/// 初始化数据库连接池
pub async fn init_database() -> Result<SqlitePool> {
    println!("📊 [DB] Getting database path...");
    eprintln!("📊 [DB] Getting database path...");
    
    let db_path = get_db_path()?;
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    
    println!("📊 [DB] Database path: {}", db_path.display());
    eprintln!("📊 [DB] Database path: {}", db_path.display());
    println!("📊 [DB] Database URL: {}", db_url);
    eprintln!("📊 [DB] Database URL: {}", db_url);
    
    // 检查父目录是否存在
    if let Some(parent) = db_path.parent() {
        println!("📊 [DB] Parent directory: {:?}", parent);
        eprintln!("📊 [DB] Parent directory: {:?}", parent);
        println!("📊 [DB] Parent exists: {}", parent.exists());
        eprintln!("📊 [DB] Parent exists: {}", parent.exists());
    }
    
    // 创建连接池
    println!("📊 [DB] Connecting to database...");
    eprintln!("📊 [DB] Connecting to database...");
    
    let pool = SqlitePool::connect(&db_url).await
        .map_err(|e| {
            eprintln!("📊 [DB] ❌ Connection failed: {}", e);
            eprintln!("📊 [DB] ❌ Error details: {:?}", e);
            anyhow::anyhow!("Failed to connect to database: {}", e)
        })?;
    
    println!("📊 [DB] ✅ Connected successfully");
    eprintln!("📊 [DB] ✅ Connected successfully");
    
    // 执行 Schema
    println!("📊 [DB] Creating database schema...");
    eprintln!("📊 [DB] Creating database schema...");
    
    let schema = include_str!("../../data/schema.sql");
    sqlx::query(schema).execute(&pool).await
        .map_err(|e| {
            eprintln!("📊 [DB] ❌ Schema creation failed: {}", e);
            eprintln!("📊 [DB] ❌ Error details: {:?}", e);
            anyhow::anyhow!("Failed to create schema: {}", e)
        })?;
    
    println!("📊 [DB] ✅ Schema created");
    eprintln!("📊 [DB] ✅ Schema created");
    
    // 向后兼容迁移：尝试给 drink_logs 添加 images 字段
    println!("📊 [DB] Running migrations...");
    eprintln!("📊 [DB] Running migrations...");
    
    let _ = sqlx::query("ALTER TABLE drink_logs ADD COLUMN images TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN bio TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN mbti TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN zodiac TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN llm_api_key TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN llm_model TEXT").execute(&pool).await;
    let _ = sqlx::query("ALTER TABLE user_profile ADD COLUMN llm_base_url TEXT").execute(&pool).await;
    
    println!("📊 [DB] ✅ Migrations completed");
    eprintln!("📊 [DB] ✅ Migrations completed");
    
    // 检查是否需要初始化数据
    println!("📊 [DB] Checking for existing data...");
    eprintln!("📊 [DB] Checking for existing data...");
    
    let count: i64 = sqlx::query("SELECT COUNT(*) as count FROM recipes")
        .fetch_one(&pool)
        .await
        .map_err(|e| {
            eprintln!("📊 [DB] ❌ Query failed: {}", e);
            anyhow::anyhow!("Failed to query recipes: {}", e)
        })?
        .get("count");
    
    println!("📊 [DB] Found {} recipes", count);
    eprintln!("📊 [DB] Found {} recipes", count);
    
    if count == 0 {
        println!("📊 [DB] Seeding initial data...");
        eprintln!("📊 [DB] Seeding initial data...");
        
        let seed = include_str!("../../data/seed.sql");
        sqlx::query(seed).execute(&pool).await
            .map_err(|e| {
                eprintln!("📊 [DB] ❌ Seeding failed: {}", e);
                anyhow::anyhow!("Failed to seed data: {}", e)
            })?;
        
        println!("📊 [DB] ✅ Database seeded with 3 recipes");
        eprintln!("📊 [DB] ✅ Database seeded with 3 recipes");
    } else {
        println!("📊 [DB] ✅ Database already has {} recipes", count);
        eprintln!("📊 [DB] ✅ Database already has {} recipes", count);
    }
    
    println!("📊 [DB] 🎉 Database initialization complete!");
    eprintln!("📊 [DB] 🎉 Database initialization complete!");
    
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
