import { useMemo } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useLibrary } from '../../state/useLibrary';
import { useScenarios } from '../../state/useScenarios';
import { useAllIssues } from '../../state/useAllIssues';
import type { ValidationScope } from '../../types/scenario';

export type Tab = 'components' | 'nodes' | 'racks' | 'cluster' | 'scenarios';

interface Stage {
  id: Tab;
  num: string;
  label: string;
  cap: string;
  warns: number;
  filled: boolean;
}

const SCOPE_TO_TAB: Record<ValidationScope, Tab> = {
  node: 'nodes',
  rack: 'racks',
  cluster: 'cluster',
  pool: 'cluster',
};

export function Stepper({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { workspace } = useWorkspace();
  const library = useLibrary();
  const { scenarios } = useScenarios();
  const issues = useAllIssues();

  const stages = useMemo<Stage[]>(() => {
    const warnsByTab: Record<Tab, number> = { components: 0, nodes: 0, racks: 0, cluster: 0, scenarios: 0 };
    for (const i of issues) {
      if (i.severity === 'error' || i.severity === 'warning') {
        warnsByTab[SCOPE_TO_TAB[i.scope]] += 1;
      }
    }
    const totalParts = Object.keys(library).length;
    const customCount = workspace.custom_components.length;
    const nodeCount = workspace.nodes.length;
    const rackCount = workspace.racks.length;
    const rackInstances = workspace.cluster.racks.reduce((s, r) => s + r.count, 0);
    const pools = workspace.cluster.pools;
    const primaryPool = pools[0];
    const poolSummary = !primaryPool
      ? 'no pools'
      : primaryPool.type === 'ec'
      ? `${pools.length} pool${pools.length === 1 ? '' : 's'} · EC ${primaryPool.k ?? 8}+${primaryPool.m ?? 3}`
      : `${pools.length} pool${pools.length === 1 ? '' : 's'} · ×${primaryPool.replicas ?? 3} replica`;
    return [
      {
        id: 'components',
        num: '01',
        label: 'Components',
        cap: `${totalParts} parts${customCount > 0 ? ` · ${customCount} custom` : ''}`,
        warns: warnsByTab.components,
        filled: totalParts > 0,
      },
      {
        id: 'nodes',
        num: '02',
        label: 'Nodes',
        cap: nodeCount === 0 ? 'no configs' : `${nodeCount} config${nodeCount === 1 ? '' : 's'}`,
        warns: warnsByTab.nodes,
        filled: nodeCount > 0,
      },
      {
        id: 'racks',
        num: '03',
        label: 'Racks',
        cap:
          rackCount === 0
            ? 'no configs'
            : rackInstances > 0
            ? `${rackCount} config${rackCount === 1 ? '' : 's'} · ${rackInstances}× in cluster`
            : `${rackCount} config${rackCount === 1 ? '' : 's'}`,
        warns: warnsByTab.racks,
        filled: rackCount > 0,
      },
      {
        id: 'cluster',
        num: '04',
        label: 'Cluster',
        cap: poolSummary,
        warns: warnsByTab.cluster,
        filled: pools.length > 0,
      },
      {
        id: 'scenarios',
        num: '05',
        label: 'Scenarios',
        cap: scenarios.length === 0 ? 'no saved' : `${scenarios.length} saved`,
        warns: warnsByTab.scenarios,
        filled: scenarios.length > 0,
      },
    ];
  }, [workspace, library, scenarios, issues]);

  return (
    <nav className="stepper" aria-label="Build pipeline">
      {stages.map((s, i) => (
        <span key={s.id} className="contents">
          {i > 0 ? <span className="step-sep" aria-hidden>›</span> : null}
          <button
            type="button"
            className={'step' + (tab === s.id ? ' active' : '') + (s.filled ? ' filled' : '')}
            onClick={() => setTab(s.id)}
            aria-current={tab === s.id ? 'page' : undefined}
          >
            <span className="step-num">{s.num}</span>
            <span>
              <span className="step-label">
                {s.label}
                {s.warns > 0 ? <span className="step-warn">{s.warns}!</span> : null}
              </span>
              <span className="step-cap">{s.cap}</span>
            </span>
          </button>
        </span>
      ))}
    </nav>
  );
}
