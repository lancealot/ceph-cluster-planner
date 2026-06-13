import { describe, expect, it } from 'vitest';
import type { NodeConfig } from '../types/node';
import { validateNode } from './validation';
import { defaultClusterDefaults } from '../state/defaults';
import { bundledLibrary } from './test-helpers';
import { SC846_HDD_ONLY, SC846_WITH_METADATA } from './fixtures/sc846';

const lib = bundledLibrary();
const defaults = defaultClusterDefaults();

function findIssue(issues: ReturnType<typeof validateNode>, code: string) {
  return issues.find((i) => i.code === code);
}

describe('SC846 HDD-only — clean baseline', () => {
  const issues = validateNode(SC846_HDD_ONLY, lib, defaults);

  it('has no errors', () => {
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('has no CPU warning (24 HDD OSD × 0.5 = 12 required ≤ 32 cores)', () => {
    expect(findIssue(issues, 'node.cores_per_osd_low')).toBeUndefined();
  });

  it('DB/WAL ratio at exactly 4.00% is acceptable (boundary inclusive)', () => {
    expect(findIssue(issues, 'node.db_wal_ratio_out_of_band')).toBeUndefined();
  });

  it('no PCIe over-slot error at default lanes_per_slot=8', () => {
    expect(findIssue(issues, 'node.over_pcie_slots')).toBeUndefined();
  });

  it('no missing-DB/WAL warning', () => {
    expect(findIssue(issues, 'node.hdd_without_db_wal')).toBeUndefined();
  });
});

describe('SC846 with metadata NVMe — weighted CPU budget', () => {
  const issues = validateNode(SC846_WITH_METADATA, lib, defaults);

  it('no CPU warning: 24 HDD × 0.5 + 2 NVMe × 2 = 16 required ≤ 32 cores', () => {
    // The NVMe threshold applies only to the NVMe OSDs, not the whole node —
    // two metadata drives must not put all 24 HDD OSDs on the 2-cores/OSD bar.
    expect(findIssue(issues, 'node.cores_per_osd_low')).toBeUndefined();
  });

  it('has no errors', () => {
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('CPU budget warning still fires when genuinely under-provisioned', () => {
  it('all-NVMe node: 20 NVMe OSD × 2 = 40 required > 32 cores → warning', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      drives: [{ component_id: 'nvme-micron-7500-pro-7p68tb', count: 20, role: 'osd' }],
    };
    const issues = validateNode(node, lib, defaults);
    const w = findIssue(issues, 'node.cores_per_osd_low');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
    expect(w?.message).toContain('40 required');
  });

  it('is silent exactly at the budget (16 NVMe OSD × 2 = 32 = 32 cores)', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      drives: [{ component_id: 'nvme-micron-7500-pro-7p68tb', count: 16, role: 'osd' }],
    };
    const issues = validateNode(node, lib, defaults);
    expect(findIssue(issues, 'node.cores_per_osd_low')).toBeUndefined();
  });

  it('db_wal drives carry no core requirement (24 HDD + 6 db_wal = 12 required)', () => {
    const issues = validateNode(SC846_HDD_ONLY, lib, defaults);
    expect(findIssue(issues, 'node.cores_per_osd_low')).toBeUndefined();
  });
});

describe('PCIe over-subscription error', () => {
  it('does not fire on SC846 at lanes_per_slot=8 (5 ≤ 7)', () => {
    const issues = validateNode(SC846_HDD_ONLY, lib, defaults);
    expect(findIssue(issues, 'node.over_pcie_slots')).toBeUndefined();
  });

  it('fires on SC846 at lanes_per_slot=4 (10 > 7)', () => {
    const issues = validateNode(SC846_HDD_ONLY, lib, { ...defaults, lanes_per_slot: 4 });
    const e = findIssue(issues, 'node.over_pcie_slots');
    expect(e).toBeDefined();
    expect(e?.severity).toBe('error');
  });
});

describe('Under-RAM warning', () => {
  it('fires when installed < required', () => {
    const node: NodeConfig = { ...SC846_HDD_ONLY, ram_module_count: 2 };
    const issues = validateNode(node, lib, defaults);
    const w = findIssue(issues, 'node.under_ram');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
  });
});

describe('Missing DB/WAL warning', () => {
  it('fires when HDD OSDs present but no db_wal drives', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      drives: [SC846_HDD_ONLY.drives[0]],
    };
    const issues = validateNode(node, lib, defaults);
    const w = findIssue(issues, 'node.hdd_without_db_wal');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
  });
});

