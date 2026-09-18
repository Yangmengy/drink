use adk_rust::{async_trait, futures::StreamExt, Llm, LlmRequest, LlmResponseStream};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use std::{
    sync::{Arc, Mutex},
    time::Instant,
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TraceEvent {
    pub phase: String,
    pub elapsed_ms: u64,
    pub detail: String,
}
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTrace {
    pub id: String,
    pub started_at: i64,
    pub duration_ms: u64,
    pub status: String,
    pub events: Vec<TraceEvent>,
    pub error: Option<String>,
}

#[derive(Clone)]
pub struct Recorder {
    pub id: String,
    pub started_at: i64,
    start: Instant,
    events: Arc<Mutex<Vec<TraceEvent>>>,
}
impl Default for Recorder {
    fn default() -> Self {
        Self::new()
    }
}
impl Recorder {
    pub fn start_turn() -> Self {
        let trace = Self::new();
        trace.push(
            "turn.start",
            "收到请求；检查模型配置或执行明确的本地酒单查询",
        );
        trace
    }

    pub fn new() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            started_at: chrono::Utc::now().timestamp(),
            start: Instant::now(),
            events: Arc::new(Mutex::new(vec![])),
        }
    }
    pub fn push(&self, phase: &str, detail: impl Into<String>) {
        if let Ok(mut events) = self.events.lock() {
            events.push(TraceEvent {
                phase: phase.into(),
                elapsed_ms: self.start.elapsed().as_millis() as u64,
                detail: detail.into(),
            });
        }
    }
    pub async fn finish(&self, pool: &SqlitePool, ok: bool) -> anyhow::Result<()> {
        let last_phase = self
            .events
            .lock()
            .ok()
            .and_then(|events| events.last().map(|e| e.phase.clone()))
            .unwrap_or_else(|| "turn.start".into());
        self.push(
            if ok { "turn.complete" } else { "turn.error" },
            if ok {
                "回复已完成并保存".to_owned()
            } else {
                format!("本轮未完成，中断阶段：{last_phase}")
            },
        );
        let events = self.events.lock().map(|e| e.clone()).unwrap_or_default();
        let status = if !ok {
            "error"
        } else if events.iter().any(|e| e.phase == "fallback.start") {
            "local"
        } else {
            "ok"
        };
        let mut tx = pool.begin().await?;
        sqlx::query("INSERT INTO agent_traces (id,started_at,duration_ms,status,events,error) VALUES (?,?,?,?,?,?)")
            .bind(&self.id).bind(self.started_at).bind(self.start.elapsed().as_millis() as i64).bind(status)
            .bind(serde_json::to_string(&events)?).bind(if ok{None}else{Some("本轮失败，最后一个事件标明中断阶段；原始模型请求和密钥未记录。")}).execute(&mut *tx).await?;
        sqlx::query("DELETE FROM agent_traces WHERE id NOT IN (SELECT id FROM agent_traces ORDER BY started_at DESC, rowid DESC LIMIT 100)").execute(&mut *tx).await?;
        tx.commit().await?;
        Ok(())
    }

    pub async fn complete<T>(
        &self,
        pool: &SqlitePool,
        result: anyhow::Result<T>,
    ) -> anyhow::Result<T> {
        // Observability must not turn an already persisted reply into a failed/retried turn.
        if self.finish(pool, result.is_ok()).await.is_err() {
            eprintln!("本地 trace 写入失败（链路 {}）；对话结果保持不变", self.id);
        }
        result.map_err(|e| anyhow::anyhow!("{}（链路 {}）", e, self.id))
    }
}

pub async fn list(pool: &SqlitePool) -> anyhow::Result<Vec<AgentTrace>> {
    let rows =
        sqlx::query("SELECT * FROM agent_traces ORDER BY started_at DESC,rowid DESC LIMIT 100")
            .fetch_all(pool)
            .await?;
    rows.into_iter()
        .map(|row| {
            Ok(AgentTrace {
                id: row.get("id"),
                started_at: row.get("started_at"),
                duration_ms: row.get::<i64, _>("duration_ms") as u64,
                status: row.get("status"),
                events: serde_json::from_str(&row.get::<String, _>("events"))?,
                error: row.get("error"),
            })
        })
        .collect()
}

pub struct TracedModel {
    pub model: Arc<dyn Llm>,
    pub trace: Recorder,
}
#[async_trait]
impl Llm for TracedModel {
    fn name(&self) -> &str {
        self.model.name()
    }
    async fn generate_content(
        &self,
        request: LlmRequest,
        stream: bool,
    ) -> adk_rust::Result<LlmResponseStream> {
        self.trace.push(
            "model.start",
            format!(
                "{} · {} 条上下文 · {} 个可用工具",
                self.model.name(),
                request.contents.len(),
                request.tools.len()
            ),
        );
        let started = Instant::now();
        let response = match self.model.generate_content(request, stream).await {
            Ok(s) => s,
            Err(e) => {
                self.trace.push(
                    "model.error",
                    "模型请求失败；检查服务地址、密钥和模型工具调用能力",
                );
                return Err(e);
            }
        };
        let trace = self.trace.clone();
        let mut first = true;
        Ok(Box::pin(response.map(move |result| {
            if first {
                trace.push(
                    "model.first_response",
                    format!("首响应 {} ms", started.elapsed().as_millis()),
                );
                first = false;
            }
            match &result {
                Ok(r) => {
                    if let Some(usage) = &r.usage_metadata {
                        trace.push(
                            "model.usage",
                            format!(
                                "输入 {} / 输出 {} / 合计 {} tokens",
                                usage.prompt_token_count,
                                usage.candidates_token_count,
                                usage.total_token_count
                            ),
                        );
                    }
                    if !r.partial {
                        trace.push(
                            "model.response",
                            format!("模型响应完成，耗时 {} ms", started.elapsed().as_millis()),
                        );
                    }
                }
                Err(_) => trace.push("model.error", "模型响应流中断"),
            }
            result
        })))
    }
}
