import { useState } from 'react';
import type { Component, ComponentCategory } from '../../types/components';

interface Props {
  initial?: Component;
  onSubmit: (c: Component) => void;
  onCancel?: () => void;
}

const CATEGORIES: ComponentCategory[] = [
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

function defaultFor(category: ComponentCategory): Component {
  const base = {
    id: `custom-${Date.now().toString(36)}`,
    vendor: '',
    model: '',
    price_usd: 0,
    watts_typical: 0,
    watts_max: 0,
    as_of_date: new Date().toISOString().slice(0, 10),
  } as const;
  switch (category) {
    case 'chassis':
      return { ...base, category, ru: 2, drive_bays_lff: 0, drive_bays_sff: 0, drive_bays_nvme: 0, pcie_slots: 0, max_psu_w: 0 };
    case 'cpu':
      return { ...base, category, cores: 0, threads: 0, base_clock_ghz: 0, socket: '', tdp_w: 0 };
    case 'ram':
      return { ...base, category, capacity_gb: 0, speed_mhz: 0, ecc: true };
    case 'hdd':
      return { ...base, category, capacity_tb: 0, form_factor: '3.5in', interface: 'sas' };
    case 'nvme_ssd':
      return { ...base, category, capacity_tb: 0, form_factor: 'u.3', interface: 'nvme_pcie4' };
    case 'sata_ssd':
      return { ...base, category, capacity_tb: 0, form_factor: '2.5in', interface: 'sata' };
    case 'hba':
      return { ...base, category, ports: 8, port_type: 'sas', pcie_lanes: 8, pcie_gen: 3 };
    case 'nic':
      return { ...base, category, ports: 2, port_speed_gbps: 25, pcie_lanes: 8, pcie_gen: 3 };
    case 'psu':
      return { ...base, category, wattage: 1200, efficiency_rating: 'other' };
  }
}

export function CustomComponentForm({ initial, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<Component>(initial ?? defaultFor('chassis'));

  function patch<K extends keyof Component>(key: K, value: Component[K]) {
    setDraft({ ...draft, [key]: value });
  }
  // category-specific updates use a loose cast — Zod will validate on import
  function patchAny(key: string, value: unknown) {
    setDraft({
      ...(draft as unknown as Record<string, unknown>),
      [key]: value,
    } as unknown as Component);
  }
  function changeCategory(c: ComponentCategory) {
    const fresh = defaultFor(c);
    setDraft({ ...fresh, id: draft.id, vendor: draft.vendor, model: draft.model });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.id || !draft.vendor || !draft.model) return;
    onSubmit(draft);
  }

  const d = draft as unknown as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : 0);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  return (
    <form onSubmit={submit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 space-y-2 text-sm">
      <h4 className="text-sm font-semibold">{initial ? 'Edit custom component' : 'Add custom component'}</h4>
      <div className="grid grid-cols-4 gap-2">
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">Category</div>
          <select
            value={draft.category}
            onChange={(e) => changeCategory(e.target.value as ComponentCategory)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            disabled={!!initial}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">ID</div>
          <input
            value={draft.id}
            onChange={(e) => patch('id', e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            disabled={!!initial}
          />
        </label>
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">Vendor</div>
          <input
            value={draft.vendor}
            onChange={(e) => patch('vendor', e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
          />
        </label>
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">Model</div>
          <input
            value={draft.model}
            onChange={(e) => patch('model', e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
          />
        </label>
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">Price (USD)</div>
          <input
            type="number"
            min={0}
            value={draft.price_usd}
            onChange={(e) => patch('price_usd', parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
          />
        </label>
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">Watts (typ)</div>
          <input
            type="number"
            min={0}
            value={draft.watts_typical}
            onChange={(e) => patch('watts_typical', parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
          />
        </label>
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">Watts (max)</div>
          <input
            type="number"
            min={0}
            value={draft.watts_max}
            onChange={(e) => patch('watts_max', parseFloat(e.target.value) || 0)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
          />
        </label>
        <label>
          <div className="text-xs text-slate-500 dark:text-slate-400">As-of date</div>
          <input
            type="date"
            value={draft.as_of_date}
            onChange={(e) => patch('as_of_date', e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
          />
        </label>
      </div>

      {draft.category === 'chassis' ? (
        <div className="grid grid-cols-6 gap-2">
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">RU</div>
            <input
              type="number"
              min={1}
              max={20}
              value={num(d.ru)}
              onChange={(e) => patchAny('ru', Math.max(1, parseInt(e.target.value) || 1))}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">LFF bays</div>
            <input
              type="number"
              min={0}
              value={num(d.drive_bays_lff)}
              onChange={(e) => patchAny('drive_bays_lff', Math.max(0, parseInt(e.target.value) || 0))}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">SFF bays</div>
            <input
              type="number"
              min={0}
              value={num(d.drive_bays_sff)}
              onChange={(e) => patchAny('drive_bays_sff', Math.max(0, parseInt(e.target.value) || 0))}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">NVMe bays</div>
            <input
              type="number"
              min={0}
              value={num(d.drive_bays_nvme)}
              onChange={(e) => patchAny('drive_bays_nvme', Math.max(0, parseInt(e.target.value) || 0))}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">PCIe slots</div>
            <input
              type="number"
              min={0}
              value={num(d.pcie_slots)}
              onChange={(e) => patchAny('pcie_slots', Math.max(0, parseInt(e.target.value) || 0))}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Max PSU (W)</div>
            <input
              type="number"
              min={0}
              value={num(d.max_psu_w)}
              onChange={(e) => patchAny('max_psu_w', Math.max(0, parseInt(e.target.value) || 0))}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
        </div>
      ) : null}
      {draft.category === 'hdd' || draft.category === 'nvme_ssd' || draft.category === 'sata_ssd' ? (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Capacity (TB)</div>
            <input
              type="number"
              step={0.01}
              min={0}
              value={num(d.capacity_tb)}
              onChange={(e) => patchAny('capacity_tb', parseFloat(e.target.value) || 0)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Form factor</div>
            <input
              value={str(d.form_factor)}
              onChange={(e) => patchAny('form_factor', e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Interface</div>
            <input
              value={str(d.interface)}
              onChange={(e) => patchAny('interface', e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
        </div>
      ) : null}
      {draft.category === 'cpu' ? (
        <div className="grid grid-cols-3 gap-2">
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Cores</div>
            <input
              type="number"
              min={0}
              value={num(d.cores)}
              onChange={(e) => patchAny('cores', parseInt(e.target.value) || 0)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">TDP (W)</div>
            <input
              type="number"
              min={0}
              value={num(d.tdp_w)}
              onChange={(e) => patchAny('tdp_w', parseInt(e.target.value) || 0)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Socket</div>
            <input
              value={str(d.socket)}
              onChange={(e) => patchAny('socket', e.target.value)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
        </div>
      ) : null}
      {draft.category === 'ram' ? (
        <div className="grid grid-cols-2 gap-2">
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Capacity (GB)</div>
            <input
              type="number"
              min={0}
              value={num(d.capacity_gb)}
              onChange={(e) => patchAny('capacity_gb', parseInt(e.target.value) || 0)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
          <label>
            <div className="text-xs text-slate-500 dark:text-slate-400">Speed (MHz)</div>
            <input
              type="number"
              min={0}
              value={num(d.speed_mhz)}
              onChange={(e) => patchAny('speed_mhz', parseInt(e.target.value) || 0)}
              className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
            />
          </label>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1 text-sm bg-slate-900 text-white rounded">
          {initial ? 'Save' : 'Add'}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded">
            Cancel
          </button>
        ) : null}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Common fields cover most validation; advanced category-specific fields (chassis bays, PCIe lanes, etc.) can be tuned by editing the exported JSON until the editor is expanded in a later release.
      </p>
    </form>
  );
}
