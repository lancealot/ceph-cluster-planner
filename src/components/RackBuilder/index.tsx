import { useMemo, useState } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useLibrary } from '../../state/useLibrary';
import type { RackConfig } from '../../types/rack';
import { deriveRack, validateRack } from '../../calc/rack';
import { Panel } from '../Shell/primitives';
import { RackElevation } from './RackElevation';
import { WarningsList } from '../Common/WarningsList';

function newRack(): RackConfig {
  return {
    id: `rack-${Date.now().toString(36)}`,
    name: 'New rack',
    ru_capacity: 42,
    power_capacity_w: 10000,
    nodes: [],
  };
}

function fmtCap(bytes: number): string {
  const tb = bytes / 1e12;
  if (tb >= 1000) return `${(tb / 1000).toFixed(2)} PB`;
  return `${tb.toFixed(2)} TB`;
}
function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}
function fmtKw(w: number): string {
  return `${(w / 1000).toFixed(2)} kW`;
}

function Meter({ used, capacity, label }: { used: number; capacity: number; label: string }) {
  const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  const hot = pct >= 90;
  return (
    <div className="wf-row">
      <span className="lbl mono" style={{ fontSize: '10.5px', color: 'var(--text3)' }}>{label}</span>
      <span />
      <span className={'meter' + (hot ? ' warnlvl' : '')} style={{ gridColumn: '1 / -1' }}>
        <div style={{ width: pct + '%' }} />
      </span>
    </div>
  );
}

