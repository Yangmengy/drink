use std::collections::HashMap;
use std::time::Instant;

use chrono::Utc;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};

use crate::{error::AppError, menu, models::*};

const MAX_TOOL_ROUNDS: usize = 6;
const MAX_HISTORY_MESSAGES: usize = 20;
const MENU_RESULT_LIMIT: usize = 12;
const COMPANION_PROMPT: &str = include_str!("../../src-tauri/prompts/companion.md");

struct TraceRecorder {
    id: String,
    started_at: Instant,
    timestamp: chrono::DateTime<Utc>,
    events: Vec<TraceEvent>,
}

impl TraceRecorder {
    fn start() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            started_at: Instant::now(),
            timestamp: Utc::now(),
            events: Vec::new(),
        }
    }

    fn push(&mut self, phase: &str, detail: impl Into<String>) {
        self.events.push(TraceEvent {
            phase: phase.to_owned(),
            elapsed_ms: self.started_at.elapsed().as_millis(),
            detail: detail.into(),
        });
    }

    async fn complete(
        self,
        pool: &PgPool,
        user_id: uuid::Uuid,
        status: &str,
        error: Option<String>,
    ) -> Result<AgentTrace, AppError> {
        let duration_ms = self.started_at.elapsed().as_millis().min(i32::MAX as u128) as i32;
        let events = serde_json::to_value(&self.events).map_err(|_| AppError::internal())?;
        sqlx::query(
            r#"
            INSERT INTO agent_traces
                (id, user_id, started_at, duration_ms, status, events, error)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            "#,
        )
        .bind(&self.id)
        .bind(user_id)
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
            WHERE user_id = $1 AND id NOT IN (
                SELECT id FROM agent_traces
                WHERE user_id = $1
                ORDER BY started_at DESC, created_at DESC
                LIMIT 100
            )
            "#,
        )
        .bind(user_id)
        .execute(pool)
        .await?;

        Ok(AgentTrace {
            id: self.id,
            started_at: self.timestamp.timestamp(),
            duration_ms,
            status: status.to_owned(),
            events: self.events,
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

fn parse_json_reply(
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

fn compact_recipe(recipe: &Recipe) -> Result<Value, AppError> {
    let mut value = serde_json::to_value(recipe).map_err(|_| AppError::internal())?;
    if let Some(object) = value.as_object_mut() {
        object.remove("steps");
        object.remove("image");
        object.insert("stepsOmitted".to_owned(), Value::Bool(true));
    }
    Ok(value)
}

fn tool_schemas() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "search_menu",
                "description": "Search the user's real cocktail menu and inventory. Returns at most 12 recipes with missing ingredients.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Short cocktail or ingredient keyword; use an empty string for broad search."},
                        "maxSweet": {"type": "integer", "minimum": 0, "maximum": 5},
                        "minSour": {"type": "integer", "minimum": 0, "maximum": 5},
                        "maxStrong": {"type": "integer", "minimum": 0, "maximum": 5}
                    },
                    "additionalProperties": false
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "get_recipe",
                "description": "Get one complete real recipe by ID from this turn's search results.",
                "parameters": {
                    "type": "object",
                    "properties": {"id": {"type": "string"}},
                    "required": ["id"],
                    "additionalProperties": false
                }
            }
        }),
    ]
}

fn read_chat_message(row: sqlx::postgres::PgRow) -> Result<ChatMessage, AppError> {
    let recipes: Value = row.try_get("recipes")?;
    Ok(ChatMessage {
        id: row.try_get("id")?,
        role: row.try_get("role")?,
        text: row.try_get("text")?,
        recipes: serde_json::from_value(recipes).map_err(|_| AppError::internal())?,
        trace_id: row.try_get("trace_id")?,
        mode: row
            .try_get::<Option<String>, _>("mode")?
            .unwrap_or_else(|| "agent".to_owned()),
    })
}

