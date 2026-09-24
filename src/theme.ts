import { Trees, Snowflake, Home, type LucideIcon } from 'lucide-react';

export interface Theme {
  id: string;
  name: string;
  hint: string;
  icon: LucideIcon;
}

export const themes: Theme[] = [
  { id: 'rain', name: '林间', hint: '树屋与夜色', icon: Trees },
  { id: 'snow', name: '雪夜', hint: '月下小屋', icon: Snowflake },
  { id: 'cottage', name: '乡居', hint: '暖阳与野花', icon: Home },
];

const STORAGE_KEY = 'bartender-theme';

export function resolveInitialTheme(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && themes.some(t => t.id === saved)) return saved;
  } catch { /* localStorage unavailable */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'snow' : 'rain';
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
