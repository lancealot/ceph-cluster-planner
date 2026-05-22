import { useMemo, useState } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useLibrary } from '../../state/useLibrary';
import type { RackConfig } from '../../types/rack';
import { deriveRack, validateRack } from '../../calc/rack';
import { WarningsList } from '../Common/WarningsList';
import { format_bytes, format_power, format_usd } from '../../calc/units';

function newRack(): RackConfig {
  return {
    id: `rack-${Date.now().toString(36)}`,
    name: 'New rack',
    ru_capacity: 42,
    power_capacity_w: 10000,
    nodes: [],
  };
}

function Bar({ used, capacity, color }: { used: number; capacity: number; color: string }) {
  const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  const over = used > capacity;
  return (
    <div className="w-full h-3 bg-slate-200 rounded overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={used}>
      <div className={`h-full ${over ? 'bg-rose-500' : color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function RackBuilder() {
  const { workspace, upsertRack, deleteRack } = useWorkspace();
  const library = useLibrary();
  const defaults = workspace.cluster.defaults;

  const nodeMap = useMemo(() => new Map(workspace.nodes.map((n) => [n.id, n])), [workspace.nodes]);

  const [selectedId, setSelectedId] = useState<string | null>(workspace.racks[0]?.id ?? null);

  const selected = useMemo(
    () => workspace.racks.find((r) => r.id === selectedId) ?? null,
    [workspace.racks, selectedId]
  );

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

  return (
    <div className="p-4 grid grid-cols-[260px_1fr] gap-4 max-w-7xl mx-auto">
      <aside className="space-y-2">
        <button onClick={startNew} className="px-2 py-1 text-sm bg-slate-900 text-white rounded w-full">
          + New rack
        </button>
        <ul className="bg-white border rounded divide-y">
          {workspace.racks.length === 0 ? (
            <li className="p-3 text-sm text-slate-500">No rack configs yet.</li>
          ) : (
            workspace.racks.map((r) => (
              <li
                key={r.id}
                className={`p-2 cursor-pointer hover:bg-slate-50 ${selectedId === r.id ? 'bg-slate-100' : ''}`}
                onClick={() => setSelectedId(r.id)}
              >
                <div className="text-sm font-medium truncate">{r.name || '(unnamed)'}</div>
                <div className="text-xs text-slate-500">
                  {r.ru_capacity} RU · {(r.power_capacity_w / 1000).toFixed(1)} kW
                </div>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section>
        {!selected ? (
          <div className="text-sm text-slate-500 p-4">Select a rack or create one.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-slate-500">Name</label>
                <input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full bg-white"
                />
              </div>
              <div className="w-24">
                <label className="block text-xs uppercase tracking-wide text-slate-500">RU cap</label>
                <input
                  type="number"
                  min={1}
                  value={selected.ru_capacity}
                  onChange={(e) => update({ ru_capacity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="border rounded px-2 py-1 text-sm w-full bg-white"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs uppercase tracking-wide text-slate-500">Power (W)</label>
                <input
                  type="number"
                  min={0}
                  value={selected.power_capacity_w}
                  onChange={(e) =>
                    update({ power_capacity_w: Math.max(0, parseInt(e.target.value) || 0) })
                  }
                  className="border rounded px-2 py-1 text-sm w-full bg-white"
                />
              </div>
              <button
                onClick={() => {
                  deleteRack(selected.id);
                  setSelectedId(null);
                }}
                className="px-2 py-1 text-sm bg-rose-100 text-rose-800 rounded"
              >
                Delete
              </button>
            </div>

            <div className="bg-white border rounded p-3 space-y-3">
              <h4 className="text-sm font-semibold">Nodes in rack</h4>
              {selected.nodes.length === 0 ? (
                <p className="text-xs text-slate-500">No nodes yet. Add some from the dropdown below.</p>
              ) : (
                selected.nodes.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_4rem_2rem] gap-1 items-end">
                    <select
                      value={slot.node_config_id}
                      onChange={(e) =>
                        update({
                          nodes: selected.nodes.map((s, i) =>
                            i === idx ? { ...s, node_config_id: e.target.value } : s
                          ),
                        })
                      }
                      className="border rounded px-2 py-1 text-sm bg-white"
                    >
                      <option value="">— select node config —</option>
                      {workspace.nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={slot.count}
                      onChange={(e) =>
                        update({
                          nodes: selected.nodes.map((s, i) =>
                            i === idx ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s
                          ),
                        })
                      }
                      className="border rounded px-2 py-1 text-sm bg-white"
                    />
                    <button
                      onClick={() => update({ nodes: selected.nodes.filter((_, i) => i !== idx) })}
                      className="text-rose-700 text-sm"
                      aria-label="Remove node slot"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
              <button
                onClick={() =>
                  update({
                    nodes: [...selected.nodes, { node_config_id: workspace.nodes[0]?.id ?? '', count: 1 }],
                  })
                }
                className="text-sm text-sky-700 hover:underline"
                disabled={workspace.nodes.length === 0}
              >
                + Add node slot
              </button>
            </div>

            {derived ? (
              <div className="bg-white border rounded p-3 space-y-3">
                <h4 className="text-sm font-semibold">Derived</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>RU used</span>
                      <span>
                        {derived.ru_used} / {derived.ru_capacity}
                      </span>
                    </div>
                    <Bar used={derived.ru_used} capacity={derived.ru_capacity} color="bg-sky-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Power (max)</span>
                      <span>
                        {format_power(derived.power_max_w)} / {format_power(derived.power_capacity_w)}
                      </span>
                    </div>
                    <Bar used={derived.power_max_w} capacity={derived.power_capacity_w} color="bg-emerald-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Nodes:</span> {derived.node_count}
                  </div>
                  <div>
                    <span className="text-slate-500">OSDs:</span> {derived.total_osd_count}
                  </div>
                  <div>
                    <span className="text-slate-500">Raw capacity:</span> {format_bytes(derived.total_raw_bytes)}
                  </div>
                  <div>
                    <span className="text-slate-500">Cost:</span> {format_usd(derived.cost_usd)}
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-slate-500">Binding constraint: </span>
                  <span
                    className={`font-semibold ${
                      derived.binding_constraint === 'power'
                        ? 'text-emerald-700'
                        : derived.binding_constraint === 'ru'
                        ? 'text-sky-700'
                        : 'text-slate-600'
                    }`}
                  >
                    {derived.binding_constraint}
                  </span>{' '}
                  · room for {derived.available_headroom_units} more of the dominant node type
                </div>
              </div>
            ) : null}

            <div className="bg-white border rounded p-3">
              <h4 className="text-sm font-semibold mb-2">Validation</h4>
              <WarningsList issues={issues} empty="No issues — rack is clean." />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
