import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, errorText } from '../api/client';
import type { ChatMessage } from '../types';
interface ChatState {
  messages: ChatMessage[]; pending: string; loading: boolean; clearing: boolean; error: string;
  draft: string; setDraft: (text: string) => void; failed: string;
  send: (message: string, fromDraft?: boolean) => Promise<boolean>; clear: () => Promise<void>;
}
const Context = createContext<ChatState | null>(null);
export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState('');
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [draft, updateDraft] = useState('');
  const [failed, setFailed] = useState('');
  const busy = useRef(false);
  const draftRevision = useRef(0);
  const setDraft = (text: string) => { draftRevision.current++; updateDraft(text); };
  useEffect(() => { let active = true; api.history().then(data => { if (active) setMessages(data); }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const send = async (message: string, fromDraft = true) => {
    if (busy.current || loading || !message.trim()) return false;
    busy.current = true;
    const revision = draftRevision.current;
    if (fromDraft) updateDraft('');
    setPending(message); setError(''); setFailed('');
    try {
      const response = await api.send(message);
      setMessages(current => [...current, { id: `${response.id}-user`, role: 'user', text: message, recipes: [] }, response]);
      return true;
    } catch (e) {
      setError(errorText(e)); setFailed(message);
      if (fromDraft && revision === draftRevision.current) updateDraft(message);
      return false;
    } finally { setPending(''); busy.current = false; }
  };
  const clear = async () => {
    if (busy.current || loading) return;
    busy.current = true; setClearing(true); setError('');
    try { await api.clear(); setMessages([]); setFailed(''); } catch (e) { setError(errorText(e)); }
    finally { busy.current = false; setClearing(false); }
  };
  return <Context.Provider value={{ messages, pending, loading, clearing, error, draft, setDraft, failed, send, clear }}>{children}</Context.Provider>;
}
export function useChat() { const value = useContext(Context); if (!value) throw new Error('ChatProvider missing'); return value; }
