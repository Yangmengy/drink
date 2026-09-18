//! One-time import of the original desktop profile. Historical tables remain untouched.
use anyhow::Result;
use sqlx::{Row, SqliteConnection};

pub(super) async fn import_profile(connection: &mut SqliteConnection) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(user_profile)")
        .fetch_all(&mut *connection)
        .await?;
    let names: Vec<String> = columns.iter().map(|r| r.get("name")).collect();
    for (old, new) in [
        ("username", "name"),
        ("llm_model", "model"),
        ("llm_base_url", "base_url"),
    ] {
        if names.iter().any(|c| c == old) {
            let sql = format!("UPDATE companion_settings SET {new} = COALESCE(NULLIF((SELECT {old} FROM user_profile WHERE id=1), ''), {new}) WHERE id=1");
            sqlx::query(&sql).execute(&mut *connection).await?;
        }
    }
    Ok(())
}
