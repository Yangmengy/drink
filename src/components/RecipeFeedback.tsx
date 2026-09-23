import { useState } from 'react';
import { Check, ChefHat, SlidersHorizontal, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api, errorText, isNative } from '../api/client';
import type { ProfileEventInput, ProfileEventType } from '../types';

type FeedbackAction = {
  key: string;
  eventType: ProfileEventType;
  label: string;
  savedLabel: string;
  payload?: Record<string, string>;
};

const primaryActions: FeedbackAction[] = [
  { key: 'like', eventType: 'like', label: '喜欢', savedLabel: '已记喜欢' },
  { key: 'dislike', eventType: 'dislike', label: '不喜欢', savedLabel: '已记不喜欢' },
  { key: 'make', eventType: 'make', label: '做过', savedLabel: '已记做过' },
];

const adjustmentActions: FeedbackAction[] = [
  { key: 'sweet-lower', eventType: 'feedback', label: '太甜', savedLabel: '已记太甜', payload: { dimension: 'sweet', direction: 'lower' } },
  { key: 'sour-lower', eventType: 'feedback', label: '太酸', savedLabel: '已记太酸', payload: { dimension: 'sour', direction: 'lower' } },
  { key: 'bitter-lower', eventType: 'feedback', label: '太苦', savedLabel: '已记太苦', payload: { dimension: 'bitter', direction: 'lower' } },
  { key: 'strong-lower', eventType: 'feedback', label: '太烈', savedLabel: '已记太烈', payload: { dimension: 'strong', direction: 'lower' } },
];

function actionKey(action: FeedbackAction) {
  return action.eventType === 'feedback' ? `feedback:${action.key}` : action.key;
}

export function RecipeFeedback({ recipeId, contextId, traceId }: {
  recipeId: string;
  contextId: string;
  traceId?: string | null;
}) {
  const [status, setStatus] = useState<Record<string, 'pending' | 'saved'>>({});
  const [error, setError] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const savedCount = Object.values(status).filter(value => value === 'saved').length;
  const pending = Object.values(status).some(value => value === 'pending');

  if (isNative()) return null;

  const submit = async (action: FeedbackAction) => {
    const key = actionKey(action);
    if (status[key] === 'pending' || status[key] === 'saved') return;
    const input: ProfileEventInput = {
      eventType: action.eventType,
      recipeId,
      payload: action.payload ?? {},
      idempotencyKey: `recommendation:${contextId}:${recipeId}:${key}`.slice(0, 200),
      traceId: traceId ?? null,
    };
    setStatus(current => ({ ...current, [key]: 'pending' }));
    setError('');
    try {
      await api.recordProfileEvent(input);
      setStatus(current => ({ ...current, [key]: 'saved' }));
    } catch (e) {
      setStatus(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setError(errorText(e));
    }
  };

  const renderAction = (action: FeedbackAction) => {
    const key = actionKey(action);
    const state = status[key];
    const icon = action.key === 'like'
      ? <ThumbsUp size={13} />
      : action.key === 'dislike' ? <ThumbsDown size={13} /> : <Check size={13} />;
    return (
      <button
        key={key}
        type="button"
        className={`feedback-action${state === 'saved' ? ' saved' : ''}`}
        disabled={state === 'pending' || state === 'saved'}
        onClick={() => void submit(action)}
      >
        {icon}
        {state === 'saved' ? action.savedLabel : action.label}
      </button>
    );
  };

  return (
    <div className="recipe-feedback" aria-busy={pending}>
      <div className="feedback-actions" aria-label={`${recipeId} 推荐反馈`}>
        {primaryActions.map(renderAction)}
        <button
          type="button"
          className={`feedback-action adjust${adjustOpen ? ' open' : ''}`}
          aria-expanded={adjustOpen}
          onClick={() => setAdjustOpen(open => !open)}
        >
          <SlidersHorizontal size={13} />
          调整口味
        </button>
      </div>
      {adjustOpen && (
        <div className="feedback-adjustments">
          <span className="feedback-title"><ChefHat size={13} />哪里不太合适？</span>
          <div className="feedback-actions">{adjustmentActions.map(renderAction)}</div>
        </div>
      )}
      <p className="feedback-status" role="status">
        {error ? `反馈未保存：${error}` : savedCount > 0 ? '已用于调整你的口味画像。' : ''}
      </p>
    </div>
  );
}
