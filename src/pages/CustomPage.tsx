import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { api, errorText } from '../api/client';
import type { RecipeInput } from '../types';
import { useBar } from '../components/BarContext';

const empty = (): RecipeInput => ({
  id: null, name: '', description: '', method: '摇和',
  flavor: { sweet: 2, sour: 2, bitter: 1, strong: 2 },
  ingredients: [{ name: '', amount: 30, unit: 'ml', optional: false }],
  steps: [''],
});

export function CustomPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = params.get('id');
  const { ingredients, recipes, loading, error: loadError, refresh, drafts, saveDraft, discardDraft } = useBar();
  const draftKey = id ?? 'new';
  const custom = recipes.filter(r => r.source === 'custom');
  const recipe = custom.find(r => r.id === id);
  const initial: RecipeInput = recipe ? {
    id: recipe.id, name: recipe.name, description: recipe.description, method: recipe.method,
    flavor: recipe.flavor ?? empty().flavor,
    ingredients: recipe.ingredients.map(i => ({ name: i.name, amount: i.amount ?? 1, unit: i.unit ?? '份', optional: i.optional })),
    steps: recipe.steps,
  } : empty();
  const form = drafts[draftKey] ?? initial;
  const setForm = (value: RecipeInput) => saveDraft(draftKey, value);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const operation = useRef(false);
  const routeRevision = useRef(0);
  useEffect(() => { setError(''); setSaving(false); operation.current = false; return () => { routeRevision.current++; }; }, [id]);
  const missing = !loading && id && !recipe;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (operation.current || missing) return;
    operation.current = true;
    const revision = routeRevision.current;
    setSaving(true); setError('');
    try {
      const savedId = await api.saveRecipe(form);
      discardDraft(draftKey, form);
      await refresh();
      if (revision === routeRevision.current) navigate(`/bar?tab=menu&recipe=${encodeURIComponent(savedId)}`, { state: { notice: `“${form.name}”已保存到酒单，聊天时也能找到它。` } });
    } catch (e) { if (revision === routeRevision.current) setError(errorText(e)); }
    finally { if (revision === routeRevision.current) { operation.current = false; setSaving(false); } }
  }

  async function remove() {
    if (operation.current || !form.id || !window.confirm(`删除“${form.name}”？这款自创酒将从菜单中移除。`)) return;
    operation.current = true;
    const revision = routeRevision.current;
    setSaving(true); setError('');
    try {
      await api.deleteRecipe(form.id); discardDraft(draftKey); await refresh();
      if (revision === routeRevision.current) navigate('/bar?tab=menu', { state: { notice: `“${form.name}”已从酒单移除。` } });
    } catch (e) { if (revision === routeRevision.current) setError(errorText(e)); }
    finally { if (revision === routeRevision.current) { operation.current = false; setSaving(false); } }
  }

  return (
    <section>
      <header className="page-header">
        <span className="eyebrow">MAKE IT YOURS</span>
      </header>
      {(error || loadError || missing) && <div className="error" role="alert">{error || loadError || '找不到可编辑的自创配方。'}{loadError && <button onClick={() => void refresh()}>重新加载</button>}</div>}
      {loading ? <p role="status" className="empty">正在准备配方本…</p> : missing || loadError ? null : (
        <div className="editor-layout">
          <form className="editor form" onSubmit={submit}>
            <fieldset disabled={saving}>
              <legend className="sr-only">自创配方</legend>
              <div className="draft-note"><p className="muted">{drafts[draftKey] ? '草稿已暂存，切换页面不会丢失；关闭应用前请保存。' : '写下你的配方，保存后就能在聊天中被找到。'}</p>{drafts[draftKey] && <button type="button" className="text-button" onClick={() => { if (window.confirm('放弃这份未保存的修改？')) discardDraft(draftKey); }}>放弃修改</button>}</div>
              <div className="form-row">
                <label>酒品名称<input required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="给这杯酒起个名字" /></label>
                <label>调制方法<select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>{['摇和', '搅拌', '直调', '搅打', '其他', ...(form.method && !['摇和', '搅拌', '直调', '搅打', '其他'].includes(form.method) ? [form.method] : [])].map(m => <option key={m}>{m}</option>)}</select></label>
              </div>
              <label>风味与灵感<textarea rows={3} maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="什么味道，适合什么时刻…" /></label>

              <h2 className="form-heading">准备什么</h2>
              <datalist id="ingredient-names">{ingredients.map(i => <option value={i.name} key={i.id} />)}</datalist>
              {form.ingredients.map((ingredient, index) => (
                <div className="ingredient-editor" key={index}>
                  <label>原料<span className="sr-only"> {index + 1}</span><input required list="ingredient-names" value={ingredient.name} maxLength={80} placeholder="原料名称" onChange={e => setForm({ ...form, ingredients: form.ingredients.map((i, n) => n === index ? { ...i, name: e.target.value } : i) })} /></label>
                  <label>用量<span className="sr-only"> {index + 1}</span><input required type="number" min="0.01" max="10000" step="any" value={Number.isFinite(ingredient.amount) ? ingredient.amount : ''} onChange={e => setForm({ ...form, ingredients: form.ingredients.map((i, n) => n === index ? { ...i, amount: e.target.valueAsNumber } : i) })} /></label>
                  <label>单位<span className="sr-only"> {index + 1}</span><input required maxLength={16} value={ingredient.unit} onChange={e => setForm({ ...form, ingredients: form.ingredients.map((i, n) => n === index ? { ...i, unit: e.target.value } : i) })} /></label>
                  <label className="check-label"><input type="checkbox" checked={ingredient.optional} onChange={e => setForm({ ...form, ingredients: form.ingredients.map((i, n) => n === index ? { ...i, optional: e.target.checked } : i) })} />可选</label>
                  <button type="button" className="icon-button" aria-label={`移除原料 ${index + 1}`} disabled={form.ingredients.length <= 1} onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, n) => n !== index) })}><X size={17} /></button>
                </div>
              ))}
              <button type="button" className="text-button" disabled={form.ingredients.length >= 30} onClick={() => setForm({ ...form, ingredients: [...form.ingredients, { name: '', amount: 30, unit: 'ml', optional: false }] })}><Plus size={16} />添加原料</button>

              <h2 className="form-heading">怎么做</h2>
              {form.steps.map((step, index) => (
                <div className="step-editor" key={index}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <textarea aria-label={`步骤 ${index + 1}`} required maxLength={1000} rows={2} value={step} placeholder="写下这一步…" onChange={e => setForm({ ...form, steps: form.steps.map((s, n) => n === index ? e.target.value : s) })} />
                  <button type="button" className="icon-button" aria-label={`移除步骤 ${index + 1}`} disabled={form.steps.length <= 1} onClick={() => setForm({ ...form, steps: form.steps.filter((_, n) => n !== index) })}><X size={17} /></button>
                </div>
              ))}
              <button type="button" className="text-button" disabled={form.steps.length >= 30} onClick={() => setForm({ ...form, steps: [...form.steps, ''] })}><Plus size={16} />添加步骤</button>

              <h2 className="form-heading">风味刻度</h2>
              <p id="flavor-help" className="muted helper">0 表示没有这种感受，5 表示很明显；浓烈描述口感，不代表酒精度数。</p>
              <div className="flavor-inputs">
                {([['sweet', '甜'], ['sour', '酸'], ['bitter', '苦'], ['strong', '浓烈']] as const).map(([key, label]) => (
                  <label key={key} htmlFor={`flavor-${key}`}>{label}<output aria-hidden="true">{form.flavor[key]} / 5</output><input id={`flavor-${key}`} aria-label={label} aria-describedby="flavor-help" type="range" min="0" max="5" value={form.flavor[key]} onChange={e => setForm({ ...form, flavor: { ...form.flavor, [key]: Number(e.target.value) } })} /></label>
                ))}
              </div>
              <div className="form-actions">
                <button type="submit" className="button">{saving ? '正在保存…' : '保存到酒单'}</button>
                {id && <button className="text-button danger" type="button" onClick={() => void remove()}>删除这款酒</button>}
              </div>
            </fieldset>
          </form>

          <aside className="editor-side" aria-label="我的创作">
            <div className="my-creations">
              <h2>我的创作{custom.length > 0 && <small>{custom.length}</small>}</h2>
              {custom.length > 0 ? custom.map(r => (
                <Link key={r.id} to={`/custom?id=${encodeURIComponent(r.id)}`} className={r.id === id ? 'active' : ''} aria-current={r.id === id ? 'page' : undefined}>
                  {r.name}<span>{r.id === id ? '正在编辑' : '编辑 →'}</span>
                </Link>
              )) : <p className="muted side-empty">还没有自创配方。<br />写下第一杯，下次聊天时就能一起找到它。</p>}
              {id && <Link className="text-button side-new" to="/custom"><Plus size={15} />记一杯新酒</Link>}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
