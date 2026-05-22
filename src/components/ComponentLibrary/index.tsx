import { useMemo, useState } from 'react';
import { useLibrary } from '../../state/useLibrary';
import type { Component, ComponentCategory } from '../../types/components';
import { format_power, format_usd } from '../../calc/units';
import { FreshnessChip } from './FreshnessChip';

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
  const [filter, setFilter] = useState<ComponentCategory | 'all'>('all');

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

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Component Library</h2>
          <p className="text-sm text-slate-600">
            {totalCount} components · pricing as-of dates shown per row
          </p>
        </div>
        <select
          aria-label="Filter components by category"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ComponentCategory | 'all')}
          className="border rounded px-2 py-1 text-sm bg-white"
        >
          <option value="all">All categories</option>
          {categoryOrder.map((c) => (
            <option key={c} value={c}>
              {categoryLabels[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-6">
        {filteredCats.map((cat) => {
          const items = grouped.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <section key={cat}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700 mb-2">
                {categoryLabels[cat]} <span className="text-slate-400">({items.length})</span>
              </h3>
              <div className="bg-white rounded border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Vendor</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Spec</th>
                      <th className="px-3 py-2 font-medium text-right">Price</th>
                      <th className="px-3 py-2 font-medium text-right">Typ. W</th>
                      <th className="px-3 py-2 font-medium">Freshness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="px-3 py-2 text-slate-700">{c.vendor}</td>
                        <td className="px-3 py-2 font-medium">{c.model}</td>
                        <td className="px-3 py-2 text-slate-600">{describeSpec(c)}</td>
                        <td className="px-3 py-2 text-right">{format_usd(c.price_usd)}</td>
                        <td className="px-3 py-2 text-right">{format_power(c.watts_typical)}</td>
                        <td className="px-3 py-2">
                          <FreshnessChip date={c.as_of_date} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
