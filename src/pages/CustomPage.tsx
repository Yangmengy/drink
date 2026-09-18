import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { api, errorText } from '../api/client';
import type { Ingredient, Recipe, RecipeInput } from '../types';

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
  const [form, setForm] = useState<RecipeInput>(empty);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [custom, setCustom] = useState<Recipe[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setForm(empty());
    Promise.all([api.ingredients(), api.menu()]).then(([items, recipes]) => {
      if (!active) return;
      setIngredients(items);
      setCustom(recipes.filter(r => r.source === 'custom'));
      if (id) {
        const r = recipes.find(r => r.id === id && r.source === 'custom');
        if (!r) throw new Error('找不到可编辑的自创配方');
        setForm({
          id: r.id, name: r.name, description: r.description, method: r.method,
          flavor: r.flavor ?? empty().flavor,
          ingredients: r.ingredients.map(i => ({ name: i.name, amount: i.amount ?? 1, unit: i.unit ?? '份', optional: i.optional })),
          steps: r.steps,
        });
      }
    }).catch(e => { if (active) setError(errorText(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try { await api.saveRecipe(form); navigate('/bar'); }
    catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!form.id || !window.confirm(`删除“${form.name}”？这款自创酒将从菜单中移除。`)) return;
    setSaving(true);
    try { await api.deleteRecipe(form.id); navigate('/bar'); }
    catch (e) { setError(errorText(e)); }
    finally { setSaving(false); }
  }

  return (
    <section>
      <header className="page-header">
        <span className="eyebrow">MAKE IT YOURS</span>
      </header>
      {error && <div className="error" role="alert">{error}</div>}
      {loading ? <p role="status" className="empty">正在准备配方本…</p> : (
        <div className="editor-layout">
          <form className="editor form" onSubmit={submit}>
            <fieldset disabled={saving}>
              <legend className="sr-only">自创配方</legend>
              <div className="form-row">
                <label>酒品名称<input required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="给这杯酒起个名字" /></label>
                <label>调制方法<select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}>{['摇和', '搅拌', '直调', '搅打', '其他', ...(form.method && !['摇和', '搅拌', '直调', '搅打', '其他'].includes(form.method) ? [form.method] : [])].map(m => <option key={m}>{m}</option>)}</select></label>
              </div>
              <label>风味与灵感<textarea rows={3} maxLength={2000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="什么味道，适合什么时刻…" /></label>

              <h2 className="form-heading">准备什么</h2>
              <datalist id="ingredient-names">{ingredients.map(i => <option value={i.name} key={i.id} />)}</datalist>
              {form.ingredients.map((ingredient, index) => (
                <div className="ingredient-editor" key={index}>
                  <label><span className="sr-only">原料 {index + 1}</span><input required list="ingredient-names" value={ingredient.name} maxLength={80} placeholder="原料名称" onChange={e => setForm({ ...form, ingredients: form.ingredients.map((i, n) => n === index ? { ...i, name: e.target.value } : i) })} /></label>
                  <label><span className="sr-only">用量 {index + 1}</span><input required type="number" min="0.01" max="10000" step="any" value={ingredient.amount} onChange={e => setForm({ ...form, ingredients: form.ingredients.map((i, n) => n === index ? { ...i, amount: e.target.valueAsNumber } : i) })} /></label>
                  <label><span className="sr-only">单位 {index + 1}</span><input required maxLength={16} value={ingredient.unit} onChange={e => setForm({ ...form, ingredients: form.ingredients.map((i, n) => n === index ? { ...i, unit: e.target.value } : i) })} /></label>
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
              <div className="flavor-inputs">
                {([['sweet', '甜'], ['sour', '酸'], ['bitter', '苦'], ['strong', '浓烈']] as const).map(([key, label]) => (
                  <label key={key}>{label}<output>{form.flavor[key]} / 5</output><input type="range" min="0" max="5" value={form.flavor[key]} onChange={e => setForm({ ...form, flavor: { ...form.flavor, [key]: Number(e.target.value) } })} /></label>
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
