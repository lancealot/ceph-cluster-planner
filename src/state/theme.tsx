import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ccp.v1.theme';

function loadInitial(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface Ctx {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<Ctx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(loadInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* skip */
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'), setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Ctx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
