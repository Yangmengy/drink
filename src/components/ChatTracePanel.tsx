import { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api, errorText } from '../api/client';
import type { AgentTrace, TraceEvent } from '../types';
import './ChatTracePanel.css';

interface ChatTracePanelProps {
  traceId?: string | null;
  liveEvents?: TraceEvent[];
  label?: string;
}

let inFlightTraces: Promise<AgentTrace[]> | null = null;

function loadTraces() {
  if (!inFlightTraces) {
    inFlightTraces = api.traces().finally(() => { inFlightTraces = null; });
  }
  return inFlightTraces;
}

export function ChatTracePanel({ traceId, liveEvents, label = '查看本轮链路' }: ChatTracePanelProps) {
  const contentId = useId();
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const isLive = liveEvents !== undefined;

  useEffect(() => {
    setManualOpen(null);
  }, [traceId]);

  useEffect(() => {
    if (isLive || !traceId) return;
    let active = true;
    setLoading(true);
    setError('');
    loadTraces()
      .then(result => { if (active) setTraces(result); })
      .catch(reason => { if (active) setError(errorText(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [traceId, isLive, reload]);

  const trace = traces.find(item => item.id === traceId);
  const events = liveEvents ?? trace?.events ?? [];
  const open = manualOpen ?? (events.length <= 2 || (!isLive && !!error));

  const toggleOpen = () => {
    setManualOpen(!open);
    if (!open && !isLive && traceId) setReload(value => value + 1);
  };

  return (
    <section className="chat-trace-panel" aria-label="聊天链路">
      <button
        className="chat-trace-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggleOpen}
      >
        <span>{label}</span>
        <span className="chat-trace-toggle-hint" aria-hidden="true">{open ? '收起' : '展开'}<ChevronDown size={15} /></span>
      </button>
      <div id={contentId} className="chat-trace-body" role="region" aria-label="链路详情" hidden={!open}>
        {!isLive && loading && traceId ? <p className="muted" role="status">正在加载链路…</p>
            : !isLive && error ? <div className="chat-trace-error"><p className="error" role="alert">{error}</p><button type="button" className="text-button" onClick={() => setReload(value => value + 1)}>重新加载链路</button></div>
              : isLive || trace ? (
                <article className="chat-trace-detail">
                  {events.length ? <ul className="chat-trace-events">{events.map((event, index) => (
                    <li key={index}>
                      <strong>{event.phase}</strong>
                      <p>{event.detail}</p>
                    </li>
                  ))}</ul> : <p className="muted" role="status">{isLive ? '等待链路…' : '暂无链路步骤。'}</p>}
                </article>
              ) : <p className="muted" role="status">这轮链路已不在最近 100 条记录中，或已被清理。聊天记录仍可保留。</p>}
      </div>
    </section>
  );
}
