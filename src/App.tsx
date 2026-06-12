import { useState } from 'react';
import { WorkspaceProvider } from './state/workspace';
import { ThemeProvider } from './state/theme';
import { useShareLinkLoader } from './state/useShareLink';
import { ComponentLibrary } from './components/ComponentLibrary';
import { NodeBuilder } from './components/NodeBuilder';
import { RackBuilder } from './components/RackBuilder';
import { ClusterView } from './components/ClusterView';
import { ScenarioManager } from './components/ScenarioManager';
import { Header } from './components/Shell/Header';
import { Stepper, type Tab } from './components/Shell/Stepper';
import { SummaryRail, SummaryStrip } from './components/Shell/SummaryRail';
import { IssuesDrawer } from './components/Shell/IssuesDrawer';

function Shell() {
  useShareLinkLoader();
  const [tab, setTab] = useState<Tab>('components');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);
  return (
    <div className="app">
      <Header />
      <Stepper tab={tab} setTab={setTab} />
      <SummaryStrip openDrawer={openDrawer} />
      <div className="workarea">
        <main style={{ overflowY: 'auto', minHeight: 0 }}>
          {tab === 'components' && <ComponentLibrary />}
          {tab === 'nodes' && <NodeBuilder />}
          {tab === 'racks' && <RackBuilder />}
          {tab === 'cluster' && <ClusterView />}
          {tab === 'scenarios' && <ScenarioManager />}
        </main>
        <SummaryRail tab={tab} openDrawer={openDrawer} />
      </div>
      <IssuesDrawer open={drawerOpen} onClose={closeDrawer} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <Shell />
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
