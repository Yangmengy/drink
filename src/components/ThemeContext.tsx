import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { applyTheme, resolveInitialTheme, themes } from '../theme';

interface ThemeState {
  theme: string;
  setTheme: (id: string) => void;
}

const Context = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(resolveInitialTheme);
  const setTheme = useCallback((id: string) => {
    if (!themes.some(t => t.id === id)) return;
    setThemeState(id);
    applyTheme(id);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useTheme(): ThemeState {
  const value = useContext(Context);
  if (!value) throw new Error('ThemeProvider missing');
  return value;
}
