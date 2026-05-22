import { useEffect, useRef } from 'react';
import { useWorkspace } from './workspace';
import { decodeScenarioFromHash } from '../calc/shareLink';

export function useShareLinkLoader() {
  const { dispatch } = useWorkspace();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (typeof window === 'undefined') return;
    const scenario = decodeScenarioFromHash(window.location.hash);
    if (!scenario) return;
    const ok = window.confirm(
      `Load shared scenario "${scenario.name}"? This will replace your current workspace (you can save the current one first via the Scenarios tab).`
    );
    if (ok) {
      dispatch({ type: 'replace_workspace', workspace: scenario.workspace });
    }
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }, [dispatch]);
}
