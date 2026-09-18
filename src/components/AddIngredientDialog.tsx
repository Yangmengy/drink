import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorText } from '../api/client';
import type { AddIngredientResult, NewIngredientInput } from '../types';
import { useBar } from './BarContext';
import '../styles/add-ingredient-dialog.css';

const categories = [
  ['spirits', '基酒'], ['liqueur', '利口酒'], ['juice', '果汁'],
  ['syrup', '糖浆'], ['herb', '香草与香料'], ['mixer', '饮料与辅料'],
  ['dairy', '乳制品'], ['fruit', '水果'], ['other', '其他'],
] as const;

interface AddIngredientDialogProps {
  initialName: string;
  onDismiss: () => void;
  onSaved: (result: AddIngredientResult) => void;
}

export function AddIngredientDialog({ initialName, onDismiss, onSaved }: AddIngredientDialogProps) {
  const { ingredients, refresh } = useBar();
  const [form, setForm] = useState<NewIngredientInput>({ name: initialName.slice(0, 80), category: 'other', owned: true });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const active = useRef(true);
  const operation = useRef(false);
  const existing = ingredients.find(item => item.name.trim().toLowerCase() === form.name.trim().toLowerCase());
  const category = existing?.category ?? form.category;
  const owned = existing?.owned || form.owned;

  useEffect(() => {
    active.current = true;
    const element = dialog.current;
    element?.showModal();
    return () => { active.current = false; element?.close(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (operation.current) return;
    const name = form.name.trim();
    if (!name || Array.from(name).length > 80) {
      setError('请填写 1–80 字的原料名称。');
      return;
    }
    operation.current = true;
    setSaving(true); setError('');
    try {
      const result = await api.addIngredient({ ...form, name, owned });
      await refresh();
      if (active.current) onSaved(result);
    } catch (reason) {
      if (active.current) setError(errorText(reason));
    } finally {
      operation.current = false;
      if (active.current) setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="add-ingredient-dialog"
      aria-labelledby="add-ingredient-title"
      aria-describedby="add-ingredient-description"
      aria-busy={saving}
      onCancel={event => { event.preventDefault(); if (!operation.current) onDismiss(); }}
    >
      <h2 id="add-ingredient-title">添加原料</h2>
      <p id="add-ingredient-description" className="muted">记下手边的材料，挑酒和自创配方时都能用到。</p>
      <form className="form ingredient-form" onSubmit={submit}>
        <fieldset disabled={saving}>
          <legend className="sr-only">新原料</legend>
          <label>原料名称
            <input autoFocus required maxLength={80} value={form.name} placeholder="例如：桂花糖浆"
              onChange={event => { setForm({ ...form, name: event.target.value }); setError(''); }} />
          </label>
          <label>原料分类
            <select value={category} disabled={!!existing} onChange={event => setForm({ ...form, category: event.target.value })}>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              {!categories.some(([value]) => value === category) && <option value={category}>原有分类</option>}
            </select>
          </label>
          <label className="check-label ingredient-owned">
            <input type="checkbox" checked={owned} disabled={!!existing?.owned} onChange={event => setForm({ ...form, owned: event.target.checked })} />
            我已有这项原料
          </label>
          {existing && <p className="ingredient-existing muted" role="status">酒柜中已有同名原料，将直接使用它。</p>}
          {error && <p className="ingredient-save-error" role="alert">{error}</p>}
          <div className="ingredient-dialog-actions">
            <button className="button secondary" type="button" onClick={onDismiss}>取消</button>
            <button className="button" type="submit">{saving ? '正在保存…' : '保存原料'}</button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}
