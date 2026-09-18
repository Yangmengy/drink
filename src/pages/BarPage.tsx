import { useEffect, useRef, useState } from 'react';
import { Search, Check, Plus } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { useBar } from '../components/BarContext';
import { RecipeCard } from '../components/RecipeCard';
import type { Ingredient } from '../types';

export function BarPage() {
  const { ingredients, recipes, loading, error, refresh, view, setView } = useBar();
  const { tab, query, onlyOwned, filter } = view;
  const [mutationError, setMutationError] = useState('');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());
  const [params] = useSearchParams();
  const location = useLocation();
  const [notice, setNotice] = useState<string>(location.state?.notice ?? '');
  const target = params.get('recipe');
  const highlighted = useRef<HTMLDivElement>(null);
  const handledLocation = useRef('');
  useEffect(() => {
    if (handledLocation.current === location.key) return;
    handledLocation.current = location.key;
    setNotice(location.state?.notice ?? '');
    if (params.get('tab') === 'menu') setView({ ...view, tab: 'menu', query: '', filter: 'all' });
  }, [location.key, location.state, params, setView, view]);
  useEffect(() => {
    if (!loading && tab === 'menu' && target) highlighted.current?.scrollIntoView({ block: 'center' });
  }, [loading, tab, target, recipes]);

  async function toggle(item: Ingredient) {
    if (pending.current.has(item.id)) return;
    pending.current.add(item.id); setBusy(new Set(pending.current)); setMutationError('');
    try { await api.setOwned(item.id, !item.owned); await refresh(); }
    catch (e) { setMutationError(errorText(e)); }
    finally { pending.current.delete(item.id); setBusy(new Set(pending.current)); }
  }
  const q = query.trim().toLowerCase();
  const visibleIngredients = ingredients.filter(i => i.name.toLowerCase().includes(q) && (!onlyOwned || i.owned));
  const visibleRecipes = recipes.filter(r => `${r.name} ${r.nameEn} ${r.ingredients.map(i => i.name).join(' ')}`.toLowerCase().includes(q)
    && (filter === 'all' || (filter === 'ready' && r.canMake) || (filter === 'near' && r.missing.length === 1) || (filter === 'custom' && r.source === 'custom')));
  return <section>
    <header className="page-header"><span className="eyebrow">YOUR LITTLE BAR</span><Link className="icon-button" to="/custom" aria-label="创建自定义酒品"><Plus /></Link></header>
    {notice && <div className="notice save-notice" role="status"><span>{notice}</span><button className="icon-button" aria-label="关闭保存提示" onClick={() => setNotice('')}>×</button></div>}
    <div className="segmented" role="tablist" aria-label="酒柜内容">
      {(['ingredients', 'menu'] as const).map((value, index) => <button key={value} role="tab" id={`bar-tab-${value}`} aria-controls="bar-panel" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
        onClick={() => setView({ ...view, tab: value })}
        onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'ingredients' : e.key === 'End' ? 'menu' : value === 'menu' ? 'ingredients' : 'menu'; setView({ ...view, tab: next }); document.getElementById(`bar-tab-${next}`)?.focus(); } }}>
        {index === 0 ? '我的原料' : '酒单'} <small>{index === 0 ? ingredients.filter(i => i.owned).length : recipes.length}</small>
      </button>)}
    </div>
    <label className="search"><Search size={19} /><input aria-label={tab === 'ingredients' ? '搜索原料' : '搜索酒单'} placeholder={tab === 'ingredients' ? '找一找你的原料' : '搜索酒名或原料'} value={query} onChange={e => setView({ ...view, query: e.target.value })} /></label>
    {(error || mutationError) && <div className="error" role="alert">{mutationError || error}<button onClick={() => { setMutationError(''); void refresh(); }}>重新加载</button></div>}
    <div id="bar-panel" role="tabpanel" aria-labelledby={`bar-tab-${tab}`}>
      {loading ? <p className="empty" role="status">正在打开酒柜…</p> : tab === 'ingredients' ? <>
        <div className="section-line"><p className="muted">勾选已有材料；当前记录种类，不记录剩余用量。</p><label className="check-label"><input type="checkbox" checked={onlyOwned} onChange={e => setView({ ...view, onlyOwned: e.target.checked })} />只看已有</label></div>
        <div className="inventory-list">{visibleIngredients.map(i => <button key={i.id} className={`inventory-item ${i.owned ? 'owned' : ''}`} aria-pressed={i.owned} aria-busy={busy.has(i.id)} disabled={busy.has(i.id)} onClick={() => void toggle(i)}><span>{i.name}</span><span className="inventory-check" aria-hidden="true">{busy.has(i.id) ? '…' : i.owned && <Check size={16} />}</span></button>)}</div>
        {!visibleIngredients.length && <p className="empty">这里还没有匹配的材料。</p>}
      </> : <>
        <p className="section-line muted">内置配方和你的创作，都能在聊天时被找到。</p>
        <div className="menu-filters" role="group" aria-label="筛选酒单">{([['all', '全部'], ['ready', '现在能做'], ['near', '只差一种'], ['custom', '我的创作']] as const).map(([value, label]) => <button key={value} aria-pressed={filter === value} onClick={() => setView({ ...view, filter: value })}>{label}</button>)}</div>
        <div className="recipe-grid">{visibleRecipes.map(r => <div key={r.id} ref={r.id === target ? highlighted : undefined} className={r.id === target ? 'recipe-highlight' : ''}><RecipeCard recipe={r} inventoryStatus={error ? 'historical' : 'current'} /></div>)}</div>
        {!visibleRecipes.length && <p className="empty">没有匹配这次筛选的酒。<button className="text-button" onClick={() => setView({ ...view, query: '', filter: 'all' })}>重置筛选</button></p>}
      </>}
    </div>
  </section>;
}
