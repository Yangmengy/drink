import { useState, type ReactNode } from 'react';
import { MessageCircle, Plus, Trash2 } from 'lucide-react';
import { ClearChatDialog } from './ClearChatDialog';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat } from './ChatContext';
import { isNative } from '../api/client';

function formatTime(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}

export function ConversationDirectory({ children }: { children: ReactNode }) {
  const {
    conversations, conversationsLoading, creatingConversation, activeConversationId,
    messages, messagesLoading, pending, loading, clearing,
    createConversation, selectConversation, deleteConversation,
  } = useChat();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const busy = loading || clearing || pending || messagesLoading;


  const remove = async (id: string, title: string) => {
    if (busy || deletingId) return;
    if (!window.confirm(`删除「${title}」？消息会一并删除。`)) return;
    setDeletingId(id);
    try { await deleteConversation(id); } finally { setDeletingId(null); }
  };

  return (
    <aside className="session-rail" aria-label="会话目录" data-pathname={pathname}>
      <button
        type="button"
        className="new-conversation"
        disabled={isNative() || creatingConversation}
        onClick={() => { navigate('/'); void createConversation(); }}
      >
        <Plus size={16} strokeWidth={2} />
        {creatingConversation ? '正在新建…' : '新建对话'}
      </button>

      <button
        type="button"
        className="new-conversation clear-conversation"
        disabled={busy || !messages.length}
        onClick={() => setClearOpen(true)}
      >
        清空当前对话
      </button>

      <div className="rail-section">
        <h3>会话</h3>
        {conversationsLoading && <p className="muted">正在载入会话…</p>}
        {conversations.map(conversation => (
          <div className="conversation-row" key={conversation.id}>
            <button
              type="button"
              className={`conversation-item ${conversation.id === activeConversationId && pathname === '/' ? 'active' : ''}`}
              onClick={() => { navigate('/'); void selectConversation(conversation.id); }}
            >
              <MessageCircle size={15} strokeWidth={1.8} />
              <span>{conversation.title}</span>
              <small>
                {conversation.messageCount ? `${Math.ceil(conversation.messageCount / 2)} 轮` : '空对话'}
                {conversation.lastMessageAt ? ` · ${formatTime(conversation.lastMessageAt)}` : ''}
              </small>
            </button>
            <button
              type="button"
              className="conversation-delete"
              aria-label={`删除 ${conversation.title}`}
              disabled={deletingId !== null}
              onClick={() => void remove(conversation.id, conversation.title)}
            >
              <Trash2 size={14} strokeWidth={1.9} />
            </button>
          </div>
        ))}
        {!conversationsLoading && !conversations.length && (
          <p className="muted">点击上方新建第一个对话。</p>
        )}
      </div>

      {clearOpen && <ClearChatDialog onDismiss={() => setClearOpen(false)} />}

      <div className="session-rail-foot">
        <p>会话相互独立；新对话不会删除旧对话。</p>
        {children}
      </div>
    </aside>
  );
}
