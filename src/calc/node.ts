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

// Conservative sustained per-OSD throughput, Gb/s. HDDs are paced by mechanical
// seek; SATA SSDs by the 6 Gb/s SATA link; NVMe by a single PCIe 3.0 ×4 lane's
// worth of headroom (newer gens scale up but the validation only cares about
// "can the network keep up"). Updating any of these silently changes the
// network-bandwidth warning threshold — tests pin both directions.
export const HDD_OSD_GBPS = 1.6;        // ~200 MB/s sustained × 8 bits/byte / 1000
export const SATA_SSD_OSD_GBPS = 4;     // ~500 MB/s sustained
export const NVME_OSD_GBPS = 28;        // ~3.5 GB/s sustained (PCIe 3.0 ×4 ceiling)

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
  // What the node can survive on with one PSU failed. Equals psu_capacity_w
  // when psu_count <= 1; otherwise (count - 1) × wattage. This is the budget
  // the power check uses — anything that can brown a node out on a single
  // supply failure is the relevant constraint.
  psu_redundant_capacity_w: number;
  psu_count: number;
  // SAS/SATA port accounting. NVMe drives talk PCIe directly so they don't
  // count here — only HDDs and SATA SSDs need HBA ports. nvme-type HBAs are
  // excluded from the available pool too.
  hba_ports_needed: number;
  hba_ports_available: number;
  // Aggregate sustained throughput of all OSD-role drives, in Gb/s. Conservative
  // per-class numbers (see HDD_OSD_GBPS / SATA_SSD_OSD_GBPS / NVME_OSD_GBPS in
  // validation.ts). Compared against network_bandwidth_gbps to flag a network
  // that can't saturate the disks.
  osd_throughput_gbps: number;
  // Sum of port_count × port_speed_gbps across every NIC slot.
  network_bandwidth_gbps: number;
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

  let psuRedundantCapacity = 0;
  const psu = library[node.psu_id];
  if (psu && isPsu(psu)) {
    cost += psu.price_usd * node.psu_count;
    psuCapacity = psu.wattage * node.psu_count;
    psuRedundantCapacity = node.psu_count <= 1 ? psuCapacity : psu.wattage * (node.psu_count - 1);
  }

  let osdCount = 0;
  let hddOsdCount = 0;
  let nvmeOsdCount = 0;
  let rawBytes = 0;
  let hddRawBytes = 0;
  let nvmeRawBytes = 0;
  let dbWalBytes = 0;
  let hbaPortsNeeded = 0;
  let hbaPortsAvailable = 0;
  let osdThroughputGbps = 0;
  let networkBandwidthGbps = 0;

  for (const slot of node.drives) {
    const d = library[slot.component_id];
    if (!d || !isStorageDrive(d)) continue;
    cost += d.price_usd * slot.count;
    powerTyp += d.watts_typical * slot.count;
    powerMax += d.watts_max * slot.count;
    totalDrives += slot.count;
    driveFF[d.form_factor] = (driveFF[d.form_factor] ?? 0) + slot.count;
    // SAS HBAs serve HDDs and SATA SSDs. NVMe drives talk PCIe direct (or via
    // tri-mode AICs which we don't model separately yet).
    if (d.category === 'hdd' || d.category === 'sata_ssd') {
      hbaPortsNeeded += slot.count;
    }
    const bytes = d.capacity_tb * 1e12 * slot.count;
    if (slot.role === 'osd' || slot.role === 'metadata_osd') {
      osdCount += slot.count;
      rawBytes += bytes;
      if (d.category === 'hdd') {
        hddOsdCount += slot.count;
        hddRawBytes += bytes;
        osdThroughputGbps += HDD_OSD_GBPS * slot.count;
      } else if (d.category === 'sata_ssd') {
        nvmeOsdCount += slot.count;
        nvmeRawBytes += bytes;
        osdThroughputGbps += SATA_SSD_OSD_GBPS * slot.count;
      } else {
        nvmeOsdCount += slot.count;
        nvmeRawBytes += bytes;
        osdThroughputGbps += NVME_OSD_GBPS * slot.count;
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
    if (c.port_type === 'sas' || c.port_type === 'sata') {
      hbaPortsAvailable += c.ports * slot.count;
    }
    lanesUsed += c.pcie_lanes * slot.count;
  }

  for (const slot of node.nics) {
    const c = library[slot.component_id];
    if (!c || !isNic(c)) continue;
    cost += c.price_usd * slot.count;
    powerTyp += c.watts_typical * slot.count;
    powerMax += c.watts_max * slot.count;
    lanesUsed += c.pcie_lanes * slot.count;
    networkBandwidthGbps += c.ports * c.port_speed_gbps * slot.count;
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
    psu_redundant_capacity_w: psuRedundantCapacity,
    psu_count: node.psu_count,
    hba_ports_needed: hbaPortsNeeded,
    hba_ports_available: hbaPortsAvailable,
    osd_throughput_gbps: osdThroughputGbps,
    network_bandwidth_gbps: networkBandwidthGbps,
  };
}
