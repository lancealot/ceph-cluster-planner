import type { NodeConfig } from '../types/node';
import type { ComponentLibrary } from '../types/components';
import type { ClusterDefaults } from '../types/cluster';
import type { ValidationIssue } from '../types/scenario';
import { isChassis, isPsu } from '../types/components';
import { deriveNode } from './node';

const NVME_FORM_FACTORS = ['m.2', 'u.2', 'u.3', 'e1.s'] as const;

export const CORES_PER_OSD_NVME_THRESHOLD = 2;
export const CORES_PER_OSD_HDD_THRESHOLD = 0.5;
export const DB_WAL_RATIO_LOW = 0.01;
export const DB_WAL_RATIO_HIGH = 0.04;

export function validateNode(
  node: NodeConfig,
  library: ComponentLibrary,
  defaults: ClusterDefaults
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const d = deriveNode(node, library, defaults);

  const chassis = library[node.chassis_id];
  if (!chassis || !isChassis(chassis)) {
    issues.push({
      severity: 'error',
      code: 'node.missing_chassis',
      scope: 'node',
      ref_id: node.id,
      message: 'Chassis not selected or unknown',
    });
  } else {
    const lff = d.drives_by_form_factor['3.5in'] ?? 0;
    const sff = d.drives_by_form_factor['2.5in'] ?? 0;
    const nvmeBays = NVME_FORM_FACTORS.reduce(
      (s, ff) => s + (d.drives_by_form_factor[ff] ?? 0),
      0
    );
    if (lff > chassis.drive_bays_lff) {
      issues.push({
        severity: 'error',
        code: 'node.over_lff_bays',
        scope: 'node',
        ref_id: node.id,
        message: `Need ${lff} LFF bays but chassis has ${chassis.drive_bays_lff}`,
      });
    }
    if (sff > chassis.drive_bays_sff) {
      issues.push({
        severity: 'error',
        code: 'node.over_sff_bays',
        scope: 'node',
        ref_id: node.id,
        message: `Need ${sff} SFF bays but chassis has ${chassis.drive_bays_sff}`,
      });
    }
    if (nvmeBays > chassis.drive_bays_nvme) {
      issues.push({
        severity: 'error',
        code: 'node.over_nvme_bays',
        scope: 'node',
        ref_id: node.id,
        message: `Need ${nvmeBays} NVMe bays but chassis has ${chassis.drive_bays_nvme}`,
      });
    }
  }

  if (d.ram_installed_gb < d.ram_required_gb) {
    issues.push({
      severity: 'warning',
      code: 'node.under_ram',
      scope: 'node',
      ref_id: node.id,
      message: `RAM ${d.ram_installed_gb} GB < required ${d.ram_required_gb} GB (${defaults.ram_per_osd_gb} GB × ${d.osd_count} OSDs)`,
    });
  }

  if (d.pcie_slots_used > d.pcie_slots_available) {
    issues.push({
      severity: 'error',
      code: 'node.over_pcie_slots',
      scope: 'node',
      ref_id: node.id,
      message: `PCIe slots used ${d.pcie_slots_used} > available ${d.pcie_slots_available} (${d.pcie_lanes_used} lanes at ${defaults.lanes_per_slot} lanes/slot)`,
    });
  }

  const psu = library[node.psu_id];
  if (psu && isPsu(psu)) {
    // Redundant PSUs are deployed N+1: the survivable budget is (count-1) × wattage.
    // A node that needs both supplies running browns out the moment one fails.
    const budget = d.psu_redundant_capacity_w;
    if (d.power_max_w > budget) {
      const redundant = d.psu_count > 1;
      issues.push({
        severity: 'error',
        code: 'node.over_power',
        scope: 'node',
        ref_id: node.id,
        message: redundant
          ? `Max power ${Math.round(d.power_max_w)} W exceeds N+1 PSU budget ${Math.round(budget)} W (${d.psu_count}× ${psu.wattage} W with one failed)`
          : `Max power ${Math.round(d.power_max_w)} W exceeds PSU capacity ${Math.round(budget)} W`,
      });
    } else if (d.psu_count > 1 && d.power_max_w > d.psu_capacity_w * 0.85) {
      // PSU best operates well under 85% load — flag it but don't error.
      issues.push({
        severity: 'warning',
        code: 'node.psu_high_load',
        scope: 'node',
        ref_id: node.id,
        message: `Max power ${Math.round(d.power_max_w)} W is ${((d.power_max_w / d.psu_capacity_w) * 100).toFixed(0)}% of total PSU capacity — efficiency curve drops above ~85% load`,
      });
    }
  }

  if (d.hdd_osd_count > 0) {
    if (d.db_wal_capacity_bytes === 0) {
      issues.push({
        severity: 'warning',
        code: 'node.hdd_without_db_wal',
        scope: 'node',
        ref_id: node.id,
        message: 'HDD OSDs present but no DB/WAL NVMe configured',
      });
    } else if (d.hdd_raw_capacity_bytes > 0) {
      const ratio = d.db_wal_capacity_bytes / d.hdd_raw_capacity_bytes;
      if (ratio < DB_WAL_RATIO_LOW || ratio > DB_WAL_RATIO_HIGH) {
        issues.push({
          severity: 'warning',
          code: 'node.db_wal_ratio_out_of_band',
          scope: 'node',
          ref_id: node.id,
          message: `DB/WAL ratio ${(ratio * 100).toFixed(2)}% outside 1–4% guidance`,
        });
      }
    }
  }

  if (d.hba_ports_needed > d.hba_ports_available) {
    issues.push({
      severity: 'error',
      code: 'node.under_hba_ports',
      scope: 'node',
      ref_id: node.id,
      message: `${d.hba_ports_needed} SAS/SATA drives but only ${d.hba_ports_available} HBA ports available`,
    });
  }

  if (d.osd_count > 0) {
    // Weighted per-class CPU budget: HDD OSDs and NVMe OSDs have different core
    // needs, and a mixed node shouldn't have every OSD judged by the NVMe bar.
    // db_wal/cache/system drives are not OSDs and carry no core requirement.
    const requiredCores =
      d.hdd_osd_count * CORES_PER_OSD_HDD_THRESHOLD +
      d.nvme_osd_count * CORES_PER_OSD_NVME_THRESHOLD;
    if (d.cpu_cores_total < requiredCores) {
      issues.push({
        severity: 'warning',
        code: 'node.cores_per_osd_low',
        scope: 'node',
        ref_id: node.id,
        message: `${d.cpu_cores_total} cores < ${requiredCores} required (${d.hdd_osd_count} HDD OSD × ${CORES_PER_OSD_HDD_THRESHOLD} + ${d.nvme_osd_count} NVMe OSD × ${CORES_PER_OSD_NVME_THRESHOLD})`,
      });
    }
  }

  return issues;
}
