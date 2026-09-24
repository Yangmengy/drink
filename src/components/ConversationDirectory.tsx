import { useMemo, type ReactNode } from 'react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat } from './ChatContext';

function conversationTitle(text: string | undefined) {
  const value = text?.trim();
  if (!value) return '新的对话';
  return value.length > 32 ? `${value.slice(0, 32)}…` : value;
}

export function ConversationDirectory({ children }: { children: ReactNode }) {
  const { messages, pending, loading, clearing, requestNewConversation } = useChat();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const title = useMemo(
    () => conversationTitle(pending || [...messages].reverse().find(m => m.role === 'user')?.text),
    [messages, pending],
  );
  const turnCount = messages.length / 2 + (pending ? 0.5 : 0);

  return (
    <aside className="session-rail" aria-label="会话目录" data-pathname={pathname}>
      <button
        type="button"
        className="new-conversation"
        disabled={loading || clearing || !!pending}
        onClick={() => {
          navigate('/');
          if (messages.length) requestNewConversation();
        }}
      >
        <Plus size={16} strokeWidth={2} />
        新建对话
      </button>

      <div className="rail-section">
        <h3>会话</h3>
        <div className="conversation-row">
          <button
            type="button"
            className={`conversation-item ${pathname === '/' ? 'active' : ''}`}
            onClick={() => navigate('/')}
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            <span>{title}</span>
            <small>{loading ? '载入中' : turnCount ? `${Math.ceil(turnCount)} 轮` : '空对话'}</small>
          </button>
          <button
            type="button"
            className="conversation-delete"
            aria-label="清空对话"
            disabled={loading || clearing || !!pending}
            onClick={() => {
              navigate('/');
              requestNewConversation();
            }}
          >
            <Trash2 size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="session-rail-foot">
        <p>当前保存一个连续对话。清空确认后可开始新对话。</p>
        {children}
      </div>
    </aside>
  );
}
