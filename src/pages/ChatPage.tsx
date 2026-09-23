import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, MessageCircle, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useChat } from '../components/ChatContext';
import { useBar } from '../components/BarContext';
import { RecipeCard } from '../components/RecipeCard';
import { RecipeFeedback } from '../components/RecipeFeedback';
import { LocalRecommendations } from '../components/LocalRecommendations';
import { ChatTracePanel } from '../components/ChatTracePanel';
import { ClearChatDialog } from '../components/ClearChatDialog';
import { api, errorTraceId } from '../api/client';
import type { ChatMessage, LocalRecommendationInput } from '../types';
import '../styles/chat-composer.css';
import '../styles/chat-reply.css';

const suggestions = ['今天想随便聊聊', '用我现有的材料，做一杯不太甜的酒', '有点累，陪我待一会儿'];

export function ChatPage() {
  const { messages, pending, loading, clearing, error, draft, setDraft, failed, send, pendingMode, configured, setConfigured, recommendLocal, localError, liveReply } = useChat();
  const bar = useBar();
  const [atBottom, setAtBottom] = useState(true);
  const followLatest = useRef(true);
  const lastScrollY = useRef(0);
  const conversation = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const didInitScroll = useRef(false);
  const [localOpen, setLocalOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  // 远端失败后，用户转用本地推荐时记录插入点；本地结果出现后，失败框留在原位。
  const [failedTurnAnchor, setFailedTurnAnchor] = useState<number | null>(null);
  const chatTop = useRef<HTMLDivElement>(null);
  const localOptions = useRef<HTMLDetailsElement>(null);
  const latestTurn = useRef<HTMLElement>(null);
  const awaitingLocalReply = useRef(false);
  const failedTrace = errorTraceId(error);
  useEffect(() => {
    let active = true;
    api.settings().then(s => { if (active) setConfigured(s.apiKeyConfigured); }).catch(() => { if (active) setConfigured(null); });
    return () => { active = false; };
  }, [setConfigured]);

  useEffect(() => {
    if (!messages.length) setFailedTurnAnchor(null);
  }, [messages.length]);

  const isDesktopChat = () => window.matchMedia('(min-width: 1000px)').matches;
  const currentScrollY = () => (isDesktopChat() ? conversation.current?.scrollTop ?? 0 : window.scrollY);
  const isAtBottom = () => {
    const el = conversation.current;
    if (isDesktopChat() && el) return el.scrollHeight - el.clientHeight - el.scrollTop <= 16;
    return document.documentElement.scrollHeight - window.innerHeight - window.scrollY <= 16;
  };
  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const el = conversation.current;
    if (isDesktopChat() && el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
      lastScrollY.current = el.scrollTop;
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
      lastScrollY.current = window.scrollY;
    }
  };
  const shouldFollowLatest = () => {
    // 滚动位置可能先于 scroll 事件更新；同一帧到达的分片也不能把上翻的用户拉回去。
    if (currentScrollY() < lastScrollY.current - 1 && !isAtBottom()) followLatest.current = false;
    return followLatest.current;
  };

  // 定位新消息时，为固定的页头和推荐面板留出实际高度。
  useLayoutEffect(() => {
    const el = chatTop.current;
    if (!el) return;
    const measure = () => el.parentElement?.style.setProperty('--chat-top-height', `${el.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [localOpen]);

  // 以页面实际底部判断按钮显隐；消息增长只更新按钮，不改变用户的跟随意愿。
  useEffect(() => {
    const measure = () => setAtBottom(isAtBottom());
    const onScroll = () => {
      followLatest.current = isAtBottom();
      lastScrollY.current = currentScrollY();
      setAtBottom(followLatest.current);
    };
    measure();
    conversation.current?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    if (conversation.current) observer.observe(conversation.current);
    return () => {
      conversation.current?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  // 空对话从页首展示；只有确实存在历史消息时才定位到最后一条。
  useLayoutEffect(() => {
    if (!loading && !didInitScroll.current) {
      didInitScroll.current = true;
      if (messages.length) scrollToLatest('auto');
      else if (isDesktopChat() && conversation.current) conversation.current.scrollTo({ top: 0, behavior: 'auto' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (!loading && !messages.length && !pending && !failed && !error) {
      // 清空对话后恢复欢迎页，不能保留上一段对话的滚动位置。
      if (isDesktopChat() && conversation.current) conversation.current.scrollTo({ top: 0, behavior: 'auto' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [loading, messages.length, pending, failed, error]);

  // 自己发送消息时总是滚到底；收到回复时，只有停留在底部才跟随，上翻阅读时不打断。
  // 自动滚动一律用 instant：平滑动画在 Chromium 里不会被程序化的 instant scrollTo 打断，
  // 用户上翻后动画继续走，会把页面拽走（即"僵尸滚动"）。
  useEffect(() => { if (pending) scrollToLatest('auto'); }, [pending]);
  useLayoutEffect(() => {
    if (pending && shouldFollowLatest()) scrollToLatest('auto');
  }, [liveReply.text, liveReply.events.length]);
  // 底部可见性和错误变化本身不触发滚动，避免把欢迎页推到固定页头后面。
  useEffect(() => {
    if (!messages.length) return;
    if (awaitingLocalReply.current) {
      awaitingLocalReply.current = false;
      if (shouldFollowLatest()) {
        latestTurn.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        latestTurn.current?.focus({ preventScroll: true });
      }
    } else if (shouldFollowLatest()) scrollToLatest('auto');
  }, [messages]);

  useLayoutEffect(() => {
    if (localOpen && localError) localOptions.current?.querySelector('[role="alert"]')?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }, [localOpen, localError]);

  async function searchLocal(input: LocalRecommendationInput) {
    if (pending || loading || clearing) return;
    if (failed && error) setFailedTurnAnchor(messages.length);
    awaitingLocalReply.current = true;
    followLatest.current = true;
    setLocalOpen(false);
    if (!await recommendLocal(input)) {
      awaitingLocalReply.current = false;
      setLocalOpen(true);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || pending || loading || clearing) return;
    setFailedTurnAnchor(null);
    followLatest.current = true;
    void send(text);
    textarea.current?.focus({ preventScroll: true });
  }

  const failedAnchor = failed && error && failedTurnAnchor !== null && failedTurnAnchor < messages.length
    ? failedTurnAnchor
    : null;
  const failedInsertAt = failedAnchor ?? messages.length;

  const renderMessage = (message: ChatMessage, index: number) => (
    <article
      className={`message ${message.role}`}
      key={message.id}
      ref={index === messages.length - 2 ? latestTurn : undefined}
      tabIndex={-1}
    >
      <span className="message-author">{message.role === 'user' ? '我' : message.mode === 'local' ? 'Bartender · 本地模式' : 'Bartender'}</span>
      {message.traceId && <ChatTracePanel traceId={message.traceId} />}
      {message.role === 'assistant' ? (
        <div className="assistant-content">
          <p>{message.text}</p>
          {message.recipes.length > 0 && <>
            <p className="recommendation-note muted">{bar.error || bar.loading ? '当前酒柜尚未同步，暂时显示历史配方。' : '卡片按当前酒柜更新，聊天文字保留当时的建议。'}{bar.error && <button className="text-button" onClick={() => void bar.refresh()}>重新同步</button>}</p>
            <div className="recommendations">{message.recipes.map(r => {
              const current = bar.recipes.find(item => item.id === r.id);
              return <RecipeCard
                key={r.id}
                recipe={current ?? r}
                inventoryStatus={bar.error || bar.loading ? 'historical' : current ? 'current' : 'removed'}
                feedback={(
                  <RecipeFeedback
                    recipeId={r.id}
                    contextId={message.traceId || message.id}
                    traceId={message.traceId}
                  />
                )}
              />;
            })}</div>
          </>}
        </div>
      ) : <p>{message.text}</p>}
    </article>
  );

  return (
    <section className="chat-page">
      <div className="chat-top" ref={chatTop}>
        <header className="page-header">
          <span className="eyebrow">A LITTLE COMPANY</span>
          <button className="icon-button" aria-label="清空对话" title={messages.length ? '清空对话和上下文' : '暂无对话可清空'} disabled={loading || !!pending || clearing || !messages.length} onClick={() => setClearOpen(true)}>
            <Trash2 size={19} />
          </button>
        </header>
        <details className="local-options" ref={localOptions} open={localOpen} onToggle={e => setLocalOpen(e.currentTarget.open)}>
          <summary>调整推荐条件 · 本地酒单</summary>
          <LocalRecommendations onSearch={input => void searchLocal(input)} />
        </details>
      </div>
      {configured === false && <div className="notice local-mode" role="status"><strong>本地模式</strong><p>尚未配置 API，暂时无法智能陪聊。酒柜和本地推荐可以正常使用。<Link to="/settings">配置聊天模型</Link></p></div>}
      <div className="conversation" ref={conversation} role="log" aria-label="聊天记录" aria-live="polite">
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
        {messages.slice(0, failedInsertAt).map(renderMessage)}
        {failedAnchor !== null && (
          <div className="error archived" role="note">
            <p>{error}</p>
            {failed && <>
              <p>未发送成功：{failed}</p>
              <button disabled={!!pending || clearing} onClick={() => { setFailedTurnAnchor(null); void send(failed, draft.trim() === failed); }}>重试这条消息</button>
              <button onClick={() => { setFailedTurnAnchor(messages.length); setLocalOpen(true); }}>使用本地推荐</button>
            </>}
            {failedTrace && <ChatTracePanel traceId={failedTrace} label="查看失败链路" />}
            {/配置|密钥|API Key|模型名称|API 地址|401|403/i.test(error) && <Link to="/settings">检查模型设置</Link>}
          </div>
        )}
        {messages.slice(failedInsertAt).map(renderMessage)}
        {pending && (
          <>
            <article className="message user"><span className="message-author">我</span><p>{pending}</p></article>
            <article className="message assistant">
              <span className="message-author">{pendingMode === 'local' ? 'Bartender · 本地模式' : 'Bartender'}</span>
              {liveReply.traceId && <ChatTracePanel traceId={liveReply.traceId} liveEvents={liveReply.events} />}
              <div className="assistant-content">
                {liveReply.text ? <p className="streaming-reply">{liveReply.text}</p> : <p className="muted" role="status"><span className="typing" aria-hidden="true"><i /><i /><i /></span>{pendingMode === 'local' ? '正在处理本地请求…' : '正在听你说，也在想怎么回答…'}</p>}
              </div>
            </article>
          </>
        )}
        {loading && <p role="status" className="muted">正在找回上次的对话…</p>}
        {failedAnchor === null && error && <div className="error" role="alert"><p>{error}</p>{failed && <><p>未发送成功：{failed}</p><button disabled={!!pending || clearing} onClick={() => { setFailedTurnAnchor(null); void send(failed, draft.trim() === failed); }}>重试这条消息</button><button onClick={() => { setFailedTurnAnchor(messages.length); setLocalOpen(true); }}>使用本地推荐</button></>}{failedTrace && <ChatTracePanel traceId={failedTrace} label="查看失败链路" />}{/配置|密钥|API Key|模型名称|API 地址|401|403/i.test(error) && <Link to="/settings">检查模型设置</Link>}</div>}
      </div>
      {!atBottom && messages.length > 0 && (
        <button className="to-latest" onClick={() => scrollToLatest()}>回到最新<ArrowDown size={14} /></button>
      )}
      <div className="composer-dock">
        <form className="composer" onSubmit={submit}>
          <label className="sr-only" htmlFor="message">说点什么</label>
          <textarea
            id="message" ref={textarea} value={draft} maxLength={4000} rows={2} aria-describedby="message-help"
            placeholder="说点什么，或者一起挑一杯酒…"
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          />
          <button className="send-button" type="submit" disabled={!draft.trim() || !!pending || loading || clearing} aria-label="发送消息"><ArrowUp size={16} /></button>
        </form>
        <p id="message-help" className="sr-only">{pending ? '正在等待回复。可以先写下一句，切换页面也会保留。' : configured === false ? '未连接聊天模型。上方可直接查询本地酒单。' : 'Enter 发送 · Shift + Enter 换行。配方来自你的酒单。'}</p>
      </div>
      {clearOpen && <ClearChatDialog onDismiss={() => setClearOpen(false)} />}
    </section>
  );
}
