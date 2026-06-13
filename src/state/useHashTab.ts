import { useEffect, useState } from 'react';
import type { Tab } from '../components/Shell/Stepper';

const TABS: Tab[] = ['components', 'nodes', 'racks', 'cluster', 'scenarios'];

function tabFromHash(): Tab | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash.replace(/^#/, '');
  // Skip share-link hashes (#s=...); they're handled by useShareLinkLoader.
  if (h.startsWith('s=') || h === '') return null;
  return (TABS as string[]).includes(h) ? (h as Tab) : null;
}

/** Mirror the active tab in the URL hash so refresh/share preserves position. */
export function useHashTab(initial: Tab = 'components'): [Tab, (t: Tab) => void] {
  const [tab, setTabState] = useState<Tab>(() => tabFromHash() ?? initial);

  useEffect(() => {
    function onHash() {
      const next = tabFromHash();
      if (next && next !== tab) setTabState(next);
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [tab]);

  function setTab(next: Tab) {
    setTabState(next);
    if (typeof window !== 'undefined' && !window.location.hash.startsWith('#s=')) {
      const target = `#${next}`;
      if (window.location.hash !== target) {
        history.replaceState(null, '', window.location.pathname + window.location.search + target);
      }
    }
  }

  return [tab, setTab];
}
