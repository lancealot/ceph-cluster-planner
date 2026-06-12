import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Scenario } from '../types/scenario';

const STORAGE_KEY = 'ccp.v1.scenarios';

function loadInitial(): Scenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Scenario[]) : [];
  } catch {
    return [];
  }
}

interface Ctx {
  scenarios: Scenario[];
  add: (s: Scenario) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
}

const ScenariosContext = createContext<Ctx | null>(null);

export function ScenariosProvider({ children }: { children: ReactNode }) {
  const [scenarios, setScenarios] = useState<Scenario[]>(loadInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      /* localStorage unavailable; skip */
    }
  }, [scenarios]);

  const add = useCallback((s: Scenario) => setScenarios((prev) => [...prev, s]), []);
  const remove = useCallback((id: string) => setScenarios((prev) => prev.filter((s) => s.id !== id)), []);
  const rename = useCallback(
    (id: string, name: string) =>
      setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s))),
    []
  );

  return (
    <ScenariosContext.Provider value={{ scenarios, add, remove, rename }}>
      {children}
    </ScenariosContext.Provider>
  );
}

export function useScenarios(): Ctx {
  const ctx = useContext(ScenariosContext);
  if (!ctx) throw new Error('useScenarios must be used within ScenariosProvider');
  return ctx;
}
