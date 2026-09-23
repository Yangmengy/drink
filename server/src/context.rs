use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    error::AppError,
    models::{ContextMaintainInput, ContextMaintainResponse, Settings},
};

const SUMMARY_PROMPT_VERSION: &str = "context-summary-v1";
const MAX_CANDIDATE_MESSAGES: usize = 120;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ContextSummary {
    pub id: Uuid,
    pub from_seq: Option<i64>,
    pub to_seq: Option<i64>,
    pub summary: String,
    pub covered_message_count: i32,
    pub token_estimate: i32,
    pub status: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct ContextState {
    active_summary_id: Option<Uuid>,
    last_summarized_message_id: Option<Uuid>,
    recent_window: i32,
}

#[derive(Debug, sqlx::FromRow)]
struct SummaryCandidate {
    id: Uuid,
    seq: i64,
    role: String,
    text: String,
}

#[derive(Debug, Deserialize)]
struct ModelSummary {
    #[serde(default)]
    summary: String,
    #[serde(default)]
    #[allow(dead_code)]
    open_questions: Vec<String>,
    #[serde(default)]
    #[allow(dead_code)]
    confirmed_facts: Vec<String>,
}

pub async fn maintain(
    pool: &PgPool,
    user_id: Uuid,
    settings: &Settings,
    input: &ContextMaintainInput,
) -> Result<ContextMaintainResponse, AppError> {
    let api_key = input.api_key.as_deref().unwrap_or_default().trim();
    if api_key.is_empty() {
        return Ok(ContextMaintainResponse {
            maintained: false,
            reason: Some("missing_api_key".to_owned()),
            summary_id: None,
            covered_messages: 0,
            token_estimate: 0,
        });
    }

    let state = ensure_state(pool, user_id).await?;
    let prior_summary = active_summary(pool, user_id).await?;
    let prior_state = state.clone();
    let candidates = pending_candidates(
        pool,
        user_id,
        state.recent_window,
        state.last_summarized_message_id,
    )
    .await?;
    if candidates.len() < state.recent_window as usize {
        return Ok(ContextMaintainResponse {
            maintained: false,
            reason: Some("below_threshold".to_owned()),
            summary_id: prior_summary.as_ref().map(|summary| summary.id),
            covered_messages: 0,
            token_estimate: 0,
        });
    }

    let transcript = build_transcript(&candidates);
    let previous_summary = prior_summary
        .as_ref()
        .map(|summary| summary.summary.as_str());
    let summary = generate_summary(settings, api_key, previous_summary, &transcript).await?;
    let token_estimate = token_estimate(&summary);
    let to_message = candidates.last().expect("candidates are non-empty");
    let from_message = candidates.first().expect("candidates are non-empty");
    let from_seq = prior_summary
        .as_ref()
        .and_then(|summary| summary.from_seq)
        .or(Some(from_message.seq));
    let covered_count = prior_summary
        .as_ref()
        .map(|summary| summary.covered_message_count + candidates.len() as i32)
        .unwrap_or(candidates.len() as i32);

    let mut transaction = pool.begin().await?;
    let current = ensure_state_on(&mut transaction, user_id).await?;
    if current.active_summary_id != prior_state.active_summary_id
        || current.last_summarized_message_id != prior_state.last_summarized_message_id
    {
        return Ok(ContextMaintainResponse {
            maintained: false,
            reason: Some("context_changed".to_owned()),
            summary_id: None,
            covered_messages: 0,
            token_estimate: 0,
        });
    }

    let summary_id = Uuid::new_v4();
    sqlx::query(
        r#"
        UPDATE chat_context_summaries
        SET status = 'archived'
        WHERE user_id = $1 AND status = 'active'
        "#,
    )
    .bind(user_id)
    .execute(&mut *transaction)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO chat_context_summaries
            (id, user_id, from_message_id, to_message_id, from_seq, to_seq,
             summary, covered_message_count, token_estimate, model,
             prompt_version, source, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'model', 'active')
        "#,
    )
    .bind(summary_id)
    .bind(user_id)
    .bind(from_message.id)
    .bind(to_message.id)
    .bind(from_seq)
    .bind(to_message.seq)
    .bind(&summary)
    .bind(covered_count as i32)
    .bind(token_estimate)
    .bind(&settings.model)
    .bind(SUMMARY_PROMPT_VERSION)
    .execute(&mut *transaction)
    .await?;

    let updated = sqlx::query(
        r#"
        UPDATE chat_context_state
        SET last_summarized_message_id = $2,
            active_summary_id = $3,
            updated_at = NOW()
        WHERE user_id = $1
          AND active_summary_id IS NOT DISTINCT FROM $4
          AND last_summarized_message_id IS NOT DISTINCT FROM $5
        "#,
    )
    .bind(user_id)
    .bind(to_message.id)
    .bind(summary_id)
    .bind(prior_state.active_summary_id)
    .bind(prior_state.last_summarized_message_id)
    .execute(&mut *transaction)
    .await?;
    if updated.rows_affected() == 0 {
        transaction.rollback().await?;
        return Ok(ContextMaintainResponse {
            maintained: false,
            reason: Some("context_changed".to_owned()),
            summary_id: None,
            covered_messages: 0,
            token_estimate: 0,
        });
    }
    transaction.commit().await?;

    Ok(ContextMaintainResponse {
        maintained: true,
        reason: None,
        summary_id: Some(summary_id),
        covered_messages: candidates.len() as i32,
        token_estimate,
    })
}

pub async fn active_summary_text(pool: &PgPool, user_id: Uuid) -> Result<Option<String>, AppError> {
    let summary = active_summary(pool, user_id).await?;
    Ok(summary.map(|summary| summary.summary))
}

