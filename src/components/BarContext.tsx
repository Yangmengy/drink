import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, errorText } from '../api/client';
import type { Ingredient, Recipe, RecipeInput } from '../types';

type BarView = { tab: 'ingredients' | 'menu'; query: string; onlyOwned: boolean; filter: 'all' | 'ready' | 'near' | 'custom' };
interface BarState {
  ingredients: Ingredient[]; recipes: Recipe[]; loading: boolean; error: string;
  refresh: () => Promise<void>;
  view: BarView; setView: (view: BarView) => void;
  drafts: Record<string, RecipeInput>;
  saveDraft: (key: string, form: RecipeInput) => void;
  discardDraft: (key: string, saved?: RecipeInput) => void;
}
const Context = createContext<BarState | null>(null);

// Route changes keep drafts in memory. SQLite is authoritative for saved data.
export function BarProvider({ children }: { children: ReactNode }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<BarView>({ tab: 'ingredients', query: '', onlyOwned: false, filter: 'all' });
  const [drafts, setDrafts] = useState<Record<string, RecipeInput>>({});
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    try {
      const [items, menu] = await Promise.all([api.ingredients(), api.menu()]);
      if (request !== version.current) return;
      // Ownership changes must not move a row away from the pointer.
      setIngredients(items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')));
      setRecipes(menu); setError('');
    } catch (e) { if (request === version.current) setError(errorText(e)); }
    finally { if (request === version.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); return () => { version.current++; }; }, [refresh]);
  const saveDraft = useCallback((key: string, form: RecipeInput) => setDrafts(current => ({ ...current, [key]: form })), []);
  const discardDraft = useCallback((key: string, saved?: RecipeInput) => setDrafts(current => {
    if (saved && current[key] !== saved) return current;
    const next = { ...current }; delete next[key]; return next;
  }), []);
  return <Context.Provider value={{ ingredients, recipes, loading, error, refresh, view, setView, drafts, saveDraft, discardDraft }}>{children}</Context.Provider>;
}
export function useBar() { const value = useContext(Context); if (!value) throw new Error('BarProvider missing'); return value; }
