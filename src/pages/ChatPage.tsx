import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, MessageCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useChat } from '../components/ChatContext';
import { useBar } from '../components/BarContext';
import { RecipeCard } from '../components/RecipeCard';
import { LocalRecommendations } from '../components/LocalRecommendations';
import { api, errorTraceId } from '../api/client';

const suggestions = ['今天想随便聊聊', '用我现有的材料，做一杯不太甜的酒', '有点累，陪我待一会儿'];

export function ChatPage() {
  const { messages, pending, loading, clearing, error, draft, setDraft, failed, send, clear, pendingMode, configured, setConfigured } = useChat();
  const bar = useBar();
  const [atBottom, setAtBottom] = useState(true);
  const followLatest = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const didInitScroll = useRef(false);
  const [localOpen, setLocalOpen] = useState(false);
  const localOptions = useRef<HTMLDetailsElement>(null);
  const failedTrace = errorTraceId(error);
  useEffect(() => {
    let active = true;
    api.settings().then(s => { if (active) setConfigured(s.apiKeyConfigured); }).catch(() => { if (active) setConfigured(null); });
    return () => { active = false; };
  }, [setConfigured]);
  useEffect(() => { if (configured === false) setLocalOpen(true); }, [configured]);

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => bottom.current?.scrollIntoView({ behavior, block: 'end' });

  // 观察底部锚点，判断用户是否正在阅读最新消息
  // rootMargin 底部收缩：锚点需露出停靠条之上才算"在底部"；阈值必须小于锚点以下的内容高度
  useEffect(() => {
    const el = bottom.current;
    if (!el) return;
    const shrink = window.matchMedia('(max-width: 720px)').matches ? -175 : -100;
    const io = new IntersectionObserver(([entry]) => {
      followLatest.current = entry.isIntersecting;
      setAtBottom(entry.isIntersecting);
    }, { rootMargin: `0px 0px ${shrink}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 空对话从页首展示；只有确实存在历史消息时才定位到最后一条。
  useLayoutEffect(() => {
    if (!loading && !didInitScroll.current) {
      didInitScroll.current = true;
      if (messages.length) scrollToLatest('auto');
      else window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (!loading && !messages.length && !pending && !failed && !error) {
      // 清空对话后恢复欢迎页，不能保留上一段对话的滚动位置。
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [loading, messages.length, pending, failed, error]);

  // 自己发送消息时总是滚到底；收到回复时，只有停留在底部才跟随，上翻阅读时不打断
  useEffect(() => { if (pending) scrollToLatest(); }, [pending]);
  // 底部可见性和错误变化本身不触发滚动，避免把欢迎页推到固定页头后面。
  useEffect(() => { if (messages.length && followLatest.current) scrollToLatest(); }, [messages]);

  // 输入框随内容自动增高（上限由 CSS max-height 控制）
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    const capped = Math.min(el.scrollHeight, 160);
    el.style.height = `${capped}px`;
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [draft]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending || loading || clearing) return;
    followLatest.current = true;
    void send(text);
    textarea.current?.focus({ preventScroll: true });
  }

  return (
    <section className="chat-page">
      <header className="page-header">
        <span className="eyebrow">A LITTLE COMPANY</span>
        <button className="icon-button" aria-label="清空对话" title="清空对话和上下文" disabled={!!pending || clearing || !messages.length} onClick={() => { if (window.confirm('清空这段对话？聊天记录和 Agent 上下文都会被清除。')) void clear(); }}>
          <Trash2 size={19} />
        </button>
      </header>
      {configured === false && <div className="notice local-mode" role="status"><strong>本地模式</strong><p>尚未配置 API，暂时无法智能陪聊。酒柜和本地推荐可以正常使用。<Link to="/settings">配置聊天模型</Link></p></div>}
      <div className="conversation" role="log" aria-label="聊天记录" aria-live="polite">
        {!loading && !messages.length && !pending && !failed && !error && (
          <div className={`welcome ${configured === false ? 'local-welcome' : ''}`}>
            <div className="welcome-icon"><MessageCircle size={28} strokeWidth={1.4} /></div>
            <h2>{configured === false ? '先看看酒柜里有什么？' : '今天过得怎么样？'}</h2>
            <p>{configured === false ? '选好材料与口味条件，就能从本地酒单里找一杯。' : <>想聊什么都可以。想喝一杯时，<br />我们再一起看看酒柜里有什么。</>}</p>
            {configured !== false && <div className="suggestions">
              {suggestions.map(s => <button key={s} onClick={() => { setDraft(s); textarea.current?.focus({ preventScroll: true }); }}>{s}</button>)}
            </div>}
          </div>
        )}
        {messages.map(message => (
          <article className={`message ${message.role}`} key={message.id}>
            <span className="message-author">{message.role === 'user' ? '我' : message.mode === 'local' ? 'Mixology · 本地模式' : 'Mixology'}</span>
            <p>{message.text}</p>
            {message.recipes.length > 0 && <>
              <p className="recommendation-note muted">{bar.error || bar.loading ? '当前酒柜尚未同步，暂时显示历史配方。' : '卡片按当前酒柜更新，聊天文字保留当时的建议。'}{bar.error && <button className="text-button" onClick={() => void bar.refresh()}>重新同步</button>}</p>
              <div className="recommendations">{message.recipes.map(r => {
                const current = bar.recipes.find(item => item.id === r.id);
                return <RecipeCard key={r.id} recipe={current ?? r} inventoryStatus={bar.error || bar.loading ? 'historical' : current ? 'current' : 'removed'} />;
              })}</div>
            </>}
            {message.traceId && <Link className="trace-link" to={`/settings?trace=${message.traceId}`}>查看本轮链路</Link>}
          </article>
        ))}
        {pending && (
          <>
            <article className="message user"><span className="message-author">我</span><p>{pending}</p></article>
            <article className="message assistant">
              <span className="message-author">Mixology</span>
              <p className="muted" role="status"><span className="typing" aria-hidden="true"><i /><i /><i /></span>{pendingMode === 'local' ? '正在处理本地请求…' : '正在听你说，也在想怎么回答…'}</p>
            </article>
          </>
        )}
        {loading && <p role="status" className="muted">正在找回上次的对话…</p>}
        {error && <div className="error" role="alert"><p>{error}</p>{failed && <><p>未发送成功：{failed}</p><button disabled={!!pending || clearing} onClick={() => void send(failed, draft.trim() === failed)}>重试这条消息</button><button onClick={() => { setLocalOpen(true); localOptions.current?.scrollIntoView({ block: 'start' }); }}>使用本地推荐</button></>}{failedTrace && <Link to={`/settings?trace=${failedTrace}`}>查看失败链路</Link>}{/配置|密钥|API Key|模型名称|API 地址|401|403/i.test(error) && <Link to="/settings">检查模型设置</Link>}</div>}
        <details className="local-options" ref={localOptions} open={localOpen} onToggle={e => setLocalOpen(e.currentTarget.open)}>
          <summary>本地查酒单 · 无需 API</summary>
          <LocalRecommendations />
        </details>
        <div className="bottom-anchor" ref={bottom} />
      </div>
      {!atBottom && messages.length > 0 && (
        <button className="to-latest" onClick={() => scrollToLatest()}>回到最新<ArrowDown size={14} /></button>
      )}
      <div className="composer-dock">
        <form className="composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="message">说点什么</label>
          <textarea
            id="message" ref={textarea} value={draft} maxLength={4000} rows={2}
            placeholder="说点什么，或者一起挑一杯酒…"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          />
          <button className="send-button" type="submit" disabled={!draft.trim() || !!pending || loading || clearing} aria-label="发送消息"><ArrowUp size={22} /></button>
        </form>
        <p className="composer-note">{pending ? '正在等待回复。可以先写下一句，切换页面也会保留。' : configured === false ? '未连接聊天模型。上方可直接查询本地酒单。' : 'Enter 发送 · Shift + Enter 换行。配方来自你的酒单。'}</p>
      </div>
    </section>
  );
}
