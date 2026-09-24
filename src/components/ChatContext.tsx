import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, errorText, errorTraceId, isNative } from '../api/client';
import type { ChatMessage, ChatStreamEvent, LiveReply, LocalRecommendationInput } from '../types';
interface ChatState {
  messages: ChatMessage[]; pending: string; loading: boolean; clearing: boolean; error: string;
  draft: string; setDraft: (text: string) => void; failed: string;
  send: (message: string, fromDraft?: boolean) => Promise<boolean>; clear: () => Promise<boolean>;
  recommendLocal: (input: LocalRecommendationInput) => Promise<boolean>;
  localError: string; pendingMode: 'agent' | 'local';
  configured: boolean | null; setConfigured: (value: boolean | null) => void;
  liveReply: LiveReply;
  newConversationRequested: boolean;
  requestNewConversation: () => void;
  consumeNewConversationRequest: () => void;
}
const emptyLiveReply: LiveReply = { traceId: null, text: '', events: [] };
const Context = createContext<ChatState | null>(null);
export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [draft, updateDraft] = useState('');
  const [failed, setFailed] = useState('');
  const [localError, setLocalError] = useState('');
  const [pendingMode, setPendingMode] = useState<'agent' | 'local'>('agent');
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [liveReply, setLiveReply] = useState<LiveReply>(emptyLiveReply);
  const [newConversationRequested, setNewConversationRequested] = useState(false);
  const streamRevision = useRef(0);
  const busy = useRef(false);
  const draftRevision = useRef(0);
  const setDraft = (text: string) => { draftRevision.current++; updateDraft(text); };
  const startStream = () => {
    const revision = ++streamRevision.current;
    setLiveReply(emptyLiveReply);
    return (event: ChatStreamEvent) => {
      if (revision !== streamRevision.current || !busy.current) return;
      setLiveReply(current => event.type === 'text'
        ? { ...current, traceId: event.traceId, text: event.text }
        : { ...current, traceId: event.traceId, events: [...current.events, event.event] });
    };
  };
  const finishStream = () => { streamRevision.current++; setLiveReply(emptyLiveReply); };
  useEffect(() => { let active = true; api.history().then(data => { if (active) setMessages(data); }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const send = async (message: string, fromDraft = true) => {
    if (busy.current || loading || !message.trim()) return false;
    busy.current = true;
    const revision = draftRevision.current;
    if (fromDraft) updateDraft('');
    setPendingMode(configured === false ? 'local' : 'agent');
    setPending(message); setError(''); setFailed('');
    const onEvent = startStream();
    try {
      const response = await api.send(message, onEvent);
      if (response.mode === 'local') setConfigured(false);
      else setConfigured(true);
      setMessages(current => [...current, { id: `${response.id}-user`, role: 'user', text: message, recipes: [] }, response]);
      if (!isNative() && response.mode === 'agent') {
        void api.maintainContext().catch(() => undefined);
      }
      return true;
    } catch (e) {
      setError(errorText(e)); setFailed(message);
      if (fromDraft && revision === draftRevision.current) updateDraft(message);
      return false;
    } finally { finishStream(); setPending(''); busy.current = false; }
  };
  const recommendLocal = async (input: LocalRecommendationInput) => {
    if (busy.current || loading) return false;
    busy.current = true; setPendingMode('local'); setPending('查询本地酒单'); setLocalError('');
    const onEvent = startStream();
    try {
      const result = await api.recommendLocal({ ...input, afterTraceId: failed ? errorTraceId(error) : null }, onEvent);
      setMessages(current => [...current, { id: `${result.message.id}-user`, role: 'user', text: result.request, recipes: [] }, result.message]);
      return true;
    } catch (e) { setLocalError(errorText(e)); return false; }
    finally { finishStream(); setPending(''); busy.current = false; }
  };
  const clear = async () => {
    if (busy.current || loading) return false;
    busy.current = true; setClearing(true); setError('');
    try { await api.clear(); setMessages([]); setFailed(''); setLocalError(''); return true; } catch (e) { setError(errorText(e)); return false; }
    finally { busy.current = false; setClearing(false); }
  };
  return <Context.Provider value={{
    messages, pending, loading, clearing, error, draft, setDraft, failed, send, clear, recommendLocal,
    localError, pendingMode, configured, setConfigured, liveReply, newConversationRequested,
    requestNewConversation: () => setNewConversationRequested(true),
    consumeNewConversationRequest: () => setNewConversationRequested(false),
  }}>{children}</Context.Provider>;
}
export function useChat() { const value = useContext(Context); if (!value) throw new Error('ChatProvider missing'); return value; }
