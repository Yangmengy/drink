use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatement {
    pub id: Uuid,
    pub kind: String,
    pub content: String,
    pub source: String,
    pub retention_policy: String,
    pub confidence: f64,
    pub status: String,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_seen_at: chrono::DateTime<chrono::Utc>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryStatementInput {
    pub kind: String,
    pub content: String,
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default = "default_retention")]
    pub retention_policy: String,
    #[serde(default)]
    pub confidence: Option<f64>,
    #[serde(default)]
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
}

fn default_source() -> String {
    "structured_ui".to_owned()
}

fn default_retention() -> String {
    "explicit".to_owned()
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct MemorySettings {
    pub allow_auto_low_risk: bool,
    pub low_risk_ttl_days: i32,
    pub allow_temporary_context: bool,
    pub temporary_context_ttl_days: i32,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MemorySettingsInput {
    pub allow_auto_low_risk: bool,
    pub low_risk_ttl_days: i32,
    pub allow_temporary_context: bool,
    pub temporary_context_ttl_days: i32,
}

pub async fn expire(pool: &PgPool, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query(
        r#"
        UPDATE user_memory_statements
        SET status = 'expired', updated_at = NOW()
        WHERE user_id = $1 AND status = 'active' AND expires_at IS NOT NULL AND expires_at <= NOW()
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list(
    pool: &PgPool,
    user_id: Uuid,
    include_inactive: bool,
) -> Result<Vec<MemoryStatement>, AppError> {
    expire(pool, user_id).await?;
    let filter = if include_inactive {
        ""
    } else {
        " AND status = 'active'"
    };
    let sql = format!(
        r#"
        SELECT id, kind, content, source, retention_policy,
               confidence::float8 AS confidence, status, expires_at,
               last_seen_at, created_at
        FROM user_memory_statements
        WHERE user_id = $1{filter}
        ORDER BY
            CASE status WHEN 'active' THEN 0 ELSE 1 END,
            updated_at DESC
        LIMIT 200
        "#
    );
    let rows = sqlx::query_as::<_, MemoryStatement>(&sql)
        .bind(user_id)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn create(
    pool: &PgPool,
    user_id: Uuid,
    input: &MemoryStatementInput,
) -> Result<MemoryStatement, AppError> {
    let content = input.content.trim();
    if content.chars().count() > 1000 {
        return Err(AppError::bad_request("记忆内容最多 1000 字"));
    }
    if !matches!(
        input.kind.as_str(),
        "preference" | "constraint" | "context" | "goal"
    ) {
        return Err(AppError::bad_request("记忆类型无效"));
    }
    if !matches!(
        input.source.as_str(),
        "structured_ui" | "chat_confirmed" | "summary_confirmed"
    ) {
        return Err(AppError::bad_request("记忆来源无效"));
    }
    if !matches!(
        input.retention_policy.as_str(),
        "explicit" | "auto_low_risk" | "temporary_context"
    ) {
        return Err(AppError::bad_request("记忆保留策略无效"));
    }
    if matches!(
        input.retention_policy.as_str(),
        "auto_low_risk" | "temporary_context"
    ) && input.expires_at.is_none()
    {
        return Err(AppError::bad_request("自动记忆必须设置过期时间"));
    }
    let confidence = input.confidence.unwrap_or(0.8);
    if !(0.0..=1.0).contains(&confidence) || !confidence.is_finite() {
        return Err(AppError::bad_request("记忆置信度必须在 0–1 之间"));
    }

    let normalized_key = normalized_key(content);
    let statement = sqlx::query_as::<_, MemoryStatement>(
        r#"
        INSERT INTO user_memory_statements
            (user_id, kind, content, normalized_key, source, retention_policy, confidence, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, normalized_key) WHERE status = 'active' DO UPDATE SET
            content = EXCLUDED.content,
            last_seen_at = NOW(),
            updated_at = NOW()
        RETURNING id, kind, content, source, retention_policy,
                  confidence::float8 AS confidence, status, expires_at,
                  last_seen_at, created_at
        "#,
    )
    .bind(user_id)
    .bind(&input.kind)
    .bind(content)
    .bind(&normalized_key)
    .bind(&input.source)
    .bind(&input.retention_policy)
    .bind(confidence)
    .bind(input.expires_at)
    .fetch_one(pool)
    .await
    .map_err(|error| match error {
        sqlx::Error::Database(database) if database.is_unique_violation() => {
            AppError::conflict("存在冲突状态的重复记忆")
        }
        error => error.into(),
    })?;
    Ok(statement)
}

pub async fn revoke(pool: &PgPool, user_id: Uuid, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query(
        r#"
        UPDATE user_memory_statements
        SET status = 'revoked', updated_at = NOW()
        WHERE user_id = $1 AND id = $2 AND status IN ('active', 'expired')
        "#,
    )
    .bind(user_id)
    .bind(id)
    .execute(pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::not_found("记忆不存在或不能撤销"));
    }
    Ok(())
}

pub async fn delete(pool: &PgPool, user_id: Uuid, id: Uuid) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM user_memory_statements WHERE user_id = $1 AND id = $2")
        .bind(user_id)
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::not_found("记忆不存在"));
    }
    Ok(())
}

pub async fn clear_low_risk(pool: &PgPool, user_id: Uuid) -> Result<u64, AppError> {
    let result = sqlx::query(
        r#"
        DELETE FROM user_memory_statements
        WHERE user_id = $1 AND retention_policy = 'auto_low_risk'
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

pub async fn settings(pool: &PgPool, user_id: Uuid) -> Result<MemorySettings, AppError> {
    sqlx::query(
        r#"
        INSERT INTO user_memory_settings (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, MemorySettings>(
        r#"
        SELECT allow_auto_low_risk, low_risk_ttl_days,
               allow_temporary_context, temporary_context_ttl_days, updated_at
        FROM user_memory_settings
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(AppError::internal)
}

pub async fn save_settings(
    pool: &PgPool,
    user_id: Uuid,
    input: &MemorySettingsInput,
) -> Result<MemorySettings, AppError> {
    if !(7..=365).contains(&input.low_risk_ttl_days) {
        return Err(AppError::bad_request("低风险记忆保留时间需为 7–365 天"));
    }
    if !(1..=30).contains(&input.temporary_context_ttl_days) {
        return Err(AppError::bad_request("短期上下文保留时间需为 1–30 天"));
    }
    sqlx::query_as::<_, MemorySettings>(
        r#"
        INSERT INTO user_memory_settings
            (user_id, allow_auto_low_risk, low_risk_ttl_days,
             allow_temporary_context, temporary_context_ttl_days)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO UPDATE SET
            allow_auto_low_risk = EXCLUDED.allow_auto_low_risk,
            low_risk_ttl_days = EXCLUDED.low_risk_ttl_days,
            allow_temporary_context = EXCLUDED.allow_temporary_context,
            temporary_context_ttl_days = EXCLUDED.temporary_context_ttl_days,
            updated_at = NOW()
        RETURNING allow_auto_low_risk, low_risk_ttl_days,
                  allow_temporary_context, temporary_context_ttl_days, updated_at
        "#,
    )
    .bind(user_id)
    .bind(input.allow_auto_low_risk)
    .bind(input.low_risk_ttl_days)
    .bind(input.allow_temporary_context)
    .bind(input.temporary_context_ttl_days)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}

pub async fn active_context(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<MemoryStatement>, AppError> {
    expire(pool, user_id).await?;
    settings(pool, user_id).await?;
    let rows = sqlx::query_as::<_, MemoryStatement>(
        r#"
        SELECT m.id, m.kind, m.content, m.source, m.retention_policy,
               m.confidence::float8 AS confidence, m.status, m.expires_at,
               m.last_seen_at, m.created_at
        FROM user_memory_statements AS m
        JOIN user_memory_settings s ON s.user_id = m.user_id
        WHERE m.user_id = $1 AND m.status = 'active' AND (
            m.retention_policy = 'explicit'
            OR (m.retention_policy = 'auto_low_risk' AND s.allow_auto_low_risk)
            OR (m.retention_policy = 'temporary_context' AND s.allow_temporary_context)
        )
        ORDER BY
            CASE m.kind WHEN 'constraint' THEN 0 ELSE 1 END,
            m.confidence DESC, m.updated_at DESC
        LIMIT 10
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

fn normalized_key(content: &str) -> String {
    let normalized: String = content
        .chars()
        .filter_map(|character| {
            if character.is_whitespace() {
                Some(' ')
            } else if character.is_alphanumeric() {
                Some(character.to_ascii_lowercase())
            } else {
                None
            }
        })
        .collect();
    let normalized = normalized.split_whitespace().collect::<Vec<_>>().join(" ");
    let mut hasher = Sha256::new();
    hasher.update(normalized.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[allow(dead_code)]
fn default_expiry(days: i64) -> chrono::DateTime<Utc> {
    Utc::now() + Duration::days(days)
}
