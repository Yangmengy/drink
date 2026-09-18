import { useEffect, useRef, useState } from 'react';
import { Check, Martini, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Recipe } from '../types';

const images = import.meta.glob('/src-tauri/assets/images/cocktails/*', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  const image = recipe.image ? images[`/src-tauri/assets/images/cocktails/${recipe.image.split('/').pop()}`] : undefined;
  return <>
    <button className="recipe-card" onClick={() => setOpen(true)}>
      <div className="recipe-cover">{image ? <img src={image} alt="" loading="lazy" /> : <Martini size={30} strokeWidth={1.3} />}</div>
      <div className="recipe-card-body">
        <span className="eyebrow">{recipe.source === 'custom' ? '我的创作' : recipe.category}</span>
        <h3>{recipe.name}</h3><p>{recipe.description || recipe.nameEn || '打开看看这杯酒的做法'}</p>
        <span className={`availability ${recipe.canMake ? 'ready' : ''}`}>{recipe.canMake ? <><Check size={14} /> 材料齐了</> : recipe.missing.length ? `缺 ${recipe.missing.length} 种：${recipe.missing.join('、')}` : '配方待完善'}</span>
      </div>
    </button>
    <dialog ref={dialog} className="recipe-dialog" onClose={() => setOpen(false)} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }} aria-label={`${recipe.name}配方`}>
      <div className="dialog-content">
        <button className="icon-button close" onClick={() => setOpen(false)} aria-label="关闭配方"><X size={22} /></button>
        <span className="eyebrow">{recipe.source === 'custom' ? '我的创作' : '菜单配方'}</span><h2>{recipe.name}</h2>
        <p className="muted">{recipe.description}</p>
        <p className="availability">{recipe.canMake ? '所需材料种类齐全，请确认剩余用量。' : `还缺：${recipe.missing.join('、') || '配方原料信息'}`}</p>
        <h3>准备材料</h3><ul className="ingredient-details">{recipe.ingredients.map(i => <li key={i.id}><span>{i.name}{i.optional && <small> · 可选</small>}</span><span>{i.amount ?? '适量'} {i.unit}</span></li>)}</ul>
        <h3>{recipe.method || '制作步骤'}</h3><ol className="steps">{recipe.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
        {recipe.source === 'custom' && <Link className="button secondary" to={`/custom?id=${encodeURIComponent(recipe.id)}`} onClick={() => setOpen(false)}>编辑这款酒</Link>}
      </div>
    </dialog>
  </>;
}
