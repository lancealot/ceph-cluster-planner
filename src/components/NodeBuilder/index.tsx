import { useMemo, useState } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useLibrary } from '../../state/useLibrary';
import type { DriveRole, NodeConfig } from '../../types/node';
import { deriveNode } from '../../calc/node';
import { validateNode } from '../../calc/validation';
import { format_bytes, format_usd } from '../../calc/units';
import { SC846_HDD_ONLY, SC846_WITH_METADATA } from '../../calc/fixtures/sc846';
import { Panel, Field } from '../Shell/primitives';
import { BayMap } from './BayMap';
import { WarningsList } from '../Common/WarningsList';
import type { Component, ComponentCategory } from '../../types/components';

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

function CategorySelect({
  library,
  category,
  value,
  onChange,
  mono = false,
}: {
  library: ReturnType<typeof useLibrary>;
  category: ComponentCategory | ComponentCategory[];
  value: string;
  onChange: (id: string) => void;
  mono?: boolean;
}) {
  const cats = Array.isArray(category) ? category : [category];
  const opts = useMemo(() => {
    const arr: Component[] = [];
    for (const c of Object.values(library)) if (cats.includes(c.category)) arr.push(c);
    arr.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model));
    return arr;
  }, [library, cats.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <select className={'sel' + (mono ? ' mono' : '')} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— select —</option>
      {opts.map((c) => (
        <option key={c.id} value={c.id}>{c.vendor} {c.model}</option>
      ))}
    </select>
  );
}

