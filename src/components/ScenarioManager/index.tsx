import { useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useScenarios } from '../../state/useScenarios';
import { useLibrary } from '../../state/useLibrary';
import {
  ScenarioImportError,
  computeForWorkspace,
  diff,
  serialize,
} from '../../calc/scenario';
import { deserialize } from '../../calc/scenario';
import { buildSc846ReferenceScenario } from '../../scenarios/sc846-reference';
import { Panel } from '../Shell/primitives';
import type { Scenario } from '../../types/scenario';
import type { ScenarioDiff } from '../../calc/scenario';

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

function fmtCap(bytes: number): string {
  const tb = bytes / 1e12;
  if (tb >= 1000) return `${(tb / 1000).toFixed(2)} PB`;
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  return `${(tb * 1000).toFixed(0)} GB`;
}
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
function fmtPower(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}
function fmtSigned(n: number, fmt: (v: number) => string): { text: string; dir: number } {
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return { text: `${sign}${fmt(Math.abs(n))}`, dir: n > 0 ? 1 : n < 0 ? -1 : 0 };
}

function DiffTable({ result }: { result: ScenarioDiff }) {
  const rows = [
    { label: 'Cost', a: result.delta.cost_usd, fmt: fmtUsd, lowerBetter: true },
    { label: 'Power (typ)', a: result.delta.power_typical_w, fmt: fmtPower, lowerBetter: true },
    { label: 'Power (max)', a: result.delta.power_max_w, fmt: fmtPower, lowerBetter: true },
    { label: 'Raw capacity', a: result.delta.raw_capacity_bytes, fmt: fmtCap, lowerBetter: false },
    { label: 'Usable capacity', a: result.delta.usable_capacity_bytes, fmt: fmtCap, lowerBetter: false },
    { label: 'Rack count', a: result.delta.rack_count, fmt: (n: number) => `${n}`, lowerBetter: true },
    { label: 'Node count', a: result.delta.node_count, fmt: (n: number) => `${n}`, lowerBetter: true },
    { label: 'OSD count', a: result.delta.osd_count, fmt: (n: number) => `${n}`, lowerBetter: false },
  ];
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Metric</th>
          <th className="r">{result.base_name}</th>
          <th className="r">{result.compare_name}</th>
          <th className="r">Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const s = fmtSigned(r.a, r.fmt);
          const favorable = r.lowerBetter ? s.dir < 0 : s.dir > 0;
          const unfavorable = r.lowerBetter ? s.dir > 0 : s.dir < 0;
          const cls = s.dir === 0 ? 'delta-zero' : favorable ? 'delta-pos' : unfavorable ? 'delta-neg' : 'delta-zero';
          return (
            <tr key={r.label}>
              <td style={{ color: 'var(--text2)' }}>{r.label}</td>
              <td className="r price">—</td>
              <td className="r price">—</td>
              <td className={'r price ' + cls}>{s.text}</td>
            </tr>
          );
        })}
        <tr>
          <td style={{ color: 'var(--text2)' }}>Warnings</td>
          <td className="r price">—</td>
          <td className="r price">—</td>
          <td className="r price">
            {result.warnings_introduced.length > 0 ? (
              <span className="delta-neg">+{result.warnings_introduced.length} new</span>
            ) : null}
            {result.warnings_introduced.length > 0 && result.warnings_resolved.length > 0 ? ' · ' : ''}
            {result.warnings_resolved.length > 0 ? (
              <span className="delta-pos">−{result.warnings_resolved.length} resolved</span>
            ) : null}
            {result.warnings_introduced.length === 0 && result.warnings_resolved.length === 0 ? (
              <span className="delta-zero">no change</span>
            ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ScenarioManager() {
  const { workspace, dispatch } = useWorkspace();
  const { scenarios, add, remove, rename } = useScenarios();
  const library = useLibrary();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [baseId, setBaseId] = useState<string>('');
  const [compareId, setCompareId] = useState<string>('');
  const [flash, setFlash] = useState<string | null>(null);

  const currentComputed = useMemo(() => computeForWorkspace(workspace, library), [workspace, library]);

  function flashMsg(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

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
  function exportCurrent() {
    downloadScenario(serialize(workspace, workspace.cluster.name || 'workspace-export'));
  }
  async function importFromFile(file: File) {
    try {
      const text = await file.text();
      const scenario = deserialize(JSON.parse(text));
      add(scenario);
      flashMsg(`Imported "${scenario.name}".`);
    } catch (err) {
      if (err instanceof ScenarioImportError) {
        flashMsg(`Import failed: ${err.issues[0]?.message ?? err.message}`);
      } else {
        flashMsg(`Import failed: ${(err as Error).message}`);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  const base = scenarios.find((s) => s.id === baseId);
  const compare = scenarios.find((s) => s.id === compareId);
  const diffResult = base && compare && base.id !== compare.id ? diff(base, compare, library) : null;
  const workspaceId = JSON.stringify(workspace);

  return (
    <div className="screen">
      <div className="screen-inner stack">
        <div className="row">
          <input
            className="inp grow"
            placeholder={`Name (default: Scenario ${scenarios.length + 1})`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button className="btn prime" type="button" onClick={saveCurrent}>Save current as scenario</button>
          <button className="btn" type="button" onClick={loadBundled}>Load SC846 reference</button>
          <span className="grow" />
          <label className="btn sm" style={{ cursor: 'pointer' }}>
            Import JSON
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFromFile(f);
              }}
              style={{ display: 'none' }}
            />
          </label>
          <button className="btn sm" type="button" onClick={exportCurrent}>Export JSON</button>
        </div>
        {flash ? <span className="counts">{flash}</span> : null}

        <div>
          <span className="counts">
            Current workspace: {currentComputed.cluster.total_node_count} nodes ·{' '}
            {fmtCap(currentComputed.cluster.total_usable_bytes)} usable ·{' '}
            {fmtUsd(currentComputed.cluster.total_cost_usd)} ·{' '}
            {currentComputed.issues.filter((i) => i.severity === 'error').length} errors,{' '}
            {currentComputed.issues.filter((i) => i.severity === 'warning').length} warnings
          </span>
        </div>

        <div className="scen-grid">
          {scenarios.length === 0 ? (
            <Panel>
              <p style={{ color: 'var(--text3)', fontSize: 12.5 }}>
                No saved scenarios yet. Build a workspace and click <b>Save current</b>, or load the bundled SC846 reference.
              </p>
            </Panel>
          ) : (
            scenarios.map((s) => {
              const isCurrent = JSON.stringify(s.workspace) === workspaceId;
              const computed = computeForWorkspace(s.workspace, library);
              const warns = computed.issues.filter((i) => i.severity === 'warning').length;
              const usableTb = computed.cluster.total_usable_bytes / 1e12;
              const perTb = usableTb > 0 ? computed.cluster.total_cost_usd / usableTb : 0;
              return (
                <div className={'scencard' + (isCurrent ? ' current' : '')} key={s.id}>
                  <div>
                    <div className="row">
                      <input
                        className="inp"
                        value={s.name}
                        onChange={(e) => rename(s.id, e.target.value)}
                        style={{ flex: 1, fontWeight: 600, fontSize: 13, padding: '4px 8px' }}
                      />
                      {isCurrent ? <span className="tag">loaded</span> : null}
                    </div>
                    <span className="counts">
                      saved {s.created_at.slice(0, 10)} · {warns} warning{warns === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="scen-metrics">
                    <span className="m"><span className="microlabel">Usable</span><span className="v">{fmtCap(computed.cluster.total_usable_bytes)}</span></span>
                    <span className="m"><span className="microlabel">Cost</span><span className="v">{fmtUsd(computed.cluster.total_cost_usd)}</span></span>
                    <span className="m"><span className="microlabel">Power</span><span className="v">{fmtPower(computed.cluster.total_power_typical_w)}</span></span>
                    <span className="m"><span className="microlabel">$/TB usable</span><span className="v">{usableTb > 0 ? fmtUsd(perTb) : '—'}</span></span>
                  </div>
                  <div className="row">
                    <button className="btn sm" type="button" onClick={() => loadScenario(s.id)}>Load</button>
                    <button className="btn sm" type="button" onClick={() => { setBaseId(s.id); setCompareId(scenarios.find((x) => x.id !== s.id)?.id ?? ''); }}>Diff</button>
                    <button className="btn sm" type="button" onClick={() => downloadScenario(s)}>Export</button>
                    <span className="grow" />
                    <button className="btn sm danger" type="button" onClick={() => remove(s.id)}>Delete</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Panel
          title="Diff — A vs B"
          right={
            <div className="row">
              <select className="sel" style={{ width: 'auto', padding: '4px 8px', fontSize: 11.5 }} value={baseId} onChange={(e) => setBaseId(e.target.value)}>
                <option value="">— A —</option>
                {scenarios.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
              <span className="counts">vs</span>
              <select className="sel" style={{ width: 'auto', padding: '4px 8px', fontSize: 11.5 }} value={compareId} onChange={(e) => setCompareId(e.target.value)}>
                <option value="">— B —</option>
                {scenarios.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          }
          tight
        >
          {diffResult ? (
            <DiffTable result={diffResult} />
          ) : (
            <p style={{ padding: 14, color: 'var(--text3)', fontSize: 12.5 }}>Pick two different scenarios to see deltas.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
