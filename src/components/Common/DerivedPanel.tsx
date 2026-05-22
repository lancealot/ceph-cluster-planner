import type { NodeDerived } from '../../calc/node';
import { format_bytes, format_power, format_usd } from '../../calc/units';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? <div className="text-xs text-slate-500 dark:text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function NodeDerivedPanel({ derived }: { derived: NodeDerived }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 space-y-3">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Derived values</h4>
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="OSDs"
          value={`${derived.osd_count}`}
          hint={`${derived.hdd_osd_count} HDD · ${derived.nvme_osd_count} NVMe`}
        />
        <Stat
          label="Raw OSD capacity"
          value={format_bytes(derived.raw_capacity_bytes)}
          hint={`${format_bytes(derived.hdd_raw_capacity_bytes)} HDD + ${format_bytes(derived.nvme_raw_capacity_bytes)} NVMe`}
        />
        <Stat
          label="DB/WAL NVMe"
          value={format_bytes(derived.db_wal_capacity_bytes)}
          hint={
            derived.hdd_raw_capacity_bytes > 0
              ? `${((derived.db_wal_capacity_bytes / derived.hdd_raw_capacity_bytes) * 100).toFixed(2)}% of HDD raw`
              : '—'
          }
        />
        <Stat
          label="RAM"
          value={`${derived.ram_installed_gb} GB`}
          hint={`required ${derived.ram_required_gb} GB`}
        />
        <Stat label="CPU cores" value={`${derived.cpu_cores_total}`} hint={derived.osd_count > 0 ? `${(derived.cpu_cores_total / derived.osd_count).toFixed(2)} cores/OSD` : '—'} />
        <Stat
          label="Power"
          value={format_power(derived.power_typical_w)}
          hint={`max ${format_power(derived.power_max_w)} · PSU ${format_power(derived.psu_capacity_w)}`}
        />
        <Stat label="Cost" value={format_usd(derived.cost_usd)} />
        <Stat
          label="PCIe slots"
          value={`${derived.pcie_slots_used} / ${derived.pcie_slots_available}`}
          hint={`${derived.pcie_lanes_used} lanes used`}
        />
      </div>
    </div>
  );
}
