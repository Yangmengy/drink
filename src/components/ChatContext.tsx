import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, errorText, isNative } from '../api/client';
import type { ChatMessage, ChatStreamEvent, Conversation, LiveReply, LocalRecommendationInput } from '../types';

interface ChatState {
  conversations: Conversation[];
  conversationsLoading: boolean;
  creatingConversation: boolean;
  activeConversationId: string | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  pending: boolean;
  pendingMessage: string;
  loading: boolean;
  clearing: boolean;
  error: string;
  draft: string;
  setDraft: (text: string) => void;
  failed: string;
  send: (message: string, fromDraft?: boolean) => Promise<boolean>;
  clear: () => Promise<boolean>;
  createConversation: () => Promise<boolean>;
  selectConversation: (id: string) => Promise<boolean>;
  deleteConversation: (id: string) => Promise<boolean>;
  recommendLocal: (input: LocalRecommendationInput) => Promise<boolean>;
  localError: string;
  pendingMode: 'agent' | 'local';
  configured: boolean | null;
  setConfigured: (value: boolean | null) => void;
  liveReply: LiveReply;
}

const emptyLiveReply: LiveReply = { traceId: null, text: '', events: [] };
const Context = createContext<ChatState | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const native = isNative();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState('');
  const [localError, setLocalError] = useState('');
  const [pendingMode, setPendingMode] = useState<'agent' | 'local'>('agent');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [liveReply, setLiveReply] = useState<LiveReply>(emptyLiveReply);
  const streamRevision = useRef(0);
  const busy = useRef(false);
  const draftRevision = useRef(0);
  const activeConversationIdRef = useRef<string | null>(null);
  const draftsRef = useRef<Record<string, string>>({});
  const [draft, setDraftState] = useState('');
  const setDraft = (text: string) => {
    draftRevision.current++;
    const key = activeConversationIdRef.current ?? 'native';
    draftsRef.current[key] = text;
    setDraftState(text);
  };
  const loadDraft = (key: string | null) => setDraftState(draftsRef.current[key ?? 'native'] ?? '');

  const startStream = () => {
    const revision = ++streamRevision.current;
    setLiveReply(emptyLiveReply);
    return (event: ChatStreamEvent) => {
      if (revision !== streamRevision.current || busy.current !== true) return;
      setLiveReply(current => event.type === 'text'
        ? { ...current, traceId: event.traceId, text: event.text }
        : { ...current, traceId: event.traceId, events: [...current.events, event.event] });
    };
  };
  const finishStream = () => { streamRevision.current++; setLiveReply(emptyLiveReply); };

  const loadConversationMessages = async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const data = await api.conversationMessages(conversationId);
      setMessages(data);
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setError('');
      try {
        if (native) {
          const data = await api.history();
          if (active) setMessages(data);
          return;
        }
        const list = await api.conversations();
        if (!active) return;
        setConversations(list);
        const target = list.find(item => item.isActive) ?? list[0];
        if (!target) return;
        activeConversationIdRef.current = target.id;
        loadDraft(target.id);
        setActiveConversationId(target.id);
        await loadConversationMessages(target.id);
      } catch (reason) {
        if (active) setError(errorText(reason));
      } finally {
        if (active) { setLoading(false); setConversationsLoading(false); setMessagesLoading(false); }
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, [native]);

  const send = async (message: string, fromDraft = true) => {
    const text = message.trim();
    if (busy.current || loading || messagesLoading || !text) return false;
    busy.current = true;
    const revision = draftRevision.current;
    const conversationKey = activeConversationId ?? 'native';
    if (fromDraft) { draftsRef.current[conversationKey] = ''; setDraftState(''); }
    setPending(true);
    setPendingMessage(text);
    setPendingMode(configured === false ? 'local' : 'agent');
    setError(''); setFailed('');
    const onEvent = startStream();
    try {
      const response = await api.send(text, native ? undefined : activeConversationId ?? undefined, onEvent);
      if (response.mode === 'local') setConfigured(false); else setConfigured(true);
      setMessages(current => [...current, { id: `${response.id}-user`, role: 'user', text, recipes: [] }, response]);
      if (!native && response.mode === 'agent') void api.maintainContext(activeConversationId ?? undefined).catch(() => undefined);
      return true;
    } catch (reason) {
      setError(errorText(reason)); setFailed(text);
      if (fromDraft && revision === draftRevision.current) { draftsRef.current[conversationKey] = text; setDraftState(text); }
      return false;
    } finally {
      finishStream(); setPending(false); setPendingMessage(''); busy.current = false;
    }
  };

  const recommendLocal = async (input: LocalRecommendationInput) => {
    if (busy.current || loading || messagesLoading) return false;
    busy.current = true;
    setPendingMode('local');
    setPending(true);
    setPendingMessage('查询本地酒单');
    setLocalError('');
    const onEvent = startStream();
    try {
      const result = await api.recommendLocal(input, onEvent);
      setMessages(current => [...current, { id: `${result.message.id}-user`, role: 'user', text: result.request, recipes: [] }, result.message]);
      return true;
    } catch (reason) { setLocalError(errorText(reason)); return false; }
    finally { finishStream(); setPending(false); setPendingMessage(''); busy.current = false; }
  };

  const clear = async () => {
    if (busy.current || loading || clearing || (!native && !activeConversationId)) return false;
    busy.current = true; setClearing(true); setError('');
    try {
      await api.clear(native ? undefined : activeConversationId ?? undefined);
      setMessages([]); setFailed('');
      return true;
    } catch (reason) { setError(errorText(reason)); return false; }
    finally { busy.current = false; setClearing(false); }
  };

  const createConversation = async () => {
    if (native || creatingConversation || busy.current) return false;
    setCreatingConversation(true); setError('');
    try {
      const conversation = await api.createConversation({ idempotencyKey: crypto.randomUUID() });
      activeConversationIdRef.current = conversation.id;
      draftsRef.current[conversation.id] = '';
      setDraftState('');
      setConversations(current => [conversation, ...current.filter(item => item.id !== conversation.id)]);
      setActiveConversationId(conversation.id);
      setMessages([]); setFailed('');
      return true;
    } catch (reason) { setError(errorText(reason)); return false; }
    finally { setCreatingConversation(false); }
  };

  const selectConversation = async (conversationId: string) => {
    if (busy.current || clearing || conversationId === activeConversationId) return false;
    activeConversationIdRef.current = conversationId;
    setActiveConversationId(conversationId);
    loadDraft(conversationId);
    setError(''); setFailed(''); setLocalError('');
    try {
      await api.activateConversation(conversationId);
      await loadConversationMessages(conversationId);
      return true;
    } catch (reason) { setError(errorText(reason)); return false; }
  };

  const deleteConversation = async (conversationId: string) => {
    if (native || busy.current || clearing) return false;
    busy.current = true; setError('');
    try {
      const nextActiveId = await api.deleteConversation(conversationId);
      const list = await api.conversations();
      setConversations(list);
      activeConversationIdRef.current = nextActiveId;
      setActiveConversationId(nextActiveId);
      loadDraft(nextActiveId);
      await loadConversationMessages(nextActiveId);
      return true;
    } catch (reason) { setError(errorText(reason)); return false; }
    finally { busy.current = false; }
  };

  return <Context.Provider value={{
    conversations, conversationsLoading, creatingConversation, activeConversationId,
    messages, messagesLoading, pending, pendingMessage, loading, clearing,
    error, draft, setDraft, failed, send, clear, createConversation, selectConversation,
    deleteConversation, recommendLocal, localError, pendingMode, configured, setConfigured, liveReply,
  }}>{children}</Context.Provider>;
}

export function useChat() {
  const value = useContext(Context);
  if (!value) throw new Error('ChatProvider missing');
  return value;
}
