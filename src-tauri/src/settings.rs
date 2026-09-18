use crate::models::{Settings, SettingsInput};
use anyhow::{ensure, Context, Result};
use sqlx::{Row, SqlitePool};
use std::{io::Write, path::Path};

const KEY_FILE: &str = ".model-key";

pub fn read_key(dir: &Path) -> Result<String> {
    let key =
        std::fs::read_to_string(dir.join(KEY_FILE)).context("请先在设置中填写模型 API Key")?;
    ensure!(!key.trim().is_empty(), "请先在设置中填写模型 API Key");
    Ok(key.trim().to_owned())
}

fn write_key(dir: &Path, key: &str) -> Result<()> {
    let target = dir.join(KEY_FILE);
    if key.trim().is_empty() {
        if target.exists() {
            std::fs::remove_file(target)?;
        }
        return Ok(());
    }
    let temporary = dir.join(".model-key.tmp");
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options.open(&temporary)?;
    file.write_all(key.trim().as_bytes())?;
    file.sync_all()?;
    std::fs::rename(temporary, target)?;
    Ok(())
}

pub async fn migrate_key(pool: &SqlitePool, dir: &Path) -> Result<()> {
    let columns = sqlx::query("PRAGMA table_info(user_profile)")
        .fetch_all(pool)
        .await?;
    if columns
        .iter()
        .any(|r| r.get::<String, _>("name") == "llm_api_key")
    {
        let key: Option<String> =
            sqlx::query_scalar("SELECT llm_api_key FROM user_profile WHERE id=1")
                .fetch_optional(pool)
                .await?
                .flatten();
        if let Some(key) = key.filter(|s| !s.trim().is_empty()) {
            if !dir.join(KEY_FILE).exists() {
                write_key(dir, &key)?;
            }
            sqlx::query("UPDATE user_profile SET llm_api_key=NULL WHERE id=1")
                .execute(pool)
                .await?;
        }
    }
    Ok(())
}

pub async fn get(pool: &SqlitePool, dir: &Path) -> Result<Settings> {
    let row =
        sqlx::query("SELECT name,preferences,model,base_url FROM companion_settings WHERE id=1")
            .fetch_one(pool)
            .await?;
    Ok(Settings {
        name: row.get("name"),
        preferences: row.get("preferences"),
        model: row.get("model"),
        base_url: row.get("base_url"),
        api_key_configured: read_key(dir).is_ok_and(|k| !k.trim().is_empty()),
        data_directory: dir.display().to_string(),
    })
}

pub async fn save(pool: &SqlitePool, dir: &Path, input: SettingsInput) -> Result<Settings> {
    ensure!(
        input.name.chars().count() <= 60 && input.preferences.chars().count() <= 2000,
        "昵称或偏好过长"
    );
    ensure!(
        !input.model.trim().is_empty() && input.model.len() <= 120,
        "请填写有效的模型名称"
    );
    let url = url::Url::parse(input.base_url.trim()).context("API 地址格式不正确")?;
    ensure!(
        url.scheme() == "https"
            || (url.scheme() == "http"
                && matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))),
        "API 地址需使用 HTTPS；本地模型可以使用 HTTP"
    );
    ensure!(
        url.username().is_empty()
            && url.password().is_none()
            && url.query().is_none()
            && url.fragment().is_none(),
        "请使用不含账号、参数和片段的 API 基础地址"
    );
    if let Some(key) = input.api_key {
        ensure!(key.len() <= 4096, "API Key 过长");
        write_key(dir, &key)?;
    }
    sqlx::query("UPDATE companion_settings SET name=?,preferences=?,model=?,base_url=? WHERE id=1")
        .bind(input.name.trim())
        .bind(input.preferences.trim())
        .bind(input.model.trim())
        .bind(input.base_url.trim().trim_end_matches('/'))
        .execute(pool)
        .await?;
    get(pool, dir).await
}