export function NodeBuilder() {
  const { workspace, upsertNode, deleteNode } = useWorkspace();
  const library = useLibrary();
  const defaults = workspace.cluster.defaults;

  const [selectedId, setSelectedId] = useState<string | null>(workspace.nodes[0]?.id ?? null);
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
    const copy: NodeConfig = {
      ...fixture,
      id: `${fixture.id}-${Date.now().toString(36)}`,
      drives: [...fixture.drives],
    };
    upsertNode(copy);
    setSelectedId(copy.id);
  }
  function update(patch: Partial<NodeConfig>) {
    if (!selected) return;
    upsertNode({ ...selected, ...patch });
  }

  function nodeCaption(n: NodeConfig): string {
    const nd = deriveNode(n, library, defaults);
    return `${n.role ?? 'node'} · ${(nd.raw_capacity_bytes / 1e12).toFixed(0)} TB raw · ${format_usd(nd.cost_usd)}`;
  }

  return (
    <div className="screen">
      <div className="screen-inner split-listed">
        <div className="stack-sm">
          <div className="row">
            <button className="btn prime sm grow" type="button" onClick={startNew}>+ New node</button>
            <button className="btn sm" type="button" onClick={() => loadFixture('hdd')}>SC846 ref</button>
          </div>
          <button className="btn sm w-full" type="button" onClick={() => loadFixture('meta')}>
            + metadata variant
          </button>
          <div className="panel itemlist">
            {workspace.nodes.length === 0 ? (
              <button type="button" className="no-click">
                <div className="t muted">No node configs yet</div>
                <div className="s">Click + New or load a reference</div>
              </button>
            ) : (
              workspace.nodes.map((n) => (
                <button key={n.id} type="button" className={selectedId === n.id ? 'on' : ''} onClick={() => setSelectedId(n.id)}>
                  <div className="t">{n.name || '(unnamed)'}</div>
                  <div className="s">{nodeCaption(n)}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {!selected || !derived ? (
          <Panel>
            <p className="note">Select a node on the left, or create one.</p>
          </Panel>
        ) : (
          <div className="stack">
            <div className="row">
              <div className="field grow">
                <span className="microlabel">Name</span>
                <input className="inp" value={selected.name} onChange={(e) => update({ name: e.target.value })} />
              </div>
              <div className="field w-130">
                <span className="microlabel">Role tag</span>
                <input className="inp mono" value={selected.role ?? ''} onChange={(e) => update({ role: e.target.value || undefined })} placeholder="e.g. osd" />
              </div>
              <button
                className="btn danger self-end"
                type="button"
                onClick={() => {
                  deleteNode(selected.id);
                  setSelectedId(null);
                }}
              >
                Delete
              </button>
            </div>

            <div className="stats">
              <div className="stat"><span className="microlabel">Raw capacity</span><div className="v">{format_bytes(derived.raw_capacity_bytes)}</div></div>
              <div className="stat"><span className="microlabel">OSDs</span><div className="v">{derived.osd_count} <small>{derived.hdd_osd_count}H · {derived.nvme_osd_count}N</small></div></div>
              <div className={'stat' + (derived.ram_installed_gb < derived.ram_required_gb ? ' bad' : '')}>
                <span className="microlabel">RAM req / have</span>
                <div className="v">{derived.ram_required_gb} / {derived.ram_installed_gb} <small>GB</small></div>
              </div>
              <div className={'stat' + (derived.power_max_w > derived.psu_redundant_capacity_w ? ' bad' : '')}>
                <span className="microlabel">Power typ / max</span>
                <div className="v">{Math.round(derived.power_typical_w)} / {Math.round(derived.power_max_w)} <small>W{derived.psu_count > 1 ? ` · N+1 ${Math.round(derived.psu_redundant_capacity_w)}` : ''}</small></div>
              </div>
              <div className={'stat' + (derived.pcie_slots_used > derived.pcie_slots_available ? ' bad' : '')}>
                <span className="microlabel">PCIe slots</span>
                <div className="v">{derived.pcie_slots_used} / {derived.pcie_slots_available} <small>{derived.pcie_lanes_used} lanes</small></div>
              </div>
              <div className="stat"><span className="microlabel">Cost</span><div className="v">{format_usd(derived.cost_usd)}</div></div>
            </div>

            <div className="cols c2">
              <Panel title="Platform">
                <div className="stack-sm">
                  <Field label="Chassis">
                    <CategorySelect library={library} category="chassis" value={selected.chassis_id} onChange={(id) => update({ chassis_id: id })} />
                  </Field>
                  <div className="row">
                    <div className="grow">
                      <Field label="CPU">
                        <CategorySelect library={library} category="cpu" value={selected.cpu_id} onChange={(id) => update({ cpu_id: id })} />
                      </Field>
                    </div>
                    <div className="w-76">
                      <Field label="Sockets">
                        <input className="inp mono" type="number" min={1} value={selected.cpu_count} onChange={(e) => update({ cpu_count: Math.max(1, parseInt(e.target.value) || 1) })} />
                      </Field>
                    </div>
                  </div>
                  <div className="row">
                    <div className="grow">
                      <Field label="RAM module">
                        <CategorySelect library={library} category="ram" value={selected.ram_module_id} onChange={(id) => update({ ram_module_id: id })} />
                      </Field>
                    </div>
                    <div className="w-76">
                      <Field label="Count">
                        <input className="inp mono" type="number" min={0} value={selected.ram_module_count} onChange={(e) => update({ ram_module_count: Math.max(0, parseInt(e.target.value) || 0) })} />
                      </Field>
                    </div>
                  </div>
                  <div className="row">
                    <div className="grow">
                      <Field label="PSU">
                        <CategorySelect library={library} category="psu" value={selected.psu_id} onChange={(id) => update({ psu_id: id })} />
                      </Field>
                    </div>
                    <div className="w-76">
                      <Field label="Count">
                        <input className="inp mono" type="number" min={1} value={selected.psu_count} onChange={(e) => update({ psu_count: Math.max(1, parseInt(e.target.value) || 1) })} />
                      </Field>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel
                title="Drive bays"
                right={<span className="counts">{derived.total_drives} populated</span>}
              >
                <BayMap node={selected} library={library} />
              </Panel>
            </div>

            <div className="cols c2">
              <Panel
                title="Drives"
                right={
                  <button
                    className="btn link sm"
                    type="button"
                    onClick={() => update({ drives: [...selected.drives, { component_id: '', count: 1, role: 'osd' }] })}
                  >
                    + Add drive slot
                  </button>
                }
              >
                <div className="stack-sm">
                  {selected.drives.length === 0 ? (
                    <span className="counts">No drives configured.</span>
                  ) : null}
                  {selected.drives.map((slot, idx) => (
                    <div className="slotrow drive" key={idx}>
                      <CategorySelect
                        library={library}
                        category={['hdd', 'nvme_ssd', 'sata_ssd']}
                        value={slot.component_id}
                        onChange={(id) =>
                          update({ drives: selected.drives.map((s, i) => (i === idx ? { ...s, component_id: id } : s)) })
                        }
                      />
                      <select
                        className="sel mono"
                        value={slot.role}
                        onChange={(e) =>
                          update({ drives: selected.drives.map((s, i) => (i === idx ? { ...s, role: e.target.value as DriveRole } : s)) })
                        }
                      >
                        {DRIVE_ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
                      </select>
                      <input
                        className="inp mono"
                        type="number"
                        min={1}
                        value={slot.count}
                        onChange={(e) =>
                          update({ drives: selected.drives.map((s, i) => (i === idx ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s)) })
                        }
                      />
                      <button className="xbtn" type="button" aria-label="Remove drive slot" onClick={() => update({ drives: selected.drives.filter((_, i) => i !== idx) })}>✕</button>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel
                title="Expansion cards"
                right={
                  <div className="row gap-4">
                    <button className="btn link sm" type="button" onClick={() => update({ hbas: [...selected.hbas, { component_id: '', count: 1 }] })}>+ HBA</button>
                    <button className="btn link sm" type="button" onClick={() => update({ nics: [...selected.nics, { component_id: '', count: 1 }] })}>+ NIC</button>
                  </div>
                }
              >
                <div className="stack-sm">
                  {selected.hbas.length === 0 && selected.nics.length === 0 ? (
                    <span className="counts">No HBAs or NICs configured.</span>
                  ) : null}
                  {selected.hbas.map((slot, idx) => (
                    <div className="slotrow card" key={'h' + idx}>
                      <CategorySelect
                        library={library}
                        category="hba"
                        value={slot.component_id}
                        onChange={(id) =>
                          update({ hbas: selected.hbas.map((s, i) => (i === idx ? { ...s, component_id: id } : s)) })
                        }
                      />
                      <input
                        className="inp mono"
                        type="number"
                        min={1}
                        value={slot.count}
                        onChange={(e) =>
                          update({ hbas: selected.hbas.map((s, i) => (i === idx ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s)) })
                        }
                      />
                      <button className="xbtn" type="button" aria-label="Remove HBA" onClick={() => update({ hbas: selected.hbas.filter((_, i) => i !== idx) })}>✕</button>
                    </div>
                  ))}
                  {selected.nics.map((slot, idx) => (
                    <div className="slotrow card" key={'n' + idx}>
                      <CategorySelect
                        library={library}
                        category="nic"
                        value={slot.component_id}
                        onChange={(id) =>
                          update({ nics: selected.nics.map((s, i) => (i === idx ? { ...s, component_id: id } : s)) })
                        }
                      />
                      <input
                        className="inp mono"
                        type="number"
                        min={1}
                        value={slot.count}
                        onChange={(e) =>
                          update({ nics: selected.nics.map((s, i) => (i === idx ? { ...s, count: Math.max(1, parseInt(e.target.value) || 1) } : s)) })
                        }
                      />
                      <button className="xbtn" type="button" aria-label="Remove NIC" onClick={() => update({ nics: selected.nics.filter((_, i) => i !== idx) })}>✕</button>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            <Panel title="Node validation">
              <WarningsList issues={issues} empty="Node is clean — no validation issues." />
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
}
