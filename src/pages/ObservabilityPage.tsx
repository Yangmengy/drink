import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, Bot, Database, RefreshCw, ShieldCheck, Timer, Wrench } from 'lucide-react';
import { api, errorText } from '../api/client';
import type { AgentTrace, ObservabilitySnapshot } from '../types';
import './ObservabilityPage.css';

type StatusFilter = 'all' | 'ok' | 'local' | 'error';

const statusLabels: Record<string, string> = {
  all: '全部',
  ok: '正常',
  local: '本地',
  error: '错误',
};

function formatTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value * 1000));
}

function formatClock(value: number) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value * 1000));
}

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function phaseKind(phase: string) {
  if (phase.includes('error') || phase.includes('timeout')) return 'error';
  if (phase.includes('complete') || phase.includes('accepted') || phase.includes('response')) return 'ok';
  if (phase.startsWith('tool.')) return 'tool';
  if (phase.startsWith('model.')) return 'model';
  if (phase.includes('fallback') || phase.includes('missing')) return 'warn';
  return 'system';
}

export function ObservabilityPage() {
  const [snapshot, setSnapshot] = useState<ObservabilitySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const result = await api.observability();
      setSnapshot(result);
      setError('');
      setSelectedId(current => {
        if (current && result.traces.some(trace => trace.id === current)) return current;
        return result.traces[0]?.id ?? null;
      });
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  const filteredTraces = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (snapshot?.traces ?? []).filter(trace => {
      const statusMatch = status === 'all' || trace.status === status;
      if (!statusMatch) return false;
      if (!keyword) return true;
      return [
        trace.id,
        trace.status,
        trace.error ?? '',
        ...trace.events.map(event => `${event.phase} ${event.detail}`),
      ].join(' ').toLowerCase().includes(keyword);
    });
  }, [query, snapshot, status]);

  const selected: AgentTrace | null = useMemo(
    () => filteredTraces.find(trace => trace.id === selectedId) ?? filteredTraces[0] ?? null,
    [filteredTraces, selectedId],
  );
  const healthy = !!snapshot && snapshot.database === 'ok' && snapshot.totals.failed === 0;
  const maxTimeline = Math.max(1, ...(snapshot?.timeline.map(point => point.total) ?? [1]));

  return (
    <div className="ops-page">
      <header className="ops-header">
        <div className="ops-title">
          <span className="ops-mark"><Activity size={18} strokeWidth={2} /></span>
          <div>
            <h1>Agent Ops</h1>
            <p>{snapshot?.source === 'desktop' ? '桌面本机' : '私有服务'}</p>
          </div>
        </div>
        <div className="ops-actions">
          <span className={`ops-state ${healthy ? 'ready' : snapshot ? 'attention' : ''}`}>
            <ShieldCheck size={14} strokeWidth={1.9} />
            {healthy ? '运行正常' : snapshot ? '需要关注' : loading ? '连接中' : '不可用'}
          </span>
          <button className="ops-icon-button" type="button" onClick={() => void load(true)} disabled={refreshing} aria-label="刷新运维数据">
            <RefreshCw className={refreshing ? 'spin' : ''} size={16} strokeWidth={1.8} />
          </button>
          <button className="ops-back" type="button" onClick={() => { window.location.href = '/'; }}>
            <ArrowLeft size={15} strokeWidth={1.8} />
            聊天
          </button>
        </div>
      </header>

      <main className="ops-main">
        {loading && <div className="ops-empty" aria-live="polite">正在读取链路…</div>}
        {!loading && error && (
          <div className="ops-locked" role="alert">
            <AlertTriangle size={22} strokeWidth={1.7} />
            <h2>私有控制台不可用</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && snapshot && (
          <>
            <section className="ops-metrics" aria-label="运行信号">
              <article>
                <span><Activity size={14} strokeWidth={1.9} />总轮次</span>
                <strong>{formatNumber(snapshot.totals.traces)}</strong>
                <small>保留 {snapshot.retention} 条</small>
              </article>
              <article>
                <span><ShieldCheck size={14} strokeWidth={1.9} />智能成功率</span>
                <strong>{formatNumber(snapshot.totals.successRate * 100, 1)}%</strong>
                <small>{snapshot.totals.successful} 条智能回复</small>
              </article>
              <article>
                <span><AlertTriangle size={14} strokeWidth={1.9} />异常</span>
                <strong>{formatNumber(snapshot.totals.failed)}</strong>
                <small>本地降级 {snapshot.totals.local} 条</small>
              </article>
              <article>
                <span><Timer size={14} strokeWidth={1.9} />P95 延迟</span>
                <strong>{formatNumber(snapshot.latency.p95Ms)}<i>ms</i></strong>
                <small>平均 {formatNumber(snapshot.latency.averageMs)} ms</small>
              </article>
              <article>
                <span><Bot size={14} strokeWidth={1.9} />模型调用</span>
                <strong>{formatNumber(snapshot.totals.modelCalls)}</strong>
                <small>工具 {snapshot.totals.toolCalls} 次</small>
              </article>
            </section>

            <section className="ops-band" aria-label="24 小时趋势">
              <div className="section-heading">
                <h2>24 小时趋势</h2>
                <span>{formatTime(snapshot.generatedAt)} 更新 · 数据库 {snapshot.database}</span>
              </div>
              <div className="ops-chart">
                {snapshot.timeline.map(point => {
                  const height = point.total ? Math.max(7, point.total / maxTimeline * 100) : 4;
                  const tone = point.failed ? 'failed' : point.total ? 'active' : 'quiet';
                  return (
                    <span
                      key={point.bucket}
                      className={tone}
                      style={{ height: `${height}%` }}
                      title={`${formatClock(new Date(point.bucket).getTime() / 1000)} · ${point.total} 轮 · 失败 ${point.failed}`}
                    />
                  );
                })}
              </div>
              <div className="ops-axis"><span>24h 前</span><span>现在</span></div>
            </section>

            <section className="ops-band" aria-label="链路热点">
              <div className="section-heading">
                <h2>链路热点</h2>
                <span>按事件数量排列</span>
              </div>
              {snapshot.phases.length ? (
                <ol className="ops-phases">
                  {snapshot.phases.slice(0, 8).map(phase => {
                    const maxPhase = snapshot.phases[0].total || 1;
                    return (
                      <li key={phase.phase}>
                        <div className="phase-line">
                          <strong>{phase.phase}</strong>
                          <span>{phase.total} 次 · {formatNumber(phase.averageMs)} ms</span>
                        </div>
                        <i style={{ width: `${Math.max(4, phase.total / maxPhase * 100)}%` }} />
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="ops-muted">还没有链路事件。</p>}
            </section>

            <section className="ops-workbench" aria-label="Trace 回放">
              <div className="ops-list-panel">
                <div className="ops-toolbar">
                  <div className="ops-search">
                    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索 trace、阶段或错误" aria-label="搜索 trace" />
                  </div>
                  <div className="ops-filter" role="tablist" aria-label="链路状态">
                    {(Object.keys(statusLabels) as StatusFilter[]).map(value => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={status === value}
                        onClick={() => setStatus(value)}
                      >
                        {statusLabels[value]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ops-trace-list">
                  {filteredTraces.map(trace => (
                    <button
                      key={trace.id}
                      type="button"
                      className={selected?.id === trace.id ? 'active' : ''}
                      onClick={() => setSelectedId(trace.id)}
                    >
                      <span className={`status ${trace.status}`}>{statusLabels[trace.status] ?? trace.status}</span>
                      <strong>{formatTime(trace.startedAt)}</strong>
                      <span>{trace.durationMs} ms</span>
                      <p>{trace.error ?? `${trace.events.length} 个事件`}</p>
                    </button>
                  ))}
                  {!filteredTraces.length && <p className="ops-muted">没有匹配的 trace。</p>}
                </div>
              </div>

              <div className="ops-detail-panel">
                {selected ? (
                  <>
                    <div className="detail-heading">
                      <div>
                        <span className={`status ${selected.status}`}>{statusLabels[selected.status] ?? selected.status}</span>
                        <h2>{formatTime(selected.startedAt)} · {selected.durationMs} ms</h2>
                      </div>
                      <span className="trace-id">{selected.id}</span>
                    </div>
                    {selected.error && <div className="detail-error">{selected.error}</div>}
                    <ol className="ops-waterfall">
                      {selected.events.map((event, index) => (
                        <li key={`${event.phase}-${index}`}>
                          <span className={`dot ${phaseKind(event.phase)}`} />
                          <div>
                            <strong>{event.phase}</strong>
                            <p>{event.detail}</p>
                          </div>
                          <time>{event.elapsedMs} ms</time>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : <p className="ops-muted">选择一条链路查看回放。</p>}
              </div>
            </section>

            <footer className="ops-footer">
              <span><Database size={13} strokeWidth={1.8} />数据库正常</span>
              <span><Wrench size={13} strokeWidth={1.8} />事件来自 agent_traces</span>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
