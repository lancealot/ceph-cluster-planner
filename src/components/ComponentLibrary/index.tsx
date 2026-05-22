import { useMemo, useState } from 'react';
import { useLibrary } from '../../state/useLibrary';
import { useWorkspace } from '../../state/workspace';
import bundled from '../../data/components.json';
import type { Component, ComponentCategory } from '../../types/components';
import { format_power } from '../../calc/units';
import { FreshnessChip } from './FreshnessChip';
import { CustomComponentForm } from './CustomComponentForm';
import { EditablePrice } from './EditablePrice';
import { FreshnessBanner } from '../Common/FreshnessBanner';

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

export function ComponentLibrary() {
  const library = useLibrary();
  const { workspace, upsertCustomComponent, deleteComponent, restoreComponent } = useWorkspace();

  const [filter, setFilter] = useState<ComponentCategory | 'all'>('all');
  const [editing, setEditing] = useState<Component | null>(null);
  const [showForm, setShowForm] = useState(false);

  const grouped = useMemo(() => {
    const byCat = new Map<ComponentCategory, Component[]>();
    for (const c of Object.values(library)) {
      const arr = byCat.get(c.category) ?? [];
      arr.push(c);
      byCat.set(c.category, arr);
    }
    for (const arr of byCat.values()) {
      arr.sort((a, b) => a.vendor.localeCompare(b.vendor) || a.model.localeCompare(b.model));
    }
    return byCat;
  }, [library]);

  const filteredCats = filter === 'all' ? categoryOrder : [filter];
  const totalCount = Object.keys(library).length;

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
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <FreshnessBanner />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Component Library</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {totalCount} components ({workspace.custom_components.length} custom) · pricing freshness shown per row
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            aria-label="Filter components by category"
            value={filter}
            onChange={(e) => setFilter(e.target.value as ComponentCategory | 'all')}
            className="border rounded px-2 py-1 text-sm bg-white dark:bg-slate-800"
          >
            <option value="all">All categories</option>
            {categoryOrder.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c]}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setEditing(null);
              setShowForm((s) => !s);
            }}
            className="px-3 py-1 text-sm bg-slate-900 text-white rounded"
          >
            {showForm && !editing ? 'Close form' : '+ Custom component'}
          </button>
        </div>
      </div>

      {(showForm || editing) ? (
        <CustomComponentForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      ) : null}

      <div className="space-y-6">
        {filteredCats.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={cat}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-2">
                {categoryLabels[cat]} <span className="text-slate-400">({items.length})</span>
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Vendor</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Spec</th>
                      <th className="px-3 py-2 font-medium text-right">Price</th>
                      <th className="px-3 py-2 font-medium text-right">Typ. W</th>
                      <th className="px-3 py-2 font-medium">Freshness</th>
                      <th className="px-3 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => {
                      const isBundled = bundledIds.has(c.id);
                      const isCustom = workspace.custom_components.some((x) => x.id === c.id);
                      const bundledPrice = bundledById.get(c.id)?.price_usd;
                      const priceModified = isCustom && bundledPrice !== undefined && bundledPrice !== c.price_usd;
                      const isOverride = isBundled && isCustom;
                      return (
                        <tr key={c.id} className="border-t">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{c.vendor}</td>
                          <td className="px-3 py-2 font-medium">
                            {c.model}
                            {isCustom && !isBundled ? <span className="ml-1 text-[10px] uppercase bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300 px-1 rounded">custom</span> : null}
                            {isOverride ? <span className="ml-1 text-[10px] uppercase bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1 rounded">overridden</span> : null}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{describeSpec(c)}</td>
                          <td className="px-3 py-2 text-right">
                            <EditablePrice
                              value={c.price_usd}
                              modified={priceModified}
                              onSave={(price_usd) => upsertCustomComponent({ ...c, price_usd } as Component)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">{format_power(c.watts_typical)}</td>
                          <td className="px-3 py-2">
                            <FreshnessChip date={c.as_of_date} />
                          </td>
                          <td className="px-3 py-2 text-right space-x-1">
                            <button
                              onClick={() => setEditing(c)}
                              className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded"
                              title={isBundled && !isCustom ? 'Edit (creates a custom override)' : 'Edit'}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteComponent(c.id, isBundled && !isCustom)}
                              className="text-xs px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 rounded"
                              title={
                                isOverride
                                  ? 'Revert to bundled price/specs'
                                  : isBundled
                                  ? 'Tombstone bundled component (restorable below)'
                                  : 'Delete custom component'
                              }
                            >
                              {isOverride ? 'Revert' : isBundled ? 'Hide' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {tombstoned.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
            Hidden bundled components ({tombstoned.length})
          </h3>
          <div className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {tombstoned.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {c.vendor} {c.model} ({categoryLabels[c.category]})
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => restoreComponent(c.id)}
                        className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded"
                      >
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
