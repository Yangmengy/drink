use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::PgPool;

use crate::{agent, error::AppError, models::AgentTrace};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservabilityTotals {
    pub traces: usize,
    pub successful: usize,
    pub local: usize,
    pub failed: usize,
    pub success_rate: f64,
    pub model_calls: usize,
    pub tool_calls: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservabilityLatency {
    pub average_ms: u64,
    pub p95_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TimelinePoint {
    pub bucket: String,
    pub total: usize,
    pub successful: usize,
    pub local: usize,
    pub failed: usize,
    pub average_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseStat {
    pub phase: String,
    pub total: usize,
    pub average_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObservabilitySnapshot {
    pub source: String,
    pub generated_at: i64,
    pub window_hours: u32,
    pub retention: usize,
    pub database: String,
    pub totals: ObservabilityTotals,
    pub latency: ObservabilityLatency,
    pub timeline: Vec<TimelinePoint>,
    pub phases: Vec<PhaseStat>,
    pub traces: Vec<AgentTrace>,
}

pub async fn summary(pool: &PgPool) -> Result<ObservabilitySnapshot, AppError> {
    sqlx::query("SELECT 1").execute(pool).await?;
    let traces = agent::all_traces(pool).await?;
    Ok(analyze(traces, "server", "ok"))
}

pub fn analyze(mut traces: Vec<AgentTrace>, source: &str, database: &str) -> ObservabilitySnapshot {
    traces.sort_by(|left, right| {
        right
            .started_at
            .cmp(&left.started_at)
            .then(left.id.cmp(&right.id))
    });
    let totals = totals(&traces);
    let latency = latency(&traces);
    let timeline = timeline(&traces);
    let phases = phases(&traces);

    ObservabilitySnapshot {
        source: source.to_owned(),
        generated_at: Utc::now().timestamp(),
        window_hours: 24,
        retention: 100,
        database: database.to_owned(),
        totals,
        latency,
        timeline,
        phases,
        traces,
    }
}

fn totals(traces: &[AgentTrace]) -> ObservabilityTotals {
    let successful = count_status(traces, "ok");
    let local = count_status(traces, "local");
    let failed = count_status(traces, "error");
    let accepted = successful + local;
    let mut model_calls = 0;
    let mut tool_calls = 0;

    for trace in traces {
        for event in &trace.events {
            if event.phase == "model.start" || event.phase == "model.request" {
                model_calls += 1;
            }
            if (event.phase.starts_with("tool.") && event.phase.ends_with(".start"))
                || event.phase == "tool.call"
            {
                tool_calls += 1;
            }
        }
    }

    ObservabilityTotals {
        traces: traces.len(),
        successful,
        local,
        failed,
        success_rate: if accepted == 0 {
            0.0
        } else {
            successful as f64 / accepted as f64
        },
        model_calls,
        tool_calls,
    }
}

fn count_status(traces: &[AgentTrace], status: &str) -> usize {
    traces.iter().filter(|trace| trace.status == status).count()
}

fn latency(traces: &[AgentTrace]) -> ObservabilityLatency {
    if traces.is_empty() {
        return ObservabilityLatency {
            average_ms: 0,
            p95_ms: 0,
        };
    }

    let total: i64 = traces.iter().map(|trace| trace.duration_ms as i64).sum();
    let mut durations: Vec<i64> = traces
        .iter()
        .map(|trace| trace.duration_ms as i64)
        .collect();
    durations.sort_unstable();
    let index = (((durations.len() as f64 - 1.0) * 0.95).ceil()) as usize;
    ObservabilityLatency {
        average_ms: (total / traces.len() as i64).max(0) as u64,
        p95_ms: durations[index.min(durations.len() - 1)].max(0) as u64,
    }
}

fn timeline(traces: &[AgentTrace]) -> Vec<TimelinePoint> {
    let now_hour = Utc::now().timestamp().div_euclid(3600);
    let first_hour = now_hour - 23;
    let mut buckets: [(usize, usize, usize, usize, i64); 24] = Default::default();

    for trace in traces {
        let hour = trace.started_at.div_euclid(3600);
        let offset = hour - first_hour;
        if !(0..24).contains(&offset) {
            continue;
        }
        let slot = offset as usize;
        buckets[slot].0 += 1;
        match trace.status.as_str() {
            "ok" => buckets[slot].1 += 1,
            "local" => buckets[slot].2 += 1,
            "error" => buckets[slot].3 += 1,
            _ => {}
        }
        buckets[slot].4 += trace.duration_ms as i64;
    }

    buckets
        .into_iter()
        .enumerate()
        .map(
            |(index, (total, successful, local, failed, duration_sum))| {
                let timestamp = (first_hour + index as i64) * 3600;
                TimelinePoint {
                    bucket: DateTime::from_timestamp(timestamp, 0)
                        .unwrap_or(Utc::now())
                        .to_rfc3339(),
                    total,
                    successful,
                    local,
                    failed,
                    average_ms: if total == 0 {
                        0
                    } else {
                        (duration_sum / total as i64).max(0) as u64
                    },
                }
            },
        )
        .collect()
}

fn phases(traces: &[AgentTrace]) -> Vec<PhaseStat> {
    let mut stats: BTreeMap<String, (usize, i64)> = BTreeMap::new();
    for trace in traces {
        for event in &trace.events {
            let entry = stats.entry(event.phase.clone()).or_default();
            entry.0 += 1;
            entry.1 += event.elapsed_ms as i64;
        }
    }

    stats
        .into_iter()
        .map(|(phase, (total, elapsed_sum))| PhaseStat {
            phase,
            total,
            average_ms: (elapsed_sum / total as i64).max(0) as u64,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::TraceEvent;

    fn trace(id: &str, status: &str, started_at: i64, duration_ms: i32) -> AgentTrace {
        AgentTrace {
            id: id.to_owned(),
            started_at,
            duration_ms,
            status: status.to_owned(),
            events: vec![
                TraceEvent {
                    phase: "model.start".to_owned(),
                    elapsed_ms: 10,
                    detail: "model".to_owned(),
                },
                TraceEvent {
                    phase: "tool.search_menu.start".to_owned(),
                    elapsed_ms: 20,
                    detail: "tool".to_owned(),
                },
                TraceEvent {
                    phase: "model.request".to_owned(),
                    elapsed_ms: 30,
                    detail: "server model".to_owned(),
                },
                TraceEvent {
                    phase: "tool.call".to_owned(),
                    elapsed_ms: 40,
                    detail: "server tool".to_owned(),
                },
            ],
            error: None,
        }
    }

    #[test]
    fn snapshot_aggregates_statuses_latency_and_signals() {
        let now = (Utc::now().timestamp().div_euclid(3600) * 3600) + 30;
        let snapshot = analyze(
            vec![
                trace("ok", "ok", now, 100),
                trace("local", "local", now - 60, 200),
                trace("error", "error", now - 120, 300),
            ],
            "desktop",
            "ok",
        );

        assert_eq!(snapshot.totals.traces, 3);
        assert_eq!(snapshot.totals.successful, 1);
        assert_eq!(snapshot.totals.local, 1);
        assert_eq!(snapshot.totals.failed, 1);
        assert_eq!(snapshot.totals.model_calls, 6);
        assert_eq!(snapshot.totals.tool_calls, 6);
        assert!((snapshot.totals.success_rate - 0.5).abs() < f64::EPSILON);
        assert_eq!(snapshot.latency.average_ms, 200);
        assert_eq!(snapshot.latency.p95_ms, 300);
        assert_eq!(snapshot.timeline.len(), 24);
        assert!(snapshot.traces.iter().any(|trace| trace.id == "ok"));
    }
}
