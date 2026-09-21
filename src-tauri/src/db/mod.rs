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

pub const SCHEMA_VERSION: i64 = 3;

/// The personal desktop app keeps the original data directory.
pub fn data_directory() -> Result<PathBuf> {
    let path = dirs::data_dir()
        .context("无法定位本地数据目录")?
        .join("cocktail-app");
    #[cfg(debug_assertions)]
    let path = std::env::var_os("BARTENDER_DATA_DIR")
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
    if version >= 3 {
        let ingredient_columns: HashSet<String> = sqlx::query("PRAGMA table_info(ingredients)")
            .fetch_all(&mut *connection)
            .await?
            .iter()
            .map(|r| r.get("name"))
            .collect();
        ensure!(
            ingredient_columns.contains("name_key"),
            "数据库结构不兼容：ingredients 缺少字段 name_key；未执行迁移，请先备份并使用匹配的版本"
        );
        let indexes: HashSet<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type='index' AND name IN (
                 'uq_user_inventory_ingredient_id',
                 'uq_recipe_ingredients_recipe_ingredient',
                 'uq_recipe_steps_recipe_step_number',
                 'uq_ingredients_name_key'
             )",
        )
        .fetch_all(&mut *connection)
        .await?
        .into_iter()
        .collect();
        for index in [
            "uq_user_inventory_ingredient_id",
            "uq_recipe_ingredients_recipe_ingredient",
            "uq_recipe_steps_recipe_step_number",
            "uq_ingredients_name_key",
        ] {
            ensure!(
                indexes.contains(index),
                "数据库结构不兼容：缺少唯一索引 {index}；未执行迁移，请先备份并使用匹配的版本"
            );
        }
    }
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
    if version < 3 {
        migrate_relationship_constraints(&mut tx).await?;
        sqlx::query("INSERT INTO core_migrations VALUES (3, strftime('%s','now'))")
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Version 3 moves relationship invariants that were previously enforced only
/// by application transactions into SQLite indexes. Historical rows are
/// normalized first so databases from older versions can be upgraded in place.
async fn migrate_relationship_constraints(connection: &mut SqliteConnection) -> Result<()> {
    let has_name_key: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('ingredients') WHERE name='name_key')",
    )
    .fetch_one(&mut *connection)
    .await?;
    if !has_name_key {
        sqlx::query("ALTER TABLE ingredients ADD COLUMN name_key TEXT NOT NULL DEFAULT ''")
            .execute(&mut *connection)
            .await?;
    }

    // Keep the newest inventory row for each ingredient. Inventory represents a
    // boolean ownership state, so older duplicates carry no additional meaning.
    sqlx::raw_sql(
        "DELETE FROM user_inventory
         WHERE id IN (
             SELECT id FROM (
                 SELECT id, ROW_NUMBER() OVER (
                     PARTITION BY ingredient_id
                     ORDER BY updated_at DESC, added_at DESC, rowid DESC
                 ) AS row_number
                 FROM user_inventory
             ) WHERE row_number <> 1
         );",
    )
    .execute(&mut *connection)
    .await?;

    // Keep the first displayed occurrence of an ingredient in each recipe.
    sqlx::raw_sql(
        "DELETE FROM recipe_ingredients
         WHERE id IN (
             SELECT id FROM (
                 SELECT id, ROW_NUMBER() OVER (
                     PARTITION BY recipe_id, ingredient_id
                     ORDER BY COALESCE(display_order, 2147483647), rowid
                 ) AS row_number
                 FROM recipe_ingredients
             ) WHERE row_number <> 1
         );",
    )
    .execute(&mut *connection)
    .await?;

    // Keep the first historical row for each duplicate step number, then
    // normalize every recipe to a stable 1..n sequence.
    sqlx::raw_sql(
        "DELETE FROM recipe_steps
         WHERE id IN (
             SELECT id FROM (
                 SELECT id, ROW_NUMBER() OVER (
                     PARTITION BY recipe_id, step_number ORDER BY rowid
                 ) AS row_number
                 FROM recipe_steps
             ) WHERE row_number <> 1
         );",
    )
    .execute(&mut *connection)
    .await?;
    let recipe_ids: Vec<String> =
        sqlx::query_scalar("SELECT DISTINCT recipe_id FROM recipe_steps ORDER BY recipe_id")
            .fetch_all(&mut *connection)
            .await?;
    for recipe_id in recipe_ids {
        let step_ids: Vec<String> =
            sqlx::query_scalar("SELECT id FROM recipe_steps WHERE recipe_id=? ORDER BY rowid")
                .bind(&recipe_id)
                .fetch_all(&mut *connection)
                .await?;
        for (index, step_id) in step_ids.iter().enumerate() {
            sqlx::query("UPDATE recipe_steps SET step_number=? WHERE id=?")
                .bind(-((index + 1) as i32))
                .bind(step_id)
                .execute(&mut *connection)
                .await?;
        }
        for (index, step_id) in step_ids.iter().enumerate() {
            sqlx::query("UPDATE recipe_steps SET step_number=? WHERE id=?")
                .bind(index as i32 + 1)
                .bind(step_id)
                .execute(&mut *connection)
                .await?;
        }
    }

    // Use Rust's Unicode-aware trim/lowercase rules. SQLite NOCASE cannot
    // represent the equality semantics already used by the application.
    let ingredients: Vec<(String, String)> =
        sqlx::query_as("SELECT id, name_zh FROM ingredients ORDER BY created_at, id, rowid")
            .fetch_all(&mut *connection)
            .await?;
    let mut canonical_ingredients: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut duplicate_groups: std::collections::HashMap<String, Vec<String>> =
        std::collections::HashMap::new();
    for (id, name) in ingredients {
        let name_key = name.trim().to_lowercase();
        sqlx::query("UPDATE ingredients SET name_key=? WHERE id=?")
            .bind(&name_key)
            .bind(&id)
            .execute(&mut *connection)
            .await?;
        canonical_ingredients
            .entry(name_key.clone())
            .or_insert_with(|| id.clone());
        duplicate_groups.entry(name_key).or_default().push(id);
    }

    for (name_key, ids) in duplicate_groups {
        let Some(canonical_id) = canonical_ingredients.get(&name_key).cloned() else {
            continue;
        };
        for duplicate_id in ids.iter().filter(|id| **id != canonical_id) {
            // If aliases for the same normalized ingredient were used in one
            // recipe, retain the row displayed first and point it at the
            // canonical ingredient.
            let links: Vec<(String, String, Option<i32>, i64)> = sqlx::query_as(
                "SELECT id, recipe_id, display_order, rowid
                 FROM recipe_ingredients
                 WHERE ingredient_id IN (?, ?)
                 ORDER BY recipe_id, COALESCE(display_order, 2147483647), rowid",
            )
            .bind(&canonical_id)
            .bind(duplicate_id)
            .fetch_all(&mut *connection)
            .await?;
            let mut preferred_by_recipe: std::collections::HashMap<
                String,
                (String, Option<i32>, i64),
            > = std::collections::HashMap::new();
            for (link_id, recipe_id, display_order, rowid) in links {
                let preferred = preferred_by_recipe.entry(recipe_id).or_insert((
                    link_id.clone(),
                    display_order,
                    rowid,
                ));
                if (display_order.unwrap_or(i32::MAX), rowid)
                    < (preferred.1.unwrap_or(i32::MAX), preferred.2)
                {
                    *preferred = (link_id, display_order, rowid);
                }
            }
            for (recipe_id, (preferred_id, _, _)) in preferred_by_recipe {
                sqlx::query(
                    "DELETE FROM recipe_ingredients
                     WHERE recipe_id=? AND id<>? AND ingredient_id IN (?, ?)",
                )
                .bind(&recipe_id)
                .bind(&preferred_id)
                .bind(&canonical_id)
                .bind(duplicate_id)
                .execute(&mut *connection)
                .await?;
                sqlx::query("UPDATE recipe_ingredients SET ingredient_id=? WHERE id=?")
                    .bind(&canonical_id)
                    .bind(&preferred_id)
                    .execute(&mut *connection)
                    .await?;
            }

            // Preserve the newest ownership row and any legacy quantity
            // columns it carries, then remove the duplicate ingredient.
            let inventory_rows: Vec<(String, i64, i64, i64)> = sqlx::query_as(
                "SELECT id, added_at, updated_at, rowid
                 FROM user_inventory
                 WHERE ingredient_id IN (?, ?)
                 ORDER BY updated_at DESC, added_at DESC, rowid DESC",
            )
            .bind(&canonical_id)
            .bind(duplicate_id)
            .fetch_all(&mut *connection)
            .await?;
            if let Some((newest_id, _, _, _)) = inventory_rows.first() {
                for (inventory_id, _, _, _) in inventory_rows.iter().skip(1) {
                    sqlx::query("DELETE FROM user_inventory WHERE id=?")
                        .bind(inventory_id)
                        .execute(&mut *connection)
                        .await?;
                }
                sqlx::query("UPDATE user_inventory SET ingredient_id=? WHERE id=?")
                    .bind(&canonical_id)
                    .bind(newest_id)
                    .execute(&mut *connection)
                    .await?;
            }
            sqlx::query("DELETE FROM ingredients WHERE id=?")
                .bind(duplicate_id)
                .execute(&mut *connection)
                .await?;
        }
    }

    sqlx::raw_sql(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_inventory_ingredient_id
             ON user_inventory(ingredient_id);
         CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_ingredients_recipe_ingredient
             ON recipe_ingredients(recipe_id, ingredient_id);
         CREATE UNIQUE INDEX IF NOT EXISTS uq_recipe_steps_recipe_step_number
             ON recipe_steps(recipe_id, step_number);
         CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_name_key
             ON ingredients(name_key);
         DROP INDEX IF EXISTS idx_user_inventory_ingredient_id;
         DROP INDEX IF EXISTS idx_recipe_ingredients_recipe_id;
         DROP INDEX IF EXISTS idx_recipe_steps_recipe_id;",
    )
    .execute(&mut *connection)
    .await?;
    Ok(())
}