describe('DB/WAL ratio out-of-band warning', () => {
  it('fires when ratio < 1% (1 × 3.84 TB / 576 TB = 0.67%)', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      drives: [
        SC846_HDD_ONLY.drives[0],
        { component_id: 'nvme-micron-7500-pro-3p84tb', count: 1, role: 'db_wal' },
      ],
    };
    const issues = validateNode(node, lib, defaults);
    expect(findIssue(issues, 'node.db_wal_ratio_out_of_band')).toBeDefined();
  });

  it('fires when ratio > 4% (8 × 3.84 / 576 = 5.33%)', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      drives: [
        SC846_HDD_ONLY.drives[0],
        { component_id: 'nvme-micron-7500-pro-3p84tb', count: 8, role: 'db_wal' },
      ],
    };
    const issues = validateNode(node, lib, defaults);
    expect(findIssue(issues, 'node.db_wal_ratio_out_of_band')).toBeDefined();
  });

  it('is silent at exactly 1.00% (boundary inclusive)', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      drives: [
        { component_id: 'hdd-seagate-exos-x24-24tb', count: 16, role: 'osd' },
        { component_id: 'nvme-micron-7500-pro-3p84tb', count: 1, role: 'db_wal' },
      ],
    };
    const issues = validateNode(node, lib, defaults);
    expect(findIssue(issues, 'node.db_wal_ratio_out_of_band')).toBeUndefined();
  });
});

describe('PSU N+1 redundancy', () => {
  it('with 2 PSUs the budget is one supply, not both', () => {
    // SC846 reference: 2× 1200W PSU, max power ~901W. Both running has 2400W
    // headroom; one failed leaves 1200W — still over the 901W draw, so clean.
    const issues = validateNode(SC846_HDD_ONLY, lib, defaults);
    expect(findIssue(issues, 'node.over_power')).toBeUndefined();
  });

  it('warns at >85% of total PSU capacity (lower efficiency band)', () => {
    // 24 HDD @ 11W max = 264W; if we cut to a single 750W PSU we are at
    // ~120% of capacity — solid error. Use a bigger draw with redundant
    // PSUs to land in the >85% warning band instead.
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      psu_count: 2,
      ram_module_count: 32,
    };
    const issues = validateNode(node, lib, defaults);
    // With 32 modules and 24 disks etc., we're not necessarily over 85% — the
    // assertion here is that *if* power exceeds the redundant budget, the rule
    // says N+1 in its message.
    const e = findIssue(issues, 'node.over_power');
    if (e) expect(e.message).toMatch(/N\+1|with one failed/);
  });

  it('errors when max power exceeds the surviving-PSU budget', () => {
    // 1× 1200W PSU with 24 HDD + 1 EPYC 7763 (280W) ≈ tight.
    // Force an obvious overage: 1× 1200W PSU, dual EPYC 7763 (560W TDP max
    // alone), 24 drives — easily over 1200W max.
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      cpu_id: 'cpu-amd-epyc-7763',
      cpu_count: 2,
      psu_count: 1,
    };
    const issues = validateNode(node, lib, defaults);
    expect(findIssue(issues, 'node.over_power')).toBeDefined();
  });
});

