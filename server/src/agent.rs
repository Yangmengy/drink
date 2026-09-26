use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Instant,
};

use chrono::Utc;
use serde_json::Value;
use sqlx::{PgPool, Row};

use crate::{error::AppError, models::*};

const MAX_HISTORY_MESSAGES: usize = 16;

#[derive(Clone)]
pub(super) struct TraceRecorder {
    pub(super) id: String,
    started_at: Instant,
    timestamp: chrono::DateTime<Utc>,
    events: Arc<Mutex<Vec<TraceEvent>>>,
}

impl TraceRecorder {
    fn start() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            started_at: Instant::now(),
            timestamp: Utc::now(),
            events: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub(super) fn push(&self, phase: &str, detail: impl Into<String>) {
        if let Ok(mut events) = self.events.lock() {
            events.push(TraceEvent {
                phase: phase.to_owned(),
                elapsed_ms: self.started_at.elapsed().as_millis(),
                detail: detail.into(),
            });
        }
    }

    pub(super) async fn complete(
        self,
        pool: &PgPool,
        user_id: uuid::Uuid,
        conversation_id: uuid::Uuid,
        status: &str,
        error: Option<String>,
    ) -> Result<AgentTrace, AppError> {
        let duration_ms = self.started_at.elapsed().as_millis().min(i32::MAX as u128) as i32;
        let owned_events = self
            .events
            .lock()
            .map(|events| events.clone())
            .unwrap_or_default();
        let events = serde_json::to_value(&owned_events).map_err(|_| AppError::internal())?;
        sqlx::query(
            r#"
            INSERT INTO agent_traces
                (id, user_id, conversation_id, started_at, duration_ms, status, events, error)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(&self.id)
        .bind(user_id)
        .bind(conversation_id)
        .bind(self.timestamp)
        .bind(duration_ms)
        .bind(status)
        .bind(events)
        .bind(&error)
        .execute(pool)
        .await?;
        sqlx::query(
            r#"
            DELETE FROM agent_traces
            WHERE user_id = $1 AND conversation_id = $2 AND id NOT IN (
                SELECT id FROM agent_traces
                WHERE user_id = $1 AND conversation_id = $2
                ORDER BY started_at DESC, created_at DESC
                LIMIT 100
            )
            "#,
        )
        .bind(user_id)
        .bind(conversation_id)
        .execute(pool)
        .await?;

        Ok(AgentTrace {
            id: self.id,
            started_at: self.timestamp.timestamp(),
            duration_ms,
            status: status.to_owned(),
            events: owned_events,
            error,
        })
    }
}

fn validate_message(message: &str) -> Result<(), AppError> {
    if message.trim().is_empty() || message.chars().count() > 4000 {
        return Err(AppError::bad_request("消息需为 1–4000 字"));
    }
    Ok(())
}

pub(super) fn parse_json_reply(
    raw: &str,
    candidates: &HashMap<String, Recipe>,
) -> Result<(String, Vec<Recipe>), AppError> {
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    let value: Value = serde_json::from_str(cleaned)
        .map_err(|_| AppError::bad_request("模型返回格式不正确，请重试"))?;
    let reply = value
        .get("reply")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim();
    if reply.is_empty() || reply.chars().count() > 16000 {
        return Err(AppError::bad_request("模型返回了空白或过长回复，请重试"));
    }

    let mut ids = Vec::new();
    if let Some(list) = value.get("recipeIds").and_then(Value::as_array) {
        for id in list {
            let id = id
                .as_str()
                .ok_or_else(|| AppError::bad_request("模型返回的推荐 ID 无效，请重试"))?;
            if !ids.contains(&id.to_owned()) {
                ids.push(id.to_owned());
            }
        }
    }
    if ids.len() > 3 {
        return Err(AppError::bad_request("模型推荐数量超出限制，请重试"));
    }

    let mut recipes = Vec::with_capacity(ids.len());
    for id in ids {
        recipes.push(
            candidates
                .get(&id)
                .cloned()
                .ok_or_else(|| AppError::bad_request("模型引用了本轮酒单之外的配方，已拦截"))?,
        );
    }
    Ok((reply.to_owned(), recipes))
}

fn read_chat_message(row: sqlx::postgres::PgRow) -> Result<ChatMessage, AppError> {
    let recipes: Value = row.try_get("recipes")?;
    let id: uuid::Uuid = row.try_get("id")?;

    Ok(ChatMessage {
        id: id.to_string(),
        role: row.try_get("role")?,
        text: row.try_get("text")?,
        recipes: serde_json::from_value(recipes).map_err(|_| AppError::internal())?,
        trace_id: row.try_get("trace_id")?,
        mode: row
            .try_get::<Option<String>, _>("mode")?
            .unwrap_or_else(|| "agent".to_owned()),
    })
}

async fn load_history(
    pool: &PgPool,
    user_id: uuid::Uuid,
    conversation_id: uuid::Uuid,
) -> Result<Vec<ChatMessage>, AppError> {
    let mut messages: Vec<_> = sqlx::query(
        r#"
        SELECT id, role, text, recipes, trace_id, mode
        FROM chat_messages
        WHERE user_id = $1 AND conversation_id = $2
        ORDER BY created_at DESC, id DESC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(conversation_id)
    .bind(MAX_HISTORY_MESSAGES as i64)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(read_chat_message)
    .collect::<Result<_, _>>()?;
    messages.reverse();
    Ok(messages)
}

pub async fn history(
    pool: &PgPool,
    user_id: uuid::Uuid,
    conversation_id: uuid::Uuid,
) -> Result<Vec<ChatMessage>, AppError> {
    sqlx::query(
        r#"
        SELECT id, role, text, recipes, trace_id, mode
        FROM chat_messages
        WHERE user_id = $1 AND conversation_id = $2
        ORDER BY created_at, id
        "#,
    )
    .bind(user_id)
    .bind(conversation_id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(read_chat_message)
    .collect()
}

pub async fn clear(
    pool: &PgPool,
    user_id: uuid::Uuid,
    conversation_id: uuid::Uuid,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM chat_messages WHERE user_id = $1 AND conversation_id = $2")
        .bind(user_id)
        .bind(conversation_id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM agent_traces WHERE user_id = $1 AND conversation_id = $2")
        .bind(user_id)
        .bind(conversation_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn traces(
    pool: &PgPool,
    user_id: uuid::Uuid,
    conversation_id: Option<uuid::Uuid>,
) -> Result<Vec<AgentTrace>, AppError> {
    sqlx::query(
        r#"
        SELECT id, started_at, duration_ms, status, events, error
        FROM agent_traces
        WHERE user_id = $1
          AND ($2::UUID IS NULL OR conversation_id = $2)
        ORDER BY started_at DESC, created_at DESC
        LIMIT 100
        "#,
    )
    .bind(user_id)
    .bind(conversation_id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(read_trace)
    .collect()
}

pub async fn all_traces(pool: &PgPool) -> Result<Vec<AgentTrace>, AppError> {
    sqlx::query(
        r#"
        SELECT id, started_at, duration_ms, status, events, error
        FROM agent_traces
        ORDER BY started_at DESC, created_at DESC
        LIMIT 100
        "#,
    )
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(read_trace)
    .collect()
}

fn read_trace(row: sqlx::postgres::PgRow) -> Result<AgentTrace, AppError> {
    let events: Value = row.try_get("events")?;
    Ok(AgentTrace {
        id: row.try_get("id")?,
        started_at: row
            .try_get::<chrono::DateTime<Utc>, _>("started_at")?
            .timestamp(),
        duration_ms: row.try_get::<i32, _>("duration_ms")?,
        status: row.try_get("status")?,
        events: serde_json::from_value(events).map_err(|_| AppError::internal())?,
        error: row.try_get("error")?,
    })
}

pub(super) async fn save_turn(
    pool: &PgPool,
    user_id: uuid::Uuid,
    conversation_id: uuid::Uuid,
    message: &str,
    trace_id: &str,
    reply: &str,
    recipes: &[Recipe],
) -> Result<ChatMessage, AppError> {
    let recipes_value = serde_json::to_value(recipes).map_err(|_| AppError::internal())?;
    sqlx::query(
        "INSERT INTO chat_messages (user_id, conversation_id, role, text, recipes, mode) VALUES ($1, $2, 'user', $3, '[]'::jsonb, 'agent')",
    )
    .bind(user_id)
    .bind(conversation_id)
    .bind(message.trim())
    .execute(pool)
    .await?;
    crate::conversation::touch(pool, conversation_id, message).await?;
    let row = sqlx::query(
        r#"
        INSERT INTO chat_messages (user_id, conversation_id, role, text, recipes, trace_id, mode)
        VALUES ($1, $2, 'assistant', $3, $4, $5, 'agent')
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(conversation_id)
    .bind(reply)
    .bind(&recipes_value)
    .bind(trace_id)
    .fetch_one(pool)
    .await?;
    let saved_id: uuid::Uuid = row.try_get("id")?;

    Ok(ChatMessage {
        id: saved_id.to_string(),
        role: "assistant".to_owned(),
        text: reply.to_owned(),
        recipes: recipes.to_vec(),
        trace_id: Some(trace_id.to_owned()),
        mode: "agent".to_owned(),
    })
}

pub async fn send(
    pool: &PgPool,
    user_id: uuid::Uuid,
    conversation_id: uuid::Uuid,
    settings: &Settings,
    context: &AgentContext,
    input: &ChatSendInput,
) -> Result<ChatMessage, AppError> {
    let trace = TraceRecorder::start();
    let trace_id = trace.id.clone();
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(90),
        send_inner(
            pool,
            user_id,
            conversation_id,
            settings,
            context,
            input,
            &trace,
        ),
    )
    .await
    .unwrap_or_else(|_| Err(AppError::bad_request("模型调用整体超时，请稍后重试")));
    match result {
        Ok(message) => {
            trace.push("turn.complete", "对话已保存");
            trace
                .complete(pool, user_id, conversation_id, "ok", None)
                .await?;
            Ok(message)
        }
        Err(error) => {
            let detail = error.message().to_owned();
            trace.push("turn.error", detail.clone());
            trace
                .complete(
                    pool,
                    user_id,
                    conversation_id,
                    "error",
                    Some(detail.clone()),
                )
                .await?;
            Err(AppError::bad_request(format!(
                "{detail}（链路 {trace_id}）"
            )))
        }
    }
}

async fn send_inner(
    pool: &PgPool,
    user_id: uuid::Uuid,
    conversation_id: uuid::Uuid,
    settings: &Settings,
    context: &AgentContext,
    input: &ChatSendInput,
    trace: &TraceRecorder,
) -> Result<ChatMessage, AppError> {
    trace.push("input.validate", "校验消息长度");
    validate_message(&input.message)?;
    let api_key = input
        .api_key
        .as_deref()
        .map(str::trim)
        .filter(|key| !key.is_empty())
        .ok_or_else(|| {
            trace.push("config.missing", "请求未携带 API Key；不调用模型");
            AppError::bad_request("请先在设置中填写 API Key")
        })?;
    trace.push("context.load", "读取最近对话");
    let history = load_history(pool, user_id, conversation_id).await?;
    if let Some(_summary) = &context.summary {
        trace.push("summary.load", "已注入滚动对话摘要");
    }
    trace.push(
        "profile.load",
        format!(
            "注入画像 revision {} 和 {} 条记忆",
            context
                .profile
                .get("revision")
                .and_then(Value::as_i64)
                .unwrap_or(0),
            context.memories.len()
        ),
    );
    crate::agent_runner::run(
        pool,
        user_id,
        conversation_id,
        settings,
        context,
        &input.message,
        api_key,
        history,
        trace.clone(),
    )
    .await
}
