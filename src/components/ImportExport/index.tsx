import { useRef } from 'react';
import { useWorkspace } from '../../state/workspace';
import type { Scenario, Workspace } from '../../types/scenario';

export function ImportExport() {
  const { workspace, dispatch } = useWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);

  function exportWorkspace() {
    const scenario: Scenario = {
      schema_version: '1',
      id: 'workspace-export',
      name: 'workspace-export',
      created_at: new Date().toISOString(),
      workspace,
    };
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
        if (parsed.workspace && typeof parsed.workspace === 'object') {
          ws = parsed.workspace as Workspace;
        } else if (Array.isArray(parsed.nodes)) {
          ws = parsed as Workspace;
        }
      }
      if (!ws) {
        alert('Invalid workspace JSON: missing `workspace` or `nodes` field.');
      } else {
        dispatch({ type: 'replace_workspace', workspace: ws });
      }
    } catch (err) {
      alert(`Failed to import: ${(err as Error).message}`);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={exportWorkspace}
        className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-sm"
      >
        Export JSON
      </button>
      <label className="px-3 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-sm cursor-pointer">
        Import JSON
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          onChange={importWorkspace}
          className="hidden"
        />
      </label>
    </div>
  );
}
