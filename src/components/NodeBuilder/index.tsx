import { useMemo, useState } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useLibrary } from '../../state/useLibrary';
import type { DriveRole, NodeConfig } from '../../types/node';
import { deriveNode } from '../../calc/node';
import { validateNode } from '../../calc/validation';
import { NodeDerivedPanel } from '../Common/DerivedPanel';
import { WarningsList } from '../Common/WarningsList';
import { ComponentPicker } from '../Common/ComponentPicker';
import { SC846_HDD_ONLY, SC846_WITH_METADATA } from '../../calc/fixtures/sc846';

const DRIVE_ROLES: DriveRole[] = ['osd', 'db_wal', 'metadata_osd', 'cache', 'system'];

function newNode(): NodeConfig {
  return {
    id: `node-${Date.now().toString(36)}`,
    name: 'New node',
    chassis_id: '',
    cpu_id: '',
    cpu_count: 1,
    ram_module_id: '',
    ram_module_count: 0,
    drives: [],
    hbas: [],
    nics: [],
    psu_id: '',
    psu_count: 2,
  };
}

export function NodeBuilder() {
  const { workspace, upsertNode, deleteNode } = useWorkspace();
  const library = useLibrary();
  const defaults = workspace.cluster.defaults;

  const [selectedId, setSelectedId] = useState<string | null>(
    workspace.nodes[0]?.id ?? null
  );

  const selected = useMemo(
    () => workspace.nodes.find((n) => n.id === selectedId) ?? null,
    [workspace.nodes, selectedId]
  );

  const derived = selected ? deriveNode(selected, library, defaults) : null;
  const issues = selected ? validateNode(selected, library, defaults) : [];

  function startNew() {
    const n = newNode();
    upsertNode(n);
    setSelectedId(n.id);
  }

  function loadFixture(variant: 'hdd' | 'meta') {
    const fixture = variant === 'hdd' ? SC846_HDD_ONLY : SC846_WITH_METADATA;
    const copy: NodeConfig = { ...fixture, id: `${fixture.id}-${Date.now().toString(36)}`, drives: [...fixture.drives] };
    upsertNode(copy);
    setSelectedId(copy.id);
  }

  function update(patch: Partial<NodeConfig>) {
    if (!selected) return;
    upsertNode({ ...selected, ...patch });
  }

  return (
    <div className="p-4 grid grid-cols-[260px_1fr] gap-4 max-w-7xl mx-auto">
      <aside className="space-y-2">
        <div className="flex flex-wrap gap-1">
          <button onClick={startNew} className="px-2 py-1 text-sm bg-slate-900 text-white rounded">
            + New
          </button>
          <button onClick={() => loadFixture('hdd')} className="px-2 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded">
            Load SC846 ref (HDD)
          </button>
          <button onClick={() => loadFixture('meta')} className="px-2 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded">
            + metadata variant
          </button>
        </div>
        <ul className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded divide-y">
          {workspace.nodes.length === 0 ? (
            <li className="p-3 text-sm text-slate-500 dark:text-slate-400">No node configs yet. Click + New or load a reference.</li>
          ) : (
            workspace.nodes.map((n) => (
              <li
                key={n.id}
                className={`p-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedId === n.id ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
                onClick={() => setSelectedId(n.id)}
              >
                <div className="text-sm font-medium truncate">{n.name || '(unnamed)'}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{n.role ?? 'node'}</div>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section>
        {!selected ? (
          <div className="text-sm text-slate-500 dark:text-slate-400 p-4">Select a node on the left, or create one.</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div className="flex-1">
                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Name</label>
                <input
                  value={selected.name}
                  onChange={(e) => update({ name: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                />
              </div>
              <div className="w-40">
                <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Role tag</label>
                <input
                  value={selected.role ?? ''}
                  onChange={(e) => update({ role: e.target.value || undefined })}
                  placeholder="e.g. osd"
                  className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                />
              </div>
              <button
                onClick={() => {
                  deleteNode(selected.id);
                  setSelectedId(null);
                }}
                className="px-2 py-1 text-sm bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 rounded"
              >
                Delete
              </button>
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-4">
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 space-y-3">
                <h4 className="text-sm font-semibold">Platform</h4>
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Chassis</label>
                  <ComponentPicker
                    library={library}
                    categories={['chassis']}
                    value={selected.chassis_id}
                    onChange={(id) => update({ chassis_id: id })}
                  />
                </div>
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">CPU</label>
                    <ComponentPicker
                      library={library}
                      categories={['cpu']}
                      value={selected.cpu_id}
                      onChange={(id) => update({ cpu_id: id })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Sockets</label>
                    <input
                      type="number"
                      min={1}
                      value={selected.cpu_count}
                      onChange={(e) => update({ cpu_count: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">RAM module</label>
                    <ComponentPicker
                      library={library}
                      categories={['ram']}
                      value={selected.ram_module_id}
                      onChange={(id) => update({ ram_module_id: id })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Count</label>
                    <input
                      type="number"
                      min={0}
                      value={selected.ram_module_count}
                      onChange={(e) => update({ ram_module_count: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr_5rem] gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">PSU</label>
                    <ComponentPicker
                      library={library}
                      categories={['psu']}
                      value={selected.psu_id}
                      onChange={(id) => update({ psu_id: id })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Count</label>
                    <input
                      type="number"
                      min={1}
                      value={selected.psu_count}
                      onChange={(e) => update({ psu_count: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 space-y-3">
                <h4 className="text-sm font-semibold">Drives</h4>
                {selected.drives.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_6rem_4rem_2rem] gap-1 items-end">
                    <ComponentPicker
                      library={library}
                      categories={['hdd', 'nvme_ssd', 'sata_ssd']}
                      value={slot.component_id}
                      onChange={(id) =>
                        update({
                          drives: selected.drives.map((s, i) => (i === idx ? { ...s, component_id: id } : s)),
                        })
                      }
                    />
                    <select
                      value={slot.role}
                      onChange={(e) =>
                        update({
                          drives: selected.drives.map((s, i) =>
                            i === idx ? { ...s, role: e.target.value as DriveRole } : s
                          ),
                        })
                      }
                      className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                    >
                      {DRIVE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={slot.count}
                      onChange={(e) =>
                        update({
                          drives: selected.drives.map((s, i) =>
                            i === idx ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s
                          ),
                        })
                      }
                      className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                    />
                    <button
                      onClick={() => update({ drives: selected.drives.filter((_, i) => i !== idx) })}
                      className="text-rose-700 dark:text-rose-300 text-sm"
                      aria-label="Remove drive slot"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    update({ drives: [...selected.drives, { component_id: '', count: 1, role: 'osd' }] })
                  }
                  className="text-sm text-sky-700 dark:text-sky-300 hover:underline"
                >
                  + Add drive slot
                </button>

                <h4 className="text-sm font-semibold pt-2">HBAs</h4>
                {selected.hbas.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_4rem_2rem] gap-1 items-end">
                    <ComponentPicker
                      library={library}
                      categories={['hba']}
                      value={slot.component_id}
                      onChange={(id) =>
                        update({ hbas: selected.hbas.map((s, i) => (i === idx ? { ...s, component_id: id } : s)) })
                      }
                    />
                    <input
                      type="number"
                      min={1}
                      value={slot.count}
                      onChange={(e) =>
                        update({
                          hbas: selected.hbas.map((s, i) =>
                            i === idx ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s
                          ),
                        })
                      }
                      className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                    />
                    <button
                      onClick={() => update({ hbas: selected.hbas.filter((_, i) => i !== idx) })}
                      className="text-rose-700 dark:text-rose-300 text-sm"
                      aria-label="Remove HBA"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => update({ hbas: [...selected.hbas, { component_id: '', count: 1 }] })}
                  className="text-sm text-sky-700 dark:text-sky-300 hover:underline"
                >
                  + Add HBA
                </button>

                <h4 className="text-sm font-semibold pt-2">NICs</h4>
                {selected.nics.map((slot, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_4rem_2rem] gap-1 items-end">
                    <ComponentPicker
                      library={library}
                      categories={['nic']}
                      value={slot.component_id}
                      onChange={(id) =>
                        update({ nics: selected.nics.map((s, i) => (i === idx ? { ...s, component_id: id } : s)) })
                      }
                    />
                    <input
                      type="number"
                      min={1}
                      value={slot.count}
                      onChange={(e) =>
                        update({
                          nics: selected.nics.map((s, i) =>
                            i === idx ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s
                          ),
                        })
                      }
                      className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
                    />
                    <button
                      onClick={() => update({ nics: selected.nics.filter((_, i) => i !== idx) })}
                      className="text-rose-700 dark:text-rose-300 text-sm"
                      aria-label="Remove NIC"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => update({ nics: [...selected.nics, { component_id: '', count: 1 }] })}
                  className="text-sm text-sky-700 dark:text-sky-300 hover:underline"
                >
                  + Add NIC
                </button>
              </div>
            </div>

            {derived ? <NodeDerivedPanel derived={derived} /> : null}

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3">
              <h4 className="text-sm font-semibold mb-2">Validation</h4>
              <WarningsList issues={issues} empty="No issues — node is clean." />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