export function RackBuilder() {
  const { workspace, upsertRack, deleteRack, updateCluster } = useWorkspace();
  const library = useLibrary();
  const defaults = workspace.cluster.defaults;
  const nodeMap = useMemo(() => new Map(workspace.nodes.map((n) => [n.id, n])), [workspace.nodes]);

  const [selectedId, setSelectedId] = useState<string | null>(workspace.racks[0]?.id ?? null);
  const selected = useMemo(() => workspace.racks.find((r) => r.id === selectedId) ?? null, [workspace.racks, selectedId]);
  const derived = selected ? deriveRack(selected, nodeMap, library, defaults) : null;
  const issues = selected && derived ? validateRack(selected, derived) : [];

  function startNew() {
    const r = newRack();
    upsertRack(r);
    setSelectedId(r.id);
  }
  function update(patch: Partial<RackConfig>) {
    if (!selected) return;
    upsertRack({ ...selected, ...patch });
  }

  function rackInstancesIn(id: string): number {
    return workspace.cluster.racks.find((r) => r.rack_config_id === id)?.count ?? 0;
  }

  return (
    <div className="screen">
      <div className="screen-inner" style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 18, alignItems: 'start' }}>
        <div className="stack-sm">
          <button className="btn prime sm" type="button" onClick={startNew}>+ New rack config</button>
          <div className="panel itemlist">
            {workspace.racks.length === 0 ? (
              <button type="button" style={{ cursor: 'default' }}>
                <div className="t" style={{ color: 'var(--text3)', fontWeight: 400 }}>No rack configs yet</div>
                <div className="s">Click + New to start</div>
              </button>
            ) : (
              workspace.racks.map((r) => {
                const d = deriveRack(r, nodeMap, library, defaults);
                return (
                  <button key={r.id} type="button" className={selectedId === r.id ? 'on' : ''} onClick={() => setSelectedId(r.id)}>
                    <div className="t">{r.name || '(unnamed)'}</div>
                    <div className="s">
                      {d.ru_used}/{r.ru_capacity}U · {fmtKw(d.power_typical_w)} typ · ×{rackInstancesIn(r.id)} in cluster
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {!selected || !derived ? (
          <Panel>
            <p style={{ color: 'var(--text3)', fontSize: 12.5 }}>Select a rack or create one.</p>
          </Panel>
        ) : (
          <div className="stack">
            <div className="row">
              <div className="field grow">
                <span className="microlabel">Rack name</span>
                <input className="inp" value={selected.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="field" style={{ width: 110 }}>
                <span className="microlabel">RU capacity</span>
                <input className="inp mono" type="number" min={1} value={selected.ru_capacity} onChange={(e) => update({ ru_capacity: Math.max(1, parseInt(e.target.value) || 1) })} />
              </div>
              <div className="field" style={{ width: 110 }}>
                <span className="microlabel">Power cap kW</span>
                <input className="inp mono" type="number" min={0} step={0.1} value={(selected.power_capacity_w / 1000).toFixed(1)} onChange={(e) => update({ power_capacity_w: Math.max(0, (parseFloat(e.target.value) || 0) * 1000) })} />
              </div>
              <button
                className="btn danger"
                type="button"
                style={{ alignSelf: 'flex-end' }}
                onClick={() => {
                  deleteRack(selected.id);
                  setSelectedId(null);
                  updateCluster({
                    ...workspace.cluster,
                    racks: workspace.cluster.racks.filter((r) => r.rack_config_id !== selected.id),
                  });
                }}
              >
                Delete
              </button>
            </div>

            {derived.binding_constraint !== 'none' && derived.available_headroom_units !== Infinity ? (
              <div className="bindbadge">
                <span className="dot warn" />
                {derived.binding_constraint === 'ru'
                  ? `RU binds first — ${derived.ru_capacity - derived.ru_used}U free; ${derived.available_headroom_units} more node${derived.available_headroom_units === 1 ? '' : 's'} fit.`
                  : `Power binds first — ${fmtKw(derived.power_capacity_w - derived.power_max_w)} headroom; ${derived.available_headroom_units} more node${derived.available_headroom_units === 1 ? '' : 's'} fit.`}
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
              <div className="stack-sm">
                <span className="microlabel">Elevation — {selected.ru_capacity}U</span>
                <RackElevation rack={selected} nodeMap={nodeMap} library={library} />
              </div>

              <div className="stack">
                <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="stat"><span className="microlabel">RU used</span><div className="v">{derived.ru_used} <small>/ {selected.ru_capacity}</small></div></div>
                  <div className="stat"><span className="microlabel">Power typ</span><div className="v">{fmtKw(derived.power_typical_w)}</div></div>
                  <div className="stat"><span className="microlabel">Power max</span><div className="v">{fmtKw(derived.power_max_w)}</div></div>
                  <div className="stat"><span className="microlabel">Raw capacity</span><div className="v">{fmtCap(derived.total_raw_bytes)}</div></div>
                  <div className="stat"><span className="microlabel">OSDs</span><div className="v">{derived.total_osd_count}</div></div>
                  <div className="stat"><span className="microlabel">Rack cost</span><div className="v">{fmtUsd(derived.cost_usd)}</div></div>
                </div>

                <Panel title="Utilization">
                  <div className="stack-sm">
                    <Meter
                      used={derived.ru_used}
                      capacity={selected.ru_capacity}
                      label={`RU — ${derived.ru_used} / ${selected.ru_capacity} (${selected.ru_capacity > 0 ? Math.round((derived.ru_used / selected.ru_capacity) * 100) : 0}%)`}
                    />
                    <Meter
                      used={derived.power_typical_w}
                      capacity={selected.power_capacity_w}
                      label={`Power typical — ${fmtKw(derived.power_typical_w)} / ${fmtKw(selected.power_capacity_w)} (${selected.power_capacity_w > 0 ? Math.round((derived.power_typical_w / selected.power_capacity_w) * 100) : 0}%)`}
                    />
                    <Meter
                      used={derived.power_max_w}
                      capacity={selected.power_capacity_w}
                      label={`Power max — ${fmtKw(derived.power_max_w)} / ${fmtKw(selected.power_capacity_w)} (${selected.power_capacity_w > 0 ? Math.round((derived.power_max_w / selected.power_capacity_w) * 100) : 0}%)`}
                    />
                  </div>
                </Panel>

                <Panel
                  title="Nodes in rack"
                  right={
                    <button
                      className="btn link sm"
                      type="button"
                      disabled={workspace.nodes.length === 0}
                      onClick={() => update({ nodes: [...selected.nodes, { node_config_id: workspace.nodes[0]?.id ?? '', count: 1 }] })}
                    >
                      + Add node config
                    </button>
                  }
                >
                  <div className="stack-sm">
                    {selected.nodes.length === 0 ? (
                      <span className="counts">No node configs in this rack.</span>
                    ) : null}
                    {selected.nodes.map((slot, idx) => (
                      <div className="slotrow card" key={idx}>
                        <select
                          className="sel"
                          value={slot.node_config_id}
                          onChange={(e) => update({ nodes: selected.nodes.map((s, i) => (i === idx ? { ...s, node_config_id: e.target.value } : s)) })}
                        >
                          <option value="">— select node config —</option>
                          {workspace.nodes.map((n) => (<option key={n.id} value={n.id}>{n.name}</option>))}
                        </select>
                        <input
                          className="inp mono"
                          type="number"
                          min={0}
                          value={slot.count}
                          onChange={(e) => update({ nodes: selected.nodes.map((s, i) => (i === idx ? { ...s, count: Math.max(0, parseInt(e.target.value) || 0) } : s)) })}
                        />
                        <button className="xbtn" type="button" aria-label="Remove node config" onClick={() => update({ nodes: selected.nodes.filter((_, i) => i !== idx) })}>✕</button>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Rack validation">
                  <WarningsList issues={issues} empty="Rack is clean — no validation issues." />
                </Panel>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
