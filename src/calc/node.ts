import type { NodeConfig } from '../types/node';
import type { ComponentLibrary } from '../types/components';
import type { ClusterDefaults } from '../types/cluster';
import {
  isChassis,
  isCpu,
  isHba,
  isNic,
  isPsu,
  isRam,
  isStorageDrive,
} from '../types/components';

export interface NodeDerived {
  osd_count: number;
  hdd_osd_count: number;
  nvme_osd_count: number;
  raw_capacity_bytes: number;
  hdd_raw_capacity_bytes: number;
  nvme_raw_capacity_bytes: number;
  db_wal_capacity_bytes: number;
  total_drives: number;
  drives_by_form_factor: Record<string, number>;
  cpu_cores_total: number;
  ram_installed_gb: number;
  ram_required_gb: number;
  power_typical_w: number;
  power_max_w: number;
  cost_usd: number;
  pcie_lanes_used: number;
  pcie_slots_used: number;
  pcie_slots_available: number;
  chassis_ru: number;
  psu_capacity_w: number;
}

export function deriveNode(
  node: NodeConfig,
  library: ComponentLibrary,
  defaults: ClusterDefaults
): NodeDerived {
  let cost = 0;
  let powerTyp = 0;
  let powerMax = 0;
  let lanesUsed = 0;
  let chassisRu = 0;
  let pcieSlotsAvail = 0;
  let cpuCoresTotal = 0;
  let ramInstalledGb = 0;
  let totalDrives = 0;
  let psuCapacity = 0;
  const driveFF: Record<string, number> = {};

  const chassis = library[node.chassis_id];
  if (chassis && isChassis(chassis)) {
    cost += chassis.price_usd;
    powerTyp += chassis.watts_typical;
    powerMax += chassis.watts_max;
    chassisRu = chassis.ru;
    pcieSlotsAvail = chassis.pcie_slots;
  }

  const cpu = library[node.cpu_id];
  if (cpu && isCpu(cpu)) {
    cost += cpu.price_usd * node.cpu_count;
    powerTyp += cpu.watts_typical * node.cpu_count;
    powerMax += cpu.watts_max * node.cpu_count;
    cpuCoresTotal = cpu.cores * node.cpu_count;
  }

  const ram = library[node.ram_module_id];
  if (ram && isRam(ram)) {
    cost += ram.price_usd * node.ram_module_count;
    powerTyp += ram.watts_typical * node.ram_module_count;
    powerMax += ram.watts_max * node.ram_module_count;
    ramInstalledGb = ram.capacity_gb * node.ram_module_count;
  }

  const psu = library[node.psu_id];
  if (psu && isPsu(psu)) {
    cost += psu.price_usd * node.psu_count;
    psuCapacity = psu.wattage * node.psu_count;
  }

  let osdCount = 0;
  let hddOsdCount = 0;
  let nvmeOsdCount = 0;
  let rawBytes = 0;
  let hddRawBytes = 0;
  let nvmeRawBytes = 0;
  let dbWalBytes = 0;

  for (const slot of node.drives) {
    const d = library[slot.component_id];
    if (!d || !isStorageDrive(d)) continue;
    cost += d.price_usd * slot.count;
    powerTyp += d.watts_typical * slot.count;
    powerMax += d.watts_max * slot.count;
    totalDrives += slot.count;
    driveFF[d.form_factor] = (driveFF[d.form_factor] ?? 0) + slot.count;
    const bytes = d.capacity_tb * 1e12 * slot.count;
    if (slot.role === 'osd' || slot.role === 'metadata_osd') {
      osdCount += slot.count;
      rawBytes += bytes;
      if (d.category === 'hdd') {
        hddOsdCount += slot.count;
        hddRawBytes += bytes;
      } else {
        nvmeOsdCount += slot.count;
        nvmeRawBytes += bytes;
      }
    } else if (slot.role === 'db_wal') {
      dbWalBytes += bytes;
    }
  }

  for (const slot of node.hbas) {
    const c = library[slot.component_id];
    if (!c || !isHba(c)) continue;
    cost += c.price_usd * slot.count;
    powerTyp += c.watts_typical * slot.count;
    powerMax += c.watts_max * slot.count;
    lanesUsed += c.pcie_lanes * slot.count;
  }

  for (const slot of node.nics) {
    const c = library[slot.component_id];
    if (!c || !isNic(c)) continue;
    cost += c.price_usd * slot.count;
    powerTyp += c.watts_typical * slot.count;
    powerMax += c.watts_max * slot.count;
    lanesUsed += c.pcie_lanes * slot.count;
  }

  const lanesPerSlot = defaults.lanes_per_slot;

  return {
    osd_count: osdCount,
    hdd_osd_count: hddOsdCount,
    nvme_osd_count: nvmeOsdCount,
    raw_capacity_bytes: rawBytes,
    hdd_raw_capacity_bytes: hddRawBytes,
    nvme_raw_capacity_bytes: nvmeRawBytes,
    db_wal_capacity_bytes: dbWalBytes,
    total_drives: totalDrives,
    drives_by_form_factor: driveFF,
    cpu_cores_total: cpuCoresTotal,
    ram_installed_gb: ramInstalledGb,
    ram_required_gb: osdCount * defaults.ram_per_osd_gb,
    power_typical_w: powerTyp,
    power_max_w: powerMax,
    cost_usd: cost,
    pcie_lanes_used: lanesUsed,
    pcie_slots_used: lanesPerSlot > 0 ? Math.ceil(lanesUsed / lanesPerSlot) : 0,
    pcie_slots_available: pcieSlotsAvail,
    chassis_ru: chassisRu,
    psu_capacity_w: psuCapacity,
  };
}
