import { useEffect, useState } from 'react';
import { Search, Check, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api/client';
import { RecipeCard } from '../components/RecipeCard';
import type { Ingredient, Recipe } from '../types';
export function BarPage() {
  const [tab, setTab] = useState<'ingredients' | 'menu'>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [query, setQuery] = useState(''); const [onlyOwned, setOnlyOwned] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const load = async () => { setError(''); setLoading(true); try { const [i, r] = await Promise.all([api.ingredients(), api.menu()]); setIngredients(i); setRecipes(r); } catch (e) { setError(errorText(e)); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  async function toggle(i: Ingredient) { setBusy(true); setError(''); try { await api.setOwned(i.id, !i.owned); const [items, menu] = await Promise.all([api.ingredients(), api.menu()]); setIngredients(items); setRecipes(menu); } catch (e) { setError(errorText(e)); } finally { setBusy(false); } }
  const q = query.toLowerCase();
  const visibleIngredients = ingredients.filter(i => i.name.toLowerCase().includes(q) && (!onlyOwned || i.owned));
  const visibleRecipes = recipes.filter(r => `${r.name} ${r.nameEn} ${r.ingredients.map(i => i.name).join(' ')}`.toLowerCase().includes(q));
  return <section><header className="page-header"><span className="eyebrow">YOUR LITTLE BAR</span><Link className="icon-button" to="/custom" aria-label="创建自定义酒品"><Plus /></Link></header>
    <div className="segmented" role="tablist" aria-label="酒柜内容"><button role="tab" aria-selected={tab === 'ingredients'} onClick={() => setTab('ingredients')}>我的原料 <small>{ingredients.filter(i => i.owned).length}</small></button><button role="tab" aria-selected={tab === 'menu'} onClick={() => setTab('menu')}>酒单 <small>{recipes.length}</small></button></div>
    <label className="search"><Search size={19} /><input aria-label={tab === 'ingredients' ? '搜索原料' : '搜索酒单'} placeholder={tab === 'ingredients' ? '找一找你的原料' : '搜索酒名或原料'} value={query} onChange={e => setQuery(e.target.value)} /></label>
    {error && <div className="error" role="alert">{error}<button onClick={() => void load()}>重新加载</button></div>}
    {loading ? <p className="empty" role="status">正在打开酒柜…</p> : tab === 'ingredients' ? <><div className="section-line"><p className="muted">勾选已有材料；当前记录种类，不记录剩余用量。</p><label className="check-label"><input type="checkbox" checked={onlyOwned} onChange={e => setOnlyOwned(e.target.checked)} />只看已有</label></div><div className="inventory-list">{visibleIngredients.map(i => <button key={i.id} className={`inventory-item ${i.owned ? 'owned' : ''}`} aria-pressed={i.owned} disabled={busy} onClick={() => void toggle(i)}><span>{i.name}</span><span className="inventory-check">{i.owned && <Check size={16} />}</span></button>)}</div>{!visibleIngredients.length && <p className="empty">这里还没有匹配的材料。</p>}</> : <><p className="section-line muted">内置配方和你的创作，都能在聊天时被找到。</p><div className="recipe-grid">{visibleRecipes.map(r => <RecipeCard key={r.id} recipe={r} />)}</div>{!visibleRecipes.length && <p className="empty">没有找到这款酒。<Link to="/custom">记下自己的配方</Link></p>}</>}
  </section>;
}
