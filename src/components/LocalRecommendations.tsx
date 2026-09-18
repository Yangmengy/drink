import { useState } from 'react';
import { useChat } from './ChatContext';
import type { LocalRecommendationInput } from '../types';

export function LocalRecommendations({ onSearch }: { onSearch: (input: LocalRecommendationInput) => void }) {
  const { pending, loading, clearing, localError } = useChat();
  const [query, setQuery] = useState('');
  const [lessSweet, setLessSweet] = useState(false);
  const [sour, setSour] = useState(false);
  const [light, setLight] = useState(false);
  const search = (availability: LocalRecommendationInput['availability']) => onSearch({
    availability,
    query: { query: query.trim(), maxSweet: lessSweet ? 2 : undefined, minSour: sour ? 3 : undefined, maxStrong: light ? 2 : undefined },
  });
  return <form className="local-query form" onSubmit={e => { e.preventDefault(); search('ready'); }}>
    <p className="muted">直接查询这台设备的酒单，最多推荐 3 款。只按下面的条件筛选，不解析聊天文字或个人偏好。</p>
    <fieldset disabled={!!pending || loading || clearing}>
      <legend className="sr-only">本地推荐条件</legend>
      <label>酒名或原料关键词<input value={query} maxLength={200} placeholder="可留空，例如：金酒、柠檬" onChange={e => setQuery(e.target.value)} /></label>
      <div className="local-flavors">
        <label className="check-label"><input type="checkbox" checked={lessSweet} onChange={e => setLessSweet(e.target.checked)} />少甜（≤2）</label>
        <label className="check-label"><input type="checkbox" checked={sour} onChange={e => setSour(e.target.checked)} />偏酸（≥3）</label>
        <label className="check-label"><input type="checkbox" checked={light} onChange={e => setLight(e.target.checked)} />清淡口感（≤2）</label>
      </div>
      <p className="local-query-note muted">风味按 0–5 筛选；清淡口感不代表低酒精度。</p>
      <div className="local-query-actions">
        <button type="submit" className="button secondary">用现有材料推荐</button>
        <button type="button" className="button secondary" onClick={() => search('missingOne')}>只差一种材料</button>
        <button type="button" className="text-button" onClick={() => search('any')}>按缺料从少到多</button>
      </div>
    </fieldset>
    {localError && <p className="error" role="alert">本地查询未完成：{localError}。条件已保留，可以重新查询。</p>}
  </form>;
}
