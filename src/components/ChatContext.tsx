import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, errorText } from '../api/client';
import type { ChatMessage } from '../types';
interface ChatState { messages: ChatMessage[]; pending: string; loading: boolean; error: string; send: (message: string) => Promise<boolean>; clear: () => Promise<void> }
const Context = createContext<ChatState | null>(null);
export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { let active = true; api.history().then(data => { if (active) setMessages(data); }).catch(e => { if (active) setError(errorText(e)); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const send = async (message: string) => {
    if (pending || loading) return false;
    setPending(message); setError('');
    try {
      const response = await api.send(message);
      setMessages(current => [...current, { id: `${response.id}-user`, role: 'user', text: message, recipes: [] }, response]);
      return true;
    } catch (e) { setError(errorText(e)); return false; }
    finally { setPending(''); }
  };
  const clear = async () => {
    setError('');
    try { await api.clear(); setMessages([]); } catch (e) { setError(errorText(e)); }
  };
  return <Context.Provider value={{ messages, pending, loading, error, send, clear }}>{children}</Context.Provider>;
}
export function useChat() { const value = useContext(Context); if (!value) throw new Error('ChatProvider missing'); return value; }
