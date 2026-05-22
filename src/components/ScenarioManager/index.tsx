import { useState } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useScenarios } from '../../state/useScenarios';
import { useLibrary } from '../../state/useLibrary';
import {
  ScenarioImportError,
  computeForWorkspace,
  diff,
  serialize,
  type ScenarioDiff,
} from '../../calc/scenario';
import { deserialize } from '../../calc/scenario';
import { buildSc846ReferenceScenario } from '../../scenarios/sc846-reference';
import { format_bytes, format_power, format_usd } from '../../calc/units';
import { WarningsList } from '../Common/WarningsList';
import type { Scenario } from '../../types/scenario';

function downloadScenario(s: Scenario) {
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${s.name.replace(/[^a-z0-9]+/gi, '-')}-${s.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function DeltaRow({ label, value, format }: { label: string; value: number; format: (n: number) => string }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const cls = value > 0 ? 'text-emerald-700' : value < 0 ? 'text-rose-700' : 'text-slate-600';
  return (
    <tr className="border-t">
      <td className="px-2 py-1 text-slate-600">{label}</td>
      <td className={`px-2 py-1 text-right font-mono ${cls}`}>
        {sign}{format(Math.abs(value))}
      </td>
    </tr>
  );
}

function DiffPanel({ result }: { result: ScenarioDiff }) {
  return (
    <div className="bg-white border rounded p-3 space-y-3">
      <h4 className="text-sm font-semibold">
        Diff: <span className="text-slate-500">{result.base_name}</span> →{' '}
        <span className="text-slate-900">{result.compare_name}</span>
      </h4>
      <table className="w-full text-sm">
        <tbody>
          <DeltaRow label="Cost" value={result.delta.cost_usd} format={format_usd} />
          <DeltaRow label="Power (typical)" value={result.delta.power_typical_w} format={format_power} />
          <DeltaRow label="Power (max)" value={result.delta.power_max_w} format={format_power} />
          <DeltaRow label="Raw capacity" value={result.delta.raw_capacity_bytes} format={format_bytes} />
          <DeltaRow label="Usable capacity" value={result.delta.usable_capacity_bytes} format={format_bytes} />
          <DeltaRow label="Rack count" value={result.delta.rack_count} format={(n) => `${n}`} />
          <DeltaRow label="Node count" value={result.delta.node_count} format={(n) => `${n}`} />
          <DeltaRow label="OSD count" value={result.delta.osd_count} format={(n) => `${n}`} />
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <h5 className="text-xs uppercase tracking-wide text-slate-500 mb-1">Warnings introduced</h5>
          <WarningsList issues={result.warnings_introduced} empty="None new." />
        </div>
        <div>
          <h5 className="text-xs uppercase tracking-wide text-slate-500 mb-1">Warnings resolved</h5>
          <WarningsList issues={result.warnings_resolved} empty="None resolved." />
        </div>
      </div>
    </div>
  );
}

export function ScenarioManager() {
  const { workspace, dispatch } = useWorkspace();
  const { scenarios, add, remove, rename } = useScenarios();
  const library = useLibrary();

  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState<string>('');
  const [compareId, setCompareId] = useState<string>('');
  const [importMessage, setImportMessage] = useState<string | null>(null);

  function saveCurrent() {
    const scenarioName = name.trim() || `Scenario ${scenarios.length + 1}`;
    add(serialize(workspace, scenarioName));
    setName('');
  }

  function loadScenario(id: string) {
    const s = scenarios.find((x) => x.id === id);
    if (!s) return;
    dispatch({ type: 'replace_workspace', workspace: s.workspace });
  }

  function loadBundled() {
    const s = buildSc846ReferenceScenario();
    add(s);
    dispatch({ type: 'replace_workspace', workspace: s.workspace });
  }

  async function importFromFile(file: File) {
    setImportMessage(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const scenario = deserialize(json);
      add(scenario);
      setImportMessage(`Imported "${scenario.name}".`);
    } catch (err) {
      if (err instanceof ScenarioImportError) {
        const detail = err.issues
          .slice(0, 3)
          .map((i) => `• ${i.path || '(root)'}: ${i.message}`)
          .join('\n');
        setImportMessage(`Import failed:\n${detail}`);
      } else {
        setImportMessage(`Import failed: ${(err as Error).message}`);
      }
    }
  }

  const base = scenarios.find((s) => s.id === baseId);
  const compare = scenarios.find((s) => s.id === compareId);
  const diffResult = base && compare && base.id !== compare.id ? diff(base, compare, library) : null;

  const currentComputed = computeForWorkspace(workspace, library);

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="bg-white border rounded p-3 space-y-3">
        <h4 className="text-sm font-semibold">Save current workspace</h4>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Scenario ${scenarios.length + 1}`}
            className="border rounded px-2 py-1 text-sm flex-1 bg-white"
          />
          <button onClick={saveCurrent} className="px-3 py-1 text-sm bg-slate-900 text-white rounded">
            Save snapshot
          </button>
          <button onClick={loadBundled} className="px-3 py-1 text-sm bg-slate-200 rounded">
            Load SC846 reference
          </button>
          <label className="px-3 py-1 text-sm bg-slate-200 rounded cursor-pointer">
            Import .json
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFromFile(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {importMessage ? (
          <pre className="text-xs text-rose-700 whitespace-pre-wrap">{importMessage}</pre>
        ) : null}
        <p className="text-xs text-slate-500">
          Current workspace: {currentComputed.cluster.total_node_count} nodes ·{' '}
          {format_bytes(currentComputed.cluster.total_usable_bytes)} usable ·{' '}
          {format_usd(currentComputed.cluster.total_cost_usd)} ·{' '}
          {currentComputed.issues.filter((i) => i.severity === 'error').length} errors,{' '}
          {currentComputed.issues.filter((i) => i.severity === 'warning').length} warnings
        </p>
      </div>

      <div className="bg-white border rounded p-3 space-y-2">
        <h4 className="text-sm font-semibold">Saved scenarios ({scenarios.length})</h4>
        {scenarios.length === 0 ? (
          <p className="text-sm text-slate-500">No saved scenarios yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-left">
              <tr>
                <th className="px-2 py-1">Name</th>
                <th className="px-2 py-1">Saved</th>
                <th className="px-2 py-1 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-2 py-1">
                    <input
                      value={s.name}
                      onChange={(e) => rename(s.id, e.target.value)}
                      className="border-0 bg-transparent text-sm w-full focus:bg-white focus:border focus:px-1"
                    />
                  </td>
                  <td className="px-2 py-1 text-slate-500 font-mono text-xs">{s.created_at.slice(0, 19)}</td>
                  <td className="px-2 py-1 text-right space-x-1">
                    <button onClick={() => loadScenario(s.id)} className="text-xs px-2 py-1 bg-slate-200 rounded">
                      Load
                    </button>
                    <button onClick={() => downloadScenario(s)} className="text-xs px-2 py-1 bg-slate-200 rounded">
                      Export
                    </button>
                    <button onClick={() => remove(s.id)} className="text-xs px-2 py-1 bg-rose-100 text-rose-800 rounded">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white border rounded p-3 space-y-3">
        <h4 className="text-sm font-semibold">Compare two scenarios</h4>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="text-xs text-slate-500">Base</div>
            <select
              value={baseId}
              onChange={(e) => setBaseId(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full bg-white"
            >
              <option value="">— select —</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <div className="text-xs text-slate-500">Compare</div>
            <select
              value={compareId}
              onChange={(e) => setCompareId(e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full bg-white"
            >
              <option value="">— select —</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {diffResult ? <DiffPanel result={diffResult} /> : (
          <p className="text-xs text-slate-500">Pick two different scenarios to see deltas.</p>
        )}
      </div>
    </div>
  );
}