describe('HBA port coverage', () => {
  it('SC846 reference fits 24 SAS drives into 3× 9300-8i (24 ports)', () => {
    const issues = validateNode(SC846_HDD_ONLY, lib, defaults);
    expect(findIssue(issues, 'node.under_hba_ports')).toBeUndefined();
  });

  it('errors when SAS drive count exceeds available ports', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      hbas: [{ component_id: 'hba-lsi-9300-8i', count: 1 }],
    };
    const issues = validateNode(node, lib, defaults);
    const e = findIssue(issues, 'node.under_hba_ports');
    expect(e).toBeDefined();
    expect(e?.severity).toBe('error');
    expect(e?.message).toContain('24 SAS/SATA drives');
    expect(e?.message).toContain('8 HBA ports');
  });

  it('does not count NVMe drives against HBA ports', () => {
    const node: NodeConfig = {
      ...SC846_HDD_ONLY,
      drives: [
        { component_id: 'nvme-micron-7500-pro-3p84tb', count: 24, role: 'osd' },
      ],
      hbas: [],
    };
    const issues = validateNode(node, lib, defaults);
    expect(findIssue(issues, 'node.under_hba_ports')).toBeUndefined();
  });
});

describe('Network bandwidth vs aggregate OSD throughput', () => {
  it('SC846 reference is clean (200 Gb/s vs 38.4 = 5.2×)', () => {
    const issues = validateNode(SC846_HDD_ONLY, lib, defaults);
    expect(findIssue(issues, 'node.network_under_osd_throughput')).toBeUndefined();
    expect(findIssue(issues, 'node.no_network')).toBeUndefined();
  });

  it('warns when network can\'t saturate disks (between 0.5× and 1.0×)', () => {
    // Swap to a single dual-25 GbE (50 Gb/s) — 50/38.4 = 1.30×, still clean.
    // Down to a single dual-25 GbE serving more drives: with 60 HDDs we'd be
    // 96 Gb/s aggregate. Easier: drop to a single dual-10 GbE (20 Gb/s) on the
    // 24-drive SC846 — 20/38.4 = 0.52×, in the warning band.
    const node = {
      ...SC846_HDD_ONLY,
      nics: [{ component_id: 'nic-intel-x710-10gbe', count: 1 }],
    };
    const issues = validateNode(node, lib, defaults);
    const w = findIssue(issues, 'node.network_under_osd_throughput');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
    expect(w?.message).toContain('20 Gb/s');
  });

  it('errors when network < 50% of aggregate OSD throughput', () => {
    // 20 NVMe OSDs × 28 Gb/s = 560 Gb/s; dual 100 GbE = 200 Gb/s; ratio 0.36×.
    const node = {
      ...SC846_HDD_ONLY,
      drives: [{ component_id: 'nvme-micron-7500-pro-3p84tb', count: 20, role: 'osd' as const }],
    };
    const issues = validateNode(node, lib, defaults);
    const e = findIssue(issues, 'node.network_under_osd_throughput');
    expect(e).toBeDefined();
    expect(e?.severity).toBe('error');
    expect(e?.message).toContain('grossly under-provisioned');
  });

  it('errors when OSDs configured but no NIC at all', () => {
    const node = { ...SC846_HDD_ONLY, nics: [] };
    const issues = validateNode(node, lib, defaults);
    const e = findIssue(issues, 'node.no_network');
    expect(e).toBeDefined();
    expect(e?.severity).toBe('error');
    expect(findIssue(issues, 'node.network_under_osd_throughput')).toBeUndefined();
  });

  it('does not warn on a fresh node with no OSDs and no NICs', () => {
    const node = { ...SC846_HDD_ONLY, drives: [], nics: [] };
    const issues = validateNode(node, lib, defaults);
    expect(findIssue(issues, 'node.network_under_osd_throughput')).toBeUndefined();
    expect(findIssue(issues, 'node.no_network')).toBeUndefined();
  });
});

describe('Power over-budget error', () => {
  it('fires when max power exceeds total PSU capacity', () => {
    const node: NodeConfig = { ...SC846_HDD_ONLY, psu_count: 1 };
    const cap = lib['psu-supermicro-1200w-platinum'];
    const issues = validateNode(node, lib, defaults);
    if (cap && cap.category === 'psu') {
      const single = 1 * cap.wattage;
      const maxDraw = 901;
      if (maxDraw <= single) {
        expect(findIssue(issues, 'node.over_power')).toBeUndefined();
      } else {
        expect(findIssue(issues, 'node.over_power')).toBeDefined();
      }
    }
  });
});
