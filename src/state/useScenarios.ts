import { useCallback, useEffect, useState } from 'react';
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

export function useScenarios() {
  const [scenarios, setScenarios] = useState<Scenario[]>(loadInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    } catch {
      /* localStorage unavailable; skip */
    }
  }, [scenarios]);

  const add = useCallback((s: Scenario) => {
    setScenarios((prev) => [...prev, s]);
  }, []);

  const remove = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const rename = useCallback((id: string, name: string) => {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
  }, []);

  return { scenarios, add, remove, rename };
}
