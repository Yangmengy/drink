use chrono::Utc;
use sqlx::PgPool;
use sqlx::Row;

use crate::{error::AppError, models::*};

fn data_directory() -> String {
    "浏览器本机；服务器不保存 API Key".to_owned()
}

pub async fn get(pool: &PgPool, user_id: uuid::Uuid) -> Result<Settings, AppError> {
    let row = sqlx::query(
        r#"
        SELECT name, preferences, model, base_url
        FROM companion_settings
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(match row {
        Some(row) => Settings {
            name: row.try_get("name")?,
            preferences: row.try_get("preferences")?,
            model: row.try_get("model")?,
            base_url: row.try_get("base_url")?,
            api_key_configured: false,
            data_directory: data_directory(),
        },
        None => Settings {
            name: String::new(),
            preferences: String::new(),
            model: "qwen-plus".to_owned(),
            base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1".to_owned(),
            api_key_configured: false,
            data_directory: data_directory(),
        },
    })
}

fn validate_base_url(value: &str) -> Result<(), AppError> {
    let url = reqwest::Url::parse(value.trim())
        .map_err(|_| AppError::bad_request("API 地址格式不正确"))?;
    if url.scheme() != "https" {
        return Err(AppError::bad_request("API 地址必须使用 HTTPS"));
    }
    if url.host_str().is_none() {
        return Err(AppError::bad_request("API 地址缺少主机名"));
    }
    if is_blocked_host(url.host_str().unwrap()) {
        return Err(AppError::bad_request(
            "API 地址不能指向本机、内网或云元数据地址",
        ));
    }
    Ok(())
}

fn is_blocked_host(host: &str) -> bool {
    let host = host
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_ascii_lowercase();
    if host == "localhost"
        || host.ends_with(".localhost")
        || host.ends_with(".internal")
        || host.ends_with(".local")
    {
        return true;
    }
    if let Ok(ip) = host.parse::<std::net::Ipv4Addr>() {
        return ip.is_loopback()
            || ip.is_private()
            || ip.is_link_local()
            || ip.is_unspecified()
            || ip.is_broadcast()
            || ip.is_documentation()
            || ip.octets()[0] == 100 && ip.octets()[1] & 0b1100_0000 == 64
            || ip.octets()[0] == 198 && (ip.octets()[1] & 0xfe) == 198;
    }
    if let Ok(ip) = host.parse::<std::net::Ipv6Addr>() {
        return ip.is_loopback()
            || ip.is_unspecified()
            || (ip.segments()[0] & 0xfe00) == 0xfc00
            || (ip.segments()[0] & 0xffc0) == 0xfe80;
    }
    false
}

pub async fn save(
    pool: &PgPool,
    user_id: uuid::Uuid,
    input: &SettingsInput,
) -> Result<Settings, AppError> {
    let name = input.name.trim();
    let preferences = input.preferences.trim();
    let model = input.model.trim();
    let base_url = input.base_url.trim();
    if name.chars().count() > 60 {
        return Err(AppError::bad_request("称呼最多 60 字"));
    }
    if preferences.chars().count() > 2000 {
        return Err(AppError::bad_request("偏好描述最多 2000 字"));
    }
    if model.is_empty() || model.chars().count() > 120 {
        return Err(AppError::bad_request("请填写 1–120 字的模型名称"));
    }
    validate_base_url(base_url)?;

    sqlx::query(
        r#"
        INSERT INTO companion_settings
            (user_id, name, preferences, model, base_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE SET
            name = EXCLUDED.name,
            preferences = EXCLUDED.preferences,
            model = EXCLUDED.model,
            base_url = EXCLUDED.base_url,
            updated_at = EXCLUDED.updated_at
        "#,
    )
    .bind(user_id)
    .bind(name)
    .bind(preferences)
    .bind(model)
    .bind(base_url)
    .bind(Utc::now())
    .execute(pool)
    .await?;

    Ok(Settings {
        name: name.to_owned(),
        preferences: preferences.to_owned(),
        model: model.to_owned(),
        base_url: base_url.to_owned(),
        api_key_configured: false,
        data_directory: data_directory(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_endpoint_must_use_https() {
        assert!(validate_base_url("https://example.com/v1").is_ok());
        assert!(validate_base_url("http://example.com/v1").is_err());
        assert!(validate_base_url("not-a-url").is_err());
        assert!(validate_base_url("https://localhost/v1").is_err());
        assert!(validate_base_url("https://192.168.1.8/v1").is_err());
        assert!(validate_base_url("https://169.254.169.254/latest/meta-data/").is_err());
        assert!(validate_base_url("https://100.64.0.1/v1").is_err());
    }
}
