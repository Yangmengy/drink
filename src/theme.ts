import { Sunrise, Sun, Sunset, MoonStar, type LucideIcon } from 'lucide-react';

export interface Theme {
  id: string;
  name: string;
  hint: string;
  icon: LucideIcon;
}

export const themes: Theme[] = [
  { id: 'morning', name: '清晨', hint: '薄雾与绿叶', icon: Sunrise },
  { id: 'afternoon', name: '午后', hint: '暖纸与陶土', icon: Sun },
  { id: 'dusk', name: '薄暮', hint: '安静的灰粉', icon: Sunset },
  { id: 'night', name: '夜话', hint: '灯下低语', icon: MoonStar },
];

const STORAGE_KEY = 'bartender-theme';

export function resolveInitialTheme(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && themes.some(t => t.id === saved)) return saved;
  } catch { /* localStorage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'night' : 'morning';
}

// Called once at module scope in main.tsx, before first paint.
// (Tauri CSP is script-src 'self', so an inline <script> in index.html is not an option.)
export function applyInitialTheme(): void {
  document.documentElement.dataset.theme = resolveInitialTheme();
}

export function applyTheme(id: string): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* localStorage unavailable */ }
}
