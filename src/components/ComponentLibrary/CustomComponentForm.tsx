import { useState, type ReactNode } from 'react';
import type { Component, ComponentCategory } from '../../types/components';
import { Panel } from '../Shell/primitives';

interface Props {
  initial?: Component;
  onSubmit: (c: Component) => void;
  onCancel?: () => void;
}

const CATEGORIES: ComponentCategory[] = [
  'chassis', 'cpu', 'ram', 'hdd', 'nvme_ssd', 'sata_ssd', 'hba', 'nic', 'psu',
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

function Lbl({ label, children, span = 1 }: { label: string; children: ReactNode; span?: number }) {
  return (
    <label className="field" style={{ gridColumn: `span ${span}` }}>
      <span className="microlabel">{label}</span>
      {children}
    </label>
  );
}

export function CustomComponentForm({ initial, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<Component>(initial ?? defaultFor('chassis'));

  function patch<K extends keyof Component>(key: K, value: Component[K]) {
    setDraft({ ...draft, [key]: value });
  }
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
    <Panel title={initial ? 'Edit custom component' : 'Add custom component'}>
      <form onSubmit={submit} className="stack-sm">
        <div className="cols" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <Lbl label="Category">
            <select className="sel" value={draft.category} onChange={(e) => changeCategory(e.target.value as ComponentCategory)} disabled={!!initial}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Lbl>
          <Lbl label="ID">
            <input className="inp mono" value={draft.id} onChange={(e) => patch('id', e.target.value)} disabled={!!initial} />
          </Lbl>
          <Lbl label="Vendor">
            <input className="inp" value={draft.vendor} onChange={(e) => patch('vendor', e.target.value)} />
          </Lbl>
          <Lbl label="Model">
            <input className="inp" value={draft.model} onChange={(e) => patch('model', e.target.value)} />
          </Lbl>
          <Lbl label="Price (USD)">
            <input className="inp mono" type="number" min={0} value={draft.price_usd} onChange={(e) => patch('price_usd', parseFloat(e.target.value) || 0)} />
          </Lbl>
          <Lbl label="Watts (typ)">
            <input className="inp mono" type="number" min={0} value={draft.watts_typical} onChange={(e) => patch('watts_typical', parseFloat(e.target.value) || 0)} />
          </Lbl>
          <Lbl label="Watts (max)">
            <input className="inp mono" type="number" min={0} value={draft.watts_max} onChange={(e) => patch('watts_max', parseFloat(e.target.value) || 0)} />
          </Lbl>
          <Lbl label="As-of date">
            <input className="inp mono" type="date" value={draft.as_of_date} onChange={(e) => patch('as_of_date', e.target.value)} />
          </Lbl>
        </div>

        {draft.category === 'chassis' ? (
          <div className="cols" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            <Lbl label="RU"><input className="inp mono" type="number" min={1} max={20} value={num(d.ru)} onChange={(e) => patchAny('ru', Math.max(1, parseInt(e.target.value) || 1))} /></Lbl>
            <Lbl label="LFF bays"><input className="inp mono" type="number" min={0} value={num(d.drive_bays_lff)} onChange={(e) => patchAny('drive_bays_lff', Math.max(0, parseInt(e.target.value) || 0))} /></Lbl>
            <Lbl label="SFF bays"><input className="inp mono" type="number" min={0} value={num(d.drive_bays_sff)} onChange={(e) => patchAny('drive_bays_sff', Math.max(0, parseInt(e.target.value) || 0))} /></Lbl>
            <Lbl label="NVMe bays"><input className="inp mono" type="number" min={0} value={num(d.drive_bays_nvme)} onChange={(e) => patchAny('drive_bays_nvme', Math.max(0, parseInt(e.target.value) || 0))} /></Lbl>
            <Lbl label="PCIe slots"><input className="inp mono" type="number" min={0} value={num(d.pcie_slots)} onChange={(e) => patchAny('pcie_slots', Math.max(0, parseInt(e.target.value) || 0))} /></Lbl>
            <Lbl label="Max PSU (W)"><input className="inp mono" type="number" min={0} value={num(d.max_psu_w)} onChange={(e) => patchAny('max_psu_w', Math.max(0, parseInt(e.target.value) || 0))} /></Lbl>
          </div>
        ) : null}

        {draft.category === 'hdd' || draft.category === 'nvme_ssd' || draft.category === 'sata_ssd' ? (
          <div className="cols" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <Lbl label="Capacity (TB)"><input className="inp mono" type="number" step={0.01} min={0} value={num(d.capacity_tb)} onChange={(e) => patchAny('capacity_tb', parseFloat(e.target.value) || 0)} /></Lbl>
            <Lbl label="Form factor"><input className="inp mono" value={str(d.form_factor)} onChange={(e) => patchAny('form_factor', e.target.value)} /></Lbl>
            <Lbl label="Interface"><input className="inp mono" value={str(d.interface)} onChange={(e) => patchAny('interface', e.target.value)} /></Lbl>
          </div>
        ) : null}

        {draft.category === 'cpu' ? (
          <div className="cols" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <Lbl label="Cores"><input className="inp mono" type="number" min={0} value={num(d.cores)} onChange={(e) => patchAny('cores', parseInt(e.target.value) || 0)} /></Lbl>
            <Lbl label="Threads"><input className="inp mono" type="number" min={0} value={num(d.threads)} onChange={(e) => patchAny('threads', parseInt(e.target.value) || 0)} /></Lbl>
            <Lbl label="Base clock (GHz)"><input className="inp mono" type="number" step={0.1} min={0} value={num(d.base_clock_ghz)} onChange={(e) => patchAny('base_clock_ghz', parseFloat(e.target.value) || 0)} /></Lbl>
            <Lbl label="TDP (W)"><input className="inp mono" type="number" min={0} value={num(d.tdp_w)} onChange={(e) => patchAny('tdp_w', parseInt(e.target.value) || 0)} /></Lbl>
            <Lbl label="Socket"><input className="inp mono" value={str(d.socket)} onChange={(e) => patchAny('socket', e.target.value)} /></Lbl>
          </div>
        ) : null}

        {draft.category === 'ram' ? (
          <div className="cols c2">
            <Lbl label="Capacity (GB)"><input className="inp mono" type="number" min={0} value={num(d.capacity_gb)} onChange={(e) => patchAny('capacity_gb', parseInt(e.target.value) || 0)} /></Lbl>
            <Lbl label="Speed (MHz)"><input className="inp mono" type="number" min={0} value={num(d.speed_mhz)} onChange={(e) => patchAny('speed_mhz', parseInt(e.target.value) || 0)} /></Lbl>
          </div>
        ) : null}

        {draft.category === 'hba' || draft.category === 'nic' ? (
          <div className="cols" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <Lbl label="Ports"><input className="inp mono" type="number" min={0} value={num(d.ports)} onChange={(e) => patchAny('ports', parseInt(e.target.value) || 0)} /></Lbl>
            {draft.category === 'hba' ? (
              <Lbl label="Port type">
                <select className="sel mono" value={str(d.port_type)} onChange={(e) => patchAny('port_type', e.target.value)}>
                  <option value="sas">sas</option>
                  <option value="sata">sata</option>
                  <option value="nvme">nvme</option>
                </select>
              </Lbl>
            ) : (
              <Lbl label="Port speed (Gb/s)"><input className="inp mono" type="number" min={0} value={num(d.port_speed_gbps)} onChange={(e) => patchAny('port_speed_gbps', parseInt(e.target.value) || 0)} /></Lbl>
            )}
            <Lbl label="PCIe lanes"><input className="inp mono" type="number" min={0} value={num(d.pcie_lanes)} onChange={(e) => patchAny('pcie_lanes', parseInt(e.target.value) || 0)} /></Lbl>
            <Lbl label="PCIe gen">
              <select className="sel mono" value={num(d.pcie_gen)} onChange={(e) => patchAny('pcie_gen', parseInt(e.target.value) || 3)}>
                <option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
              </select>
            </Lbl>
          </div>
        ) : null}

        {draft.category === 'psu' ? (
          <div className="cols c2">
            <Lbl label="Wattage"><input className="inp mono" type="number" min={0} value={num(d.wattage)} onChange={(e) => patchAny('wattage', parseInt(e.target.value) || 0)} /></Lbl>
            <Lbl label="Efficiency">
              <select className="sel" value={str(d.efficiency_rating)} onChange={(e) => patchAny('efficiency_rating', e.target.value)}>
                <option value="80plus_gold">80+ Gold</option>
                <option value="80plus_platinum">80+ Platinum</option>
                <option value="80plus_titanium">80+ Titanium</option>
                <option value="other">other</option>
              </select>
            </Lbl>
          </div>
        ) : null}

        <div className="row">
          <button type="submit" className="btn prime">{initial ? 'Save' : 'Add'}</button>
          {onCancel ? <button type="button" className="btn" onClick={onCancel}>Cancel</button> : null}
          <span className="counts" style={{ marginLeft: 'auto' }}>Drive RPM and SSD endurance can be tuned via the exported JSON.</span>
        </div>
      </form>
    </Panel>
  );
}