async fn load_history(pool: &PgPool, user_id: uuid::Uuid) -> Result<Vec<ChatMessage>, AppError> {
    let mut messages: Vec<_> = sqlx::query(
        r#"
        SELECT id, role, text, recipes, trace_id, mode
        FROM chat_messages
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(MAX_HISTORY_MESSAGES as i64)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(read_chat_message)
    .collect::<Result<_, _>>()?;
    messages.reverse();
    Ok(messages)
}

pub async fn history(pool: &PgPool, user_id: uuid::Uuid) -> Result<Vec<ChatMessage>, AppError> {
    sqlx::query(
        r#"
        SELECT id, role, text, recipes, trace_id, mode
        FROM chat_messages
        WHERE user_id = $1
        ORDER BY created_at, id
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(read_chat_message)
    .collect()
}

pub async fn clear(pool: &PgPool, user_id: uuid::Uuid) -> Result<(), AppError> {
    sqlx::query("DELETE FROM chat_messages WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    sqlx::query("DELETE FROM agent_traces WHERE user_id = $1")
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn traces(pool: &PgPool, user_id: uuid::Uuid) -> Result<Vec<AgentTrace>, AppError> {
    sqlx::query(
        r#"
        SELECT id, started_at, duration_ms, status, events, error
        FROM agent_traces
        WHERE user_id = $1
        ORDER BY started_at DESC, created_at DESC
        LIMIT 100
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?
    .into_iter()
    .map(|row| {
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
    })
    .collect()
}

async fn call_model(base_url: &str, api_key: &str, payload: &Value) -> Result<Value, AppError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(75))
        .build()
        .map_err(|_| AppError::bad_request("模型客户端初始化失败"))?;
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .json(payload)
        .send()
        .await
        .map_err(|_| AppError::bad_request("无法连接模型服务，请检查 API 地址和网络"))?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|_| AppError::bad_request("模型服务返回了无效响应"))?;
    if !status.is_success() {
        let detail = body
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("请稍后重试");
        return Err(match status.as_u16() {
            401 | 403 => AppError::bad_request(format!("模型密钥无效或没有权限：{detail}")),
            429 => AppError::bad_request(format!("模型调用频率或额度受限：{detail}")),
            _ => AppError::bad_request(format!("模型服务返回错误：{detail}")),
        });
    }

    body.pointer("/choices/0/message")
        .cloned()
        .ok_or_else(|| AppError::bad_request("模型服务没有返回消息"))
}

async fn save_turn(
    pool: &PgPool,
    user_id: uuid::Uuid,
    message: &str,
    trace_id: &str,
    reply: &str,
    recipes: &[Recipe],
) -> Result<ChatMessage, AppError> {
    let recipes = serde_json::to_value(recipes).map_err(|_| AppError::internal())?;
    sqlx::query(
        "INSERT INTO chat_messages (user_id, role, text, recipes, mode) VALUES ($1, 'user', $2, '[]'::jsonb, 'agent')",
    )
    .bind(user_id)
    .bind(message.trim())
    .execute(pool)
    .await?;
    let row = sqlx::query(
        r#"
        INSERT INTO chat_messages (user_id, role, text, recipes, trace_id, mode)
        VALUES ($1, 'assistant', $2, $3, $4, 'agent')
        RETURNING id
        "#,
    )
    .bind(user_id)
    .bind(reply)
    .bind(&recipes)
    .bind(trace_id)
    .fetch_one(pool)
    .await?;

    Ok(ChatMessage {
        id: row.try_get("id")?,
        role: "assistant".to_owned(),
        text: reply.to_owned(),
        recipes: serde_json::from_value(recipes).map_err(|_| AppError::internal())?,
        trace_id: Some(trace_id.to_owned()),
        mode: "agent".to_owned(),
    })
}

pub async fn send(
    pool: &PgPool,
    user_id: uuid::Uuid,
    settings: &Settings,
    input: &ChatSendInput,
) -> Result<ChatMessage, AppError> {
    let mut trace = TraceRecorder::start();
    let trace_id = trace.id.clone();
    let result = tokio::time::timeout(
        std::time::Duration::from_secs(90),
        send_inner(pool, user_id, settings, input, &mut trace),
    )
    .await
    .unwrap_or_else(|_| Err(AppError::bad_request("模型调用整体超时，请稍后重试")));
    match result {
        Ok(message) => {
            trace.push("turn.complete", "对话已保存");
            trace.complete(pool, user_id, "ok", None).await?;
            Ok(message)
        }
        Err(error) => {
            let detail = error.message().to_owned();
            trace.push("turn.error", detail.clone());
            trace
                .complete(pool, user_id, "error", Some(detail.clone()))
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
    settings: &Settings,
    input: &ChatSendInput,
    trace: &mut TraceRecorder,
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
    trace.push("config.ready", "模型配置已就绪；密钥不写入链路");
    trace.push("context.load", "读取最近对话");
    let history = load_history(pool, user_id).await?;

    let mut messages = vec![json!({
        "role": "system",
        "content": COMPANION_PROMPT,
    })];
    for message in history {
        messages.push(json!({
            "role": message.role,
            "content": message.text,
        }));
    }
    messages.push(json!({
        "role": "user",
        "content": input.message.trim(),
    }));

    let mut candidates: HashMap<String, Recipe> = HashMap::new();
    for round in 0..MAX_TOOL_ROUNDS {
        let payload = json!({
            "model": settings.model,
            "messages": messages,
            "tools": tool_schemas(),
            "tool_choice": "auto",
        });
        trace.push("model.request", format!("第 {} 轮模型调用", round + 1));
        let assistant = call_model(&settings.base_url, api_key, &payload).await?;
        let tool_calls = assistant
            .get("tool_calls")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        if tool_calls.is_empty() {
            let raw = assistant
                .get("content")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let (reply, recipes) = parse_json_reply(raw, &candidates)?;
            trace.push(
                "reply.validate",
                format!("通过校验，推荐 {} 款", recipes.len()),
            );
            return save_turn(pool, user_id, &input.message, &trace.id, &reply, &recipes).await;
        }

        messages.push(assistant);
        for call in tool_calls {
            let id = call
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_owned();
            let name = call
                .pointer("/function/name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_owned();
            let arguments = call
                .pointer("/function/arguments")
                .and_then(Value::as_str)
                .unwrap_or("{}");
            let arguments: Value = serde_json::from_str(arguments)
                .map_err(|_| AppError::bad_request("模型工具参数格式不正确"))?;
            trace.push("tool.call", name.clone());

            let result = if name == "search_menu" {
                let query = MenuQuery {
                    query: arguments
                        .get("query")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_owned(),
                    max_sweet: arguments
                        .get("maxSweet")
                        .and_then(Value::as_i64)
                        .map(|value| value.clamp(0, 5) as i32),
                    min_sour: arguments
                        .get("minSour")
                        .and_then(Value::as_i64)
                        .map(|value| value.clamp(0, 5) as i32),
                    max_strong: arguments
                        .get("maxStrong")
                        .and_then(Value::as_i64)
                        .map(|value| value.clamp(0, 5) as i32),
                };
                let mut recipes = menu::search(pool, user_id, &query).await?;
                recipes.truncate(MENU_RESULT_LIMIT);
                for recipe in &recipes {
                    candidates.insert(recipe.id.clone(), recipe.clone());
                }
                let results = recipes
                    .iter()
                    .map(compact_recipe)
                    .collect::<Result<Vec<_>, AppError>>()?;
                serde_json::to_value(results).map_err(|_| AppError::internal())?
            } else if name == "get_recipe" {
                let requested_id = arguments
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_owned();
                let recipe = match candidates.get(&requested_id) {
                    Some(recipe) => recipe.clone(),
                    None => menu::get(pool, user_id, &requested_id).await?,
                };
                candidates.insert(recipe.id.clone(), recipe.clone());
                serde_json::to_value(&recipe).map_err(|_| AppError::internal())?
            } else {
                json!({ "error": format!("unknown tool: {name}") })
            };

            messages.push(json!({
                "role": "tool",
                "tool_call_id": id,
                "content": serde_json::to_string(&result).map_err(|_| AppError::internal())?,
            }));
        }
    }

    Err(AppError::bad_request(
        "Agent 工具调用次数过多，请缩小问题范围后重试",
    ))
}
