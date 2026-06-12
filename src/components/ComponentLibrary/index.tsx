import { useMemo, useState } from 'react';
import { useLibrary } from '../../state/useLibrary';
import { useWorkspace } from '../../state/workspace';
import bundled from '../../data/components.json';
import type { Component, ComponentCategory } from '../../types/components';
import { Panel, Freshness } from '../Shell/primitives';
import { EditablePrice } from './EditablePrice';
import { CustomComponentForm } from './CustomComponentForm';

const bundledList = bundled as Component[];
const bundledIds = new Set(bundledList.map((c) => c.id));
const bundledById = new Map(bundledList.map((c) => [c.id, c]));

const categoryLabels: Record<ComponentCategory, string> = {
  chassis: 'Chassis',
  cpu: 'CPU',
  ram: 'RAM',
  hdd: 'HDD',
  nvme_ssd: 'NVMe SSD',
  sata_ssd: 'SATA SSD',
  hba: 'HBA',
  nic: 'NIC',
  psu: 'PSU',
};

const categoryOrder: ComponentCategory[] = [
  'chassis',
  'cpu',
  'ram',
  'hdd',
  'nvme_ssd',
  'sata_ssd',
  'hba',
  'nic',
  'psu',
];

function describeSpec(c: Component): string {
  switch (c.category) {
    case 'chassis':
      return `${c.ru}U · ${c.drive_bays_lff} LFF · ${c.drive_bays_nvme} NVMe · ${c.pcie_slots} PCIe`;
    case 'cpu':
      return `${c.cores}C/${c.threads}T · ${c.base_clock_ghz} GHz · ${c.tdp_w}W TDP`;
    case 'ram':
      return `${c.capacity_gb} GB · ${c.speed_mhz} MHz${c.ecc ? ' · ECC' : ''}`;
    case 'hdd':
      return `${c.capacity_tb} TB · ${c.form_factor} · ${c.interface}${c.rpm ? ` · ${c.rpm} RPM` : ''}`;
    case 'nvme_ssd':
    case 'sata_ssd':
      return `${c.capacity_tb} TB · ${c.form_factor} · ${c.interface}${c.endurance_dwpd ? ` · ${c.endurance_dwpd} DWPD` : ''}`;
    case 'hba':
      return `${c.ports}-port ${c.port_type.toUpperCase()} · PCIe Gen${c.pcie_gen} x${c.pcie_lanes}`;
    case 'nic':
      return `${c.ports}× ${c.port_speed_gbps} GbE · PCIe Gen${c.pcie_gen} x${c.pcie_lanes}`;
    case 'psu':
      return `${c.wattage}W · ${c.efficiency_rating.replace('80plus_', '80+ ')}`;
  }
}

function fmtWatts(w: number): string {
  if (w >= 1000) return `${(w / 1000).toFixed(2)} kW`;
  return `${Math.round(w)} W`;
}

