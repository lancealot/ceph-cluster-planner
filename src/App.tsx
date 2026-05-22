import { useState } from 'react';
import { WorkspaceProvider } from './state/workspace';
import { useAllIssues } from './state/useAllIssues';
import { ComponentLibrary } from './components/ComponentLibrary';
import { ImportExport } from './components/ImportExport';
import { NodeBuilder } from './components/NodeBuilder';
import { RackBuilder } from './components/RackBuilder';
import { ClusterView } from './components/ClusterView';
import { ScenarioManager } from './components/ScenarioManager';
import { WarningsDrawer } from './components/Common/WarningsDrawer';
import { Disclaimers } from './components/Common/Disclaimers';

const tabs = ['components', 'nodes', 'racks', 'cluster', 'scenarios'] as const;
type Tab = (typeof tabs)[number];

const tabLabels: Record<Tab, string> = {
  components: 'Components',
  nodes: 'Nodes',
  racks: 'Racks',
  cluster: 'Cluster',
  scenarios: 'Scenarios',
};

function ShellWithDrawer({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const issues = useAllIssues();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold">Ceph Cluster Planner</h1>
          <p className="text-xs text-slate-500">Build configurations bottom-up, see all derived math.</p>
          <div className="mt-1">
            <Disclaimers />
          </div>
        </div>
        <ImportExport />
      </header>
      <nav className="border-b bg-white px-4">
        <ul className="flex gap-1">
          {tabs.map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm border-b-2 transition-colors ${
                  tab === t
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
                aria-current={tab === t ? 'page' : undefined}
              >
                {tabLabels[t]}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="flex-1 bg-slate-50">
        {tab === 'components' && <ComponentLibrary />}
        {tab === 'nodes' && <NodeBuilder />}
        {tab === 'racks' && <RackBuilder />}
        {tab === 'cluster' && <ClusterView />}
        {tab === 'scenarios' && <ScenarioManager />}
      </main>
      <WarningsDrawer issues={issues} />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>('components');
  return (
    <WorkspaceProvider>
      <ShellWithDrawer tab={tab} setTab={setTab} />
    </WorkspaceProvider>
  );
}