async fn ensure_state(pool: &PgPool, user_id: Uuid) -> Result<ContextState, AppError> {
    let mut connection = pool.acquire().await?;
    ensure_state_on(&mut connection, user_id).await
}

async fn ensure_state_on(
    connection: &mut sqlx::PgConnection,
    user_id: Uuid,
) -> Result<ContextState, AppError> {
    sqlx::query(
        r#"
        INSERT INTO chat_context_state (user_id)
        VALUES ($1)
        ON CONFLICT (user_id) DO NOTHING
        "#,
    )
    .bind(user_id)
    .execute(&mut *connection)
    .await?;

    sqlx::query_as::<_, ContextState>(
        r#"
        SELECT s.active_summary_id, s.last_summarized_message_id, s.recent_window
        FROM chat_context_state s
        WHERE s.user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&mut *connection)
    .await
    .map_err(Into::into)
}

async fn active_summary(pool: &PgPool, user_id: Uuid) -> Result<Option<ContextSummary>, AppError> {
    sqlx::query_as::<_, ContextSummary>(
        r#"
        SELECT id, from_seq, to_seq, summary, covered_message_count,
               token_estimate, status, created_at
        FROM chat_context_summaries
        WHERE user_id = $1 AND status = 'active'
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .map_err(Into::into)
}

async fn pending_candidates(
    pool: &PgPool,
    user_id: Uuid,
    recent_window: i32,
    last_summarized_message_id: Option<Uuid>,
) -> Result<Vec<SummaryCandidate>, AppError> {
    sqlx::query_as::<_, SummaryCandidate>(
        r#"
        WITH recent AS (
            SELECT id
            FROM chat_messages
            WHERE user_id = $1
            ORDER BY seq DESC
            LIMIT $2
        )
        SELECT m.id, m.seq, m.role, m.text
        FROM chat_messages m
        LEFT JOIN chat_context_state s ON s.user_id = m.user_id
        LEFT JOIN chat_messages last_summarized
            ON last_summarized.id = s.last_summarized_message_id
        WHERE m.user_id = $1
          AND NOT EXISTS (SELECT 1 FROM recent WHERE recent.id = m.id)
          AND (
              $3::UUID IS NULL
              OR last_summarized.seq IS NULL
              OR m.seq > last_summarized.seq
          )
        ORDER BY m.seq
        LIMIT $4
        "#,
    )
    .bind(user_id)
    .bind(recent_window)
    .bind(last_summarized_message_id)
    .bind(MAX_CANDIDATE_MESSAGES as i64)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

fn build_transcript(messages: &[SummaryCandidate]) -> String {
    messages
        .iter()
        .map(|message| {
            let text = compact_text(&message.text, 1000);
            format!("[#{} {}] {}", message.seq, message.role, text)
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn compact_text(text: &str, limit: usize) -> String {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.chars().count() <= limit {
        normalized
    } else {
        normalized.chars().take(limit).collect::<String>() + "…"
    }
}

async fn generate_summary(
    settings: &Settings,
    api_key: &str,
    previous_summary: Option<&str>,
    transcript: &str,
) -> Result<String, AppError> {
    let prompt = r#"你是对话上下文整理器。把旧对话合并为一份紧凑、可复用的滚动摘要。
只保留：用户目标、明确偏好、未完成问题、对后续酒品推荐重要的事实。
不要保存：完整配方步骤、工具原始 JSON、模型 Key、临时寒暄、失败半轮过程、用户未确认的健康或过敏声明。
输出必须是 JSON 对象：{"summary":"...", "openQuestions":[], "confirmedFacts":[]}。不要输出 Markdown。"#;
    let user_content = format!(
        "当前滚动摘要：\n{}\n\n新增旧消息：\n{}",
        previous_summary.unwrap_or("（无）"),
        transcript
    );
    let payload = json!({
        "model": settings.model,
        "messages": [
            {"role": "system", "content": prompt},
            {"role": "user", "content": user_content},
        ],
        "temperature": 0.2,
        "max_tokens": 700,
    });

    let endpoint = format!(
        "{}/chat/completions",
        settings.base_url.trim_end_matches('/')
    );
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|_| AppError::internal())?;
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|_| AppError::bad_request("无法连接模型服务，摘要暂未更新"))?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|_| AppError::bad_request("模型服务返回了无效响应，摘要暂未更新"))?;
    if !status.is_success() {
        let detail = body
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("请稍后重试");
        return Err(AppError::bad_request(format!("模型摘要失败：{detail}")));
    }

    let raw = body
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim();
    parse_summary(raw)
}

fn parse_summary(raw: &str) -> Result<String, AppError> {
    let cleaned = raw
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();
    let parsed: ModelSummary = serde_json::from_str(cleaned)
        .map_err(|_| AppError::bad_request("模型摘要格式不正确，请稍后重试"))?;
    let summary = parsed.summary.trim();
    if summary.is_empty() || summary.chars().count() > 4000 {
        return Err(AppError::bad_request("模型摘要为空或过长，请稍后重试"));
    }
    Ok(summary.to_owned())
}

fn token_estimate(summary: &str) -> i32 {
    summary.chars().count().div_ceil(2).max(1) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_summary_accepts_plain_json() {
        let summary =
            parse_summary(r#"{"summary":"用户偏好清爽低糖","confirmedFacts":["偏好清爽"]}"#)
                .expect("valid summary");
        assert_eq!(summary, "用户偏好清爽低糖");
    }

    #[test]
    fn parse_summary_rejects_empty_model_output() {
        assert!(parse_summary(r#"{"summary":"  "}"#).is_err());
    }
}
