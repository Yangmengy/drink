use anyhow::{ensure, Context, Result};
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Row, SqliteConnection, SqlitePool,
};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::Duration,
};

mod legacy;

pub const SCHEMA_VERSION: i64 = 2;

/// The personal desktop app keeps the original data directory.
pub fn data_directory() -> Result<PathBuf> {
    let path = dirs::data_dir()
        .context("无法定位本地数据目录")?
        .join("cocktail-app");
    #[cfg(debug_assertions)]
    let path = std::env::var_os("MIXOLOGY_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or(path);
    std::fs::create_dir_all(&path)?;
    Ok(path)
}

pub async fn open(path: &Path) -> Result<SqlitePool> {
    let options = SqliteConnectOptions::new()
        .filename(path)
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;
    initialize(&pool).await?;
    Ok(pool)
}

// These are the columns the application reads/writes, not the entire historical schema.
// Extra columns and tables are deliberately accepted and preserved.
const REQUIRED_COLUMNS: &[(&str, &str)] = &[
    ("recipes", "id name_zh name_en category description method flavor_profile image_url source created_at updated_at"),
    ("ingredients", "id name_zh category created_at updated_at"),
    ("recipe_ingredients", "id recipe_id ingredient_id amount unit is_optional display_order created_at"),
    ("recipe_steps", "id recipe_id step_number instruction created_at"),
    ("user_inventory", "id ingredient_id added_at updated_at"),
    ("core_migrations", "version applied_at"),
    ("companion_settings", "id name preferences model base_url"),
    ("agent_traces", "id started_at duration_ms status events error"),
    ("user_profile", "id"),
];

async fn inspect(connection: &mut SqliteConnection) -> Result<i64> {
    let tables: HashSet<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
    )
    .fetch_all(&mut *connection)
    .await?
    .into_iter()
    .collect();
    if tables.is_empty() {
        return Ok(0);
    }
    for (table, required) in REQUIRED_COLUMNS {
        if !tables.contains(*table) {
            continue;
        }
        let columns: HashSet<String> = sqlx::query(&format!("PRAGMA table_info({table})"))
            .fetch_all(&mut *connection)
            .await?
            .iter()
            .map(|r| r.get("name"))
            .collect();
        let missing: Vec<_> = required
            .split_ascii_whitespace()
            .filter(|c| !columns.contains(*c))
            .collect();
        ensure!(
            missing.is_empty(),
            "数据库结构不兼容：{table} 缺少字段 {}；未执行迁移，请先备份并使用匹配的版本",
            missing.join(", ")
        );
    }
    let versions: Vec<i64> = if tables.contains("core_migrations") {
        sqlx::query_scalar("SELECT version FROM core_migrations ORDER BY version")
            .fetch_all(&mut *connection)
            .await?
    } else {
        vec![]
    };
    let version = versions.last().copied().unwrap_or(0);
    ensure!(
        version <= SCHEMA_VERSION,
        "数据库版本 {version} 高于本程序支持的 {SCHEMA_VERSION}；请使用更新版本，未执行迁移"
    );
    ensure!(
        versions == (1..=version).collect::<Vec<_>>(),
        "数据库迁移记录不连续，未执行迁移；请先备份并检查原数据库"
    );
    let required_tables = if version == 0 { 5 } else { 8 };
    for (table, _) in &REQUIRED_COLUMNS[..required_tables] {
        ensure!(
            tables.contains(*table),
            "数据库结构不兼容：缺少表 {table}；未执行迁移，请确认所选文件属于本应用"
        );
    }
    if version > 0 {
        let has_settings: bool =
            sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM companion_settings WHERE id=1)")
                .fetch_one(&mut *connection)
                .await?;
        ensure!(
            has_settings,
            "本地配置记录缺失，未执行迁移；请先备份并检查原数据库"
        );
    }
    Ok(version)
}

pub async fn initialize(pool: &SqlitePool) -> Result<()> {
    let mut tx = pool.begin().await?;
    // Reject unsupported/partial databases before creating tables or seeding any records.
    let version = inspect(&mut tx).await?;
    sqlx::raw_sql(include_str!("../../data/schema.sql"))
        .execute(&mut *tx)
        .await?;
    if version == 0 {
        sqlx::raw_sql(include_str!("../../data/seed.sql"))
            .execute(&mut *tx)
            .await?;
        sqlx::query("INSERT OR IGNORE INTO companion_settings (id) VALUES (1)")
            .execute(&mut *tx)
            .await?;
        legacy::import_profile(&mut tx).await?;
        sqlx::query("INSERT INTO core_migrations VALUES (1, strftime('%s','now'))")
            .execute(&mut *tx)
            .await?;
    }
    if version < 2 {
        // The unused legacy FTS data remains a historical snapshot; stop maintaining it.
        sqlx::raw_sql(
            "DROP TRIGGER IF EXISTS recipes_fts_insert;
             DROP TRIGGER IF EXISTS recipes_fts_update;
             DROP TRIGGER IF EXISTS recipes_fts_delete;
             INSERT INTO core_migrations VALUES (2, strftime('%s','now'));",
        )
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}
