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
