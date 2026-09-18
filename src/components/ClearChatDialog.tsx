import { useEffect, useRef, useState } from 'react';
import { useChat } from './ChatContext';
import '../styles/clear-chat-dialog.css';

export function ClearChatDialog({ onDismiss }: { onDismiss: () => void }) {
  const { clear, clearing, error } = useChat();
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  async function confirm() {
    if (submitting.current || clearing) return;
    submitting.current = true;
    setAttempted(true);
    try {
      if (await clear()) onDismiss();
    } finally {
      submitting.current = false;
    }
  }

  return (
    <dialog
      ref={dialog}
      className="clear-chat-dialog"
      aria-labelledby="clear-chat-title"
      aria-describedby="clear-chat-description"
      aria-busy={clearing}
      onCancel={event => {
        event.preventDefault();
        if (!submitting.current && !clearing) onDismiss();
      }}
    >
      <h2 id="clear-chat-title">清空这段对话？</h2>
      <p id="clear-chat-description">聊天记录和 Agent 上下文将被清除，无法恢复。</p>
      {attempted && error && <p className="clear-chat-error" role="alert">{error}</p>}
      <div className="clear-chat-actions">
        <button className="button secondary" autoFocus disabled={clearing} onClick={onDismiss}>取消</button>
        <button className="button clear-chat-confirm" disabled={clearing} onClick={() => void confirm()}>
          {clearing ? '正在清空…' : '确认清空'}
        </button>
      </div>
    </dialog>
  );
}
