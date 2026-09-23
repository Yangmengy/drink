import type { AgentTrace, ObservabilityLatency, ObservabilityPhase, ObservabilitySnapshot, ObservabilityTimelinePoint, ObservabilityTotals } from '../types';

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((sorted.length - 1) * ratio));
  return Math.max(0, Math.round(sorted[index]));
}

export function analyzeTraces(traces: AgentTrace[]): {
  totals: ObservabilityTotals;
  latency: ObservabilityLatency;
  timeline: ObservabilityTimelinePoint[];
  phases: ObservabilityPhase[];
} {
  const successful = traces.filter(trace => trace.status === 'ok').length;
  const local = traces.filter(trace => trace.status === 'local').length;
  const failed = traces.filter(trace => trace.status === 'error').length;
  const accepted = successful + local;
  const phaseMap = new Map<string, { total: number; sum: number }>();
  let modelCalls = 0;
  let toolCalls = 0;

  for (const trace of traces) {
    for (const event of trace.events) {
      const phase = phaseMap.get(event.phase) ?? { total: 0, sum: 0 };
      phase.total += 1;
      phase.sum += event.elapsedMs;
      phaseMap.set(event.phase, phase);
      if (event.phase === 'model.start' || event.phase === 'model.request') modelCalls += 1;
      if (
        (event.phase.startsWith('tool.') && event.phase.endsWith('.start')) ||
        event.phase === 'tool.call'
      ) {
        toolCalls += 1;
      }
    }
  }

  const nowHour = Math.floor(Date.now() / 1000 / 3600);
  const firstHour = nowHour - 23;
  const timeline = Array.from({ length: 24 }, (_, index) => ({
    bucket: new Date((firstHour + index) * 3600 * 1000).toISOString(),
    total: 0,
    successful: 0,
    local: 0,
    failed: 0,
    averageMs: 0,
  }));

  for (const trace of traces) {
    const slot = Math.floor(trace.startedAt / 3600) - firstHour;
    if (slot < 0 || slot >= 24) continue;
    timeline[slot].total += 1;
    if (trace.status === 'ok') timeline[slot].successful += 1;
    if (trace.status === 'local') timeline[slot].local += 1;
    if (trace.status === 'error') timeline[slot].failed += 1;
    timeline[slot].averageMs += trace.durationMs;
  }
  for (const point of timeline) {
    point.averageMs = point.total ? Math.round(point.averageMs / point.total) : 0;
  }

  return {
    totals: {
      traces: traces.length,
      successful,
      local,
      failed,
      successRate: accepted ? successful / accepted : 0,
      modelCalls,
      toolCalls,
    },
    latency: {
      averageMs: traces.length ? Math.round(traces.reduce((sum, trace) => sum + trace.durationMs, 0) / traces.length) : 0,
      p95Ms: percentile(traces.map(trace => trace.durationMs), 0.95),
    },
    timeline,
    phases: [...phaseMap.entries()]
      .map(([phase, stat]) => ({ phase, total: stat.total, averageMs: Math.round(stat.sum / stat.total) }))
      .sort((a, b) => b.total - a.total || a.phase.localeCompare(b.phase)),
  };
}

export function desktopSnapshot(traces: AgentTrace[]): ObservabilitySnapshot {
  const aggregate = analyzeTraces(traces);
  const sorted = [...traces].sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id));
  return {
    source: 'desktop',
    generatedAt: Math.floor(Date.now() / 1000),
    windowHours: 24,
    retention: 100,
    database: 'ok',
    ...aggregate,
    traces: sorted,
  };
}
