use sqlx::{sqlite::SqlitePool, Row};
use std::path::PathBuf;
use anyhow::Result;

/// 获取数据库文件路径
fn get_db_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("cocktail-app");
    std::fs::create_dir_all(&path).ok();
    path.push("cocktail.db");
    path
}

/// 初始化数据库连接池
pub async fn init_database() -> Result<SqlitePool> {
    let db_path = get_db_path();
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    
    println!("Initializing database at: {}", db_path.display());
    
    // 创建连接池
    let pool = SqlitePool::connect(&db_url).await?;
    
    // 执行 Schema
    println!("Creating database schema...");
    let schema = include_str!("../../data/schema.sql");
    sqlx::query(schema).execute(&pool).await?;
    
    // 向后兼容迁移：尝试给 drink_logs 添加 images 字段
    let _ = sqlx::query("ALTER TABLE drink_logs ADD COLUMN images TEXT").execute(&pool).await;
    
    // 检查是否需要初始化数据
    let count: i64 = sqlx::query("SELECT COUNT(*) as count FROM recipes")
        .fetch_one(&pool)
        .await?
        .get("count");
    
    if count == 0 {
        println!("Seeding initial data...");
        let seed = include_str!("../../data/seed.sql");
        sqlx::query(seed).execute(&pool).await?;
        println!("Database initialized with {} recipes", 3);
    } else {
        println!("Database already initialized with {} recipes", count);
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
