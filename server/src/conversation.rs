use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    pub id: Uuid,
    pub user_id: Uuid,
    pub title: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_message_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ConversationSummary {
    pub id: Uuid,
    pub title: String,
    pub status: String,
    pub message_count: i64,
    pub last_message_preview: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub is_active: bool,
}

async fn active_id_on(
    connection: &mut sqlx::PgConnection,
    user_id: Uuid,
) -> Result<Option<Uuid>, AppError> {
    let id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT s.active_conversation_id
        FROM user_conversation_state s
        JOIN conversations c ON c.id = s.active_conversation_id
        WHERE s.user_id = $1 AND c.status = 'active'
        "#,
    )
    .bind(user_id)
    .fetch_optional(connection)
    .await?;
    Ok(id)
}

pub async fn active_id(pool: &PgPool, user_id: Uuid) -> Result<Uuid, AppError> {
    let mut connection = pool.acquire().await?;
    if let Some(id) = active_id_on(&mut connection, user_id).await? {
        return Ok(id);
    }

    let mut transaction = pool.begin().await?;
    if let Some(id) = active_id_on(&mut transaction, user_id).await? {
        transaction.commit().await?;
        return Ok(id);
    }
    let conversation = insert_default(&mut transaction, user_id).await?;
    sqlx::query(
        r#"
        INSERT INTO user_conversation_state (user_id, active_conversation_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET
            active_conversation_id = EXCLUDED.active_conversation_id,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(conversation.id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(conversation.id)
}

async fn insert_default(
    connection: &mut sqlx::PgConnection,
    user_id: Uuid,
) -> Result<Conversation, AppError> {
    sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (user_id)
        VALUES ($1)
        RETURNING id, user_id, title, status, created_at, updated_at, last_message_at
        "#,
    )
    .bind(user_id)
    .fetch_one(connection)
    .await
    .map_err(Into::into)
}

pub async fn list(pool: &PgPool, user_id: Uuid) -> Result<Vec<ConversationSummary>, AppError> {
    let active_id = active_id(pool, user_id).await?;
    sqlx::query_as::<_, ConversationSummary>(
        r#"
        SELECT
            c.id,
            c.title,
            c.status,
            COALESCE(m.message_count, 0) AS message_count,
            last_message.text AS last_message_preview,
            COALESCE(m.last_message_at, c.created_at) AS last_message_at,
            c.created_at,
            c.id = $2 AS is_active
        FROM conversations c
        LEFT JOIN (
            SELECT
                conversation_id,
                COUNT(*) AS message_count,
                MAX(created_at) AS last_message_at
            FROM chat_messages
            GROUP BY conversation_id
        ) m ON m.conversation_id = c.id
        LEFT JOIN LATERAL (
            SELECT text
            FROM chat_messages cm
            WHERE cm.conversation_id = c.id
            ORDER BY cm.created_at DESC, cm.id DESC
            LIMIT 1
        ) last_message ON TRUE
        WHERE c.user_id = $1 AND c.status = 'active'
        ORDER BY COALESCE(m.last_message_at, c.created_at) DESC
        LIMIT 100
        "#,
    )
    .bind(user_id)
    .bind(active_id)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn get_owned(
    pool: &PgPool,
    user_id: Uuid,
    conversation_id: Uuid,
) -> Result<Conversation, AppError> {
    sqlx::query_as::<_, Conversation>(
        r#"
        SELECT id, user_id, title, status, created_at, updated_at, last_message_at
        FROM conversations
        WHERE id = $1 AND user_id = $2 AND status = 'active'
        "#,
    )
    .bind(conversation_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::not_found("会话不存在"))
}

pub async fn create(
    pool: &PgPool,
    user_id: Uuid,
    input: &crate::models::CreateConversationInput,
) -> Result<Conversation, AppError> {
    let mut transaction = pool.begin().await?;
    let lock_key = user_id.as_u128() as i64;
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(lock_key)
        .execute(&mut *transaction)
        .await?;

    let active_id = active_id_on(&mut transaction, user_id)
        .await?
        .ok_or_else(AppError::internal)?;
    let message_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM chat_messages WHERE conversation_id = $1")
            .bind(active_id)
            .fetch_one(&mut *transaction)
            .await?;

    let conversation = if message_count == 0 {
        sqlx::query_as::<_, Conversation>(
            r#"
            SELECT id, user_id, title, status, created_at, updated_at, last_message_at
            FROM conversations
            WHERE id = $1
            "#,
        )
        .bind(active_id)
        .fetch_one(&mut *transaction)
        .await?
    } else {
        let title = input
            .title
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty());
        if let Some(title) = title {
            if title.chars().count() > 120 {
                return Err(AppError::bad_request("会话标题最多 120 字"));
            }
        }
        sqlx::query_as::<_, Conversation>(
            r#"
            INSERT INTO conversations (user_id, title)
            VALUES ($1, $2)
            RETURNING id, user_id, title, status, created_at, updated_at, last_message_at
            "#,
        )
        .bind(user_id)
        .bind(title.unwrap_or("新的对话"))
        .fetch_one(&mut *transaction)
        .await?
    };

    sqlx::query(
        r#"
        INSERT INTO user_conversation_state (user_id, active_conversation_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET
            active_conversation_id = EXCLUDED.active_conversation_id,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(conversation.id)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(conversation)
}

pub async fn set_active(
    pool: &PgPool,
    user_id: Uuid,
    conversation_id: Uuid,
) -> Result<(), AppError> {
    get_owned(pool, user_id, conversation_id).await?;
    sqlx::query(
        r#"
        INSERT INTO user_conversation_state (user_id, active_conversation_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET
            active_conversation_id = EXCLUDED.active_conversation_id,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(conversation_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(pool: &PgPool, user_id: Uuid, conversation_id: Uuid) -> Result<Uuid, AppError> {
    get_owned(pool, user_id, conversation_id).await?;
    let mut transaction = pool.begin().await?;
    sqlx::query("DELETE FROM conversations WHERE id = $1 AND user_id = $2")
        .bind(conversation_id)
        .bind(user_id)
        .execute(&mut *transaction)
        .await?;
    let remaining_id = sqlx::query_scalar::<_, Uuid>(
        r#"
        SELECT id
        FROM conversations
        WHERE user_id = $1 AND status = 'active'
        ORDER BY COALESCE(last_message_at, created_at) DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&mut *transaction)
    .await?;
    let new_active = match remaining_id {
        Some(id) => id,
        None => insert_default(&mut transaction, user_id).await?.id,
    };
    sqlx::query(
        r#"
        INSERT INTO user_conversation_state (user_id, active_conversation_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id) DO UPDATE SET
            active_conversation_id = EXCLUDED.active_conversation_id,
            updated_at = NOW()
        "#,
    )
    .bind(user_id)
    .bind(new_active)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(new_active)
}

#[allow(dead_code)]
pub async fn touch(pool: &PgPool, conversation_id: Uuid, title: &str) -> Result<(), AppError> {
    sqlx::query(
        r#"
        UPDATE conversations
        SET last_message_at = NOW(),
            updated_at = NOW(),
            title = CASE
                WHEN title = '新的对话' THEN left($2, 60)
                ELSE title
            END
        WHERE id = $1
        "#,
    )
    .bind(conversation_id)
    .bind(title.trim())
    .execute(pool)
    .await?;
    Ok(())
}

#[allow(dead_code)]
pub async fn title(pool: &PgPool, conversation_id: Uuid) -> Result<String, AppError> {
    let row = sqlx::query("SELECT title FROM conversations WHERE id = $1")
        .bind(conversation_id)
        .fetch_one(pool)
        .await?;
    row.try_get("title").map_err(Into::into)
}
