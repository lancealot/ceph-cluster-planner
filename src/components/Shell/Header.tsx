import { useRef, useState } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useTheme } from '../../state/theme';
import {
  ScenarioImportError,
  deserialize,
  serialize,
} from '../../calc/scenario';
import { buildShareUrl } from '../../calc/shareLink';
import type { Workspace } from '../../types/scenario';
import { DisclaimersFooter } from './Disclaimers';

export function Header() {
  const { workspace, dispatch } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function exportWorkspace() {
    const scenario = serialize(workspace, workspace.cluster.name || 'workspace-export');
    const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ccp-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      let ws: Workspace | null = null;
      if (parsed && typeof parsed === 'object') {
        if (parsed.workspace) {
          const scenario = deserialize(parsed);
          ws = scenario.workspace;
        } else if (Array.isArray(parsed.nodes)) {
          ws = parsed as Workspace;
        }
      }
      if (ws) {
        dispatch({ type: 'replace_workspace', workspace: ws });
        flashMsg('Imported.');
      }
    } catch (err) {
      if (err instanceof ScenarioImportError) {
        flashMsg(`Import failed: ${err.issues[0]?.message ?? err.message}`);
      } else {
        flashMsg(`Import failed: ${(err as Error).message}`);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function copyShareLink() {
    const url = buildShareUrl(workspace, workspace.cluster.name || 'shared workspace');
    try {
      await navigator.clipboard.writeText(url);
      flashMsg(`Share link copied (${url.length.toLocaleString()} chars).`);
    } catch {
      flashMsg('Copy failed — see console.');
      console.log(url);
    }
  }

  function flashMsg(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

  return (
    <header className="hdr">
      <div className="hdr-brand">
        <div className="hdr-mark" aria-hidden>
          <span />
        </div>
        <div>
          <div className="hdr-title">Ceph Cluster Planner</div>
        </div>
        <span className="hdr-sub">
          bottom-up sizing &amp; costing · all math client-side · <DisclaimersFooter />
        </span>
      </div>
      <div className="hdr-actions">
        {flash ? <span className="counts" style={{ marginRight: 8 }}>{flash}</span> : null}
        <button className="btn sm" type="button" onClick={copyShareLink} title="Copy URL with workspace encoded">
          Share link
        </button>
        <label className="btn sm" style={{ cursor: 'pointer' }}>
          Import
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            onChange={importWorkspace}
            style={{ display: 'none' }}
          />
        </label>
        <button className="btn sm" type="button" onClick={exportWorkspace}>
          Export
        </button>
        <div className="seg" role="group" aria-label="Theme">
          <button
            type="button"
            className={theme === 'light' ? 'on' : ''}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            type="button"
            className={theme === 'dark' ? 'on' : ''}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
        </div>
      </div>
    </header>
  );
}