export function ComponentLibrary() {
  const library = useLibrary();
  const { workspace, upsertCustomComponent, deleteComponent, restoreComponent } = useWorkspace();
  const [cat, setCat] = useState<ComponentCategory | 'all'>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Component | null>(null);
  const [showForm, setShowForm] = useState(false);

  const allParts = useMemo(() => Object.values(library), [library]);
  const totalCount = allParts.length;

  const visibleParts = useMemo(() => {
    const qLower = q.trim().toLowerCase();
    return allParts.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false;
      if (qLower === '') return true;
      const hay = `${p.vendor} ${p.model} ${describeSpec(p)}`.toLowerCase();
      return hay.includes(qLower);
    });
  }, [allParts, cat, q]);

  const grouped = useMemo(() => {
    const m = new Map<ComponentCategory, Component[]>();
    for (const p of visibleParts) {
      const arr = m.get(p.category) ?? [];
      arr.push(p);
      m.set(p.category, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model));
    }
    return m;
  }, [visibleParts]);

  const catCounts = useMemo(() => {
    const c: Record<ComponentCategory, number> = {
      chassis: 0, cpu: 0, ram: 0, hdd: 0, nvme_ssd: 0, sata_ssd: 0, hba: 0, nic: 0, psu: 0,
    };
    for (const p of allParts) c[p.category]++;
    return c;
  }, [allParts]);

  const tombstoned = useMemo(() => {
    const map = new Map(bundledList.map((c) => [c.id, c]));
    return workspace.deleted_component_ids.map((id) => map.get(id)).filter(Boolean) as Component[];
  }, [workspace.deleted_component_ids]);

  function handleSubmit(c: Component) {
    upsertCustomComponent(c);
    setShowForm(false);
    setEditing(null);
  }

  return (
    <div className="screen">
      <div className="screen-inner" style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '18px', alignItems: 'start' }}>
        <div className="stack-sm" style={{ position: 'sticky', top: 0 }}>
          <span className="microlabel" style={{ padding: '0 10px' }}>Categories</span>
          <div className="cats">
            <button type="button" className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>
              <span>All</span><span className="n">{totalCount}</span>
            </button>
            {categoryOrder.map((c) => (
              <button key={c} type="button" className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>
                <span>{categoryLabels[c]}</span><span className="n">{catCounts[c]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="stack">
          <div className="row">
            <input
              className="inp grow"
              placeholder="Search vendor, model, spec…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ maxWidth: '320px' }}
              aria-label="Search components"
            />
            <span className="grow" />
            <span className="counts">prices = public list, per-row freshness</span>
            <button
              className="btn prime"
              type="button"
              onClick={() => {
                setEditing(null);
                setShowForm((s) => !s);
              }}
            >
              {showForm && !editing ? 'Close form' : '+ Custom part'}
            </button>
          </div>

          {showForm || editing ? (
            <CustomComponentForm
              initial={editing ?? undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          ) : null}

          {(cat === 'all' ? categoryOrder : [cat as ComponentCategory]).map((c) => {
            const items = grouped.get(c);
            if (!items || items.length === 0) return null;
            return (
              <Panel key={c} title={`${categoryLabels[c]} — ${items.length}`} tight>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>Vendor</th>
                      <th>Model</th>
                      <th>Spec</th>
                      <th className="r">Price</th>
                      <th className="r">Typ. W</th>
                      <th>As of</th>
                      <th className="r" style={{ width: '110px' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => {
                      const isBundled = bundledIds.has(p.id);
                      const isCustom = workspace.custom_components.some((x) => x.id === p.id);
                      const bundledPrice = bundledById.get(p.id)?.price_usd;
                      const priceModified = isCustom && bundledPrice !== undefined && bundledPrice !== p.price_usd;
                      const isOverride = isBundled && isCustom;
                      return (
                        <tr key={p.id}>
                          <td style={{ color: 'var(--text2)' }}>{p.vendor}</td>
                          <td>
                            <span style={{ fontWeight: 600 }}>{p.model}</span>
                            {isCustom && !isBundled ? <span className="tag" style={{ marginLeft: 6 }}>custom</span> : null}
                            {isOverride ? <span className="tag muted" style={{ marginLeft: 6 }}>overridden</span> : null}
                          </td>
                          <td className="spec">{describeSpec(p)}</td>
                          <td className="r price">
                            <EditablePrice
                              value={p.price_usd}
                              modified={priceModified}
                              onSave={(price_usd) => upsertCustomComponent({ ...p, price_usd } as Component)}
                            />
                          </td>
                          <td className="r spec">{fmtWatts(p.watts_typical)}</td>
                          <td><Freshness asof={p.as_of_date} /></td>
                          <td className="r">
                            <span className="row-actions">
                              <button className="btn sm" type="button" onClick={() => setEditing(p)}>Edit</button>
                              <button
                                className="btn sm danger"
                                type="button"
                                title={isOverride ? 'Revert to bundled price/specs' : isBundled ? 'Hide bundled (restorable below)' : 'Delete custom'}
                                onClick={() => deleteComponent(p.id, isBundled && !isCustom)}
                              >
                                {isOverride ? 'Revert' : isBundled ? 'Hide' : 'Delete'}
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            );
          })}

          {tombstoned.length > 0 ? (
            <Panel title={`Hidden bundled components — ${tombstoned.length}`} tight>
              <table className="tbl">
                <tbody>
                  {tombstoned.map((c) => (
                    <tr key={c.id}>
                      <td style={{ color: 'var(--text3)' }}>{c.vendor} {c.model}</td>
                      <td className="spec">{categoryLabels[c.category]}</td>
                      <td className="r">
                        <button className="btn sm" type="button" onClick={() => restoreComponent(c.id)}>
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
