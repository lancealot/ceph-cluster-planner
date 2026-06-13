import { describe, expect, it } from 'vitest';
import { deriveNode } from './node';
import { defaultClusterDefaults } from '../state/defaults';
import { bundledLibrary } from './test-helpers';
import { SC846_HDD_ONLY, SC846_WITH_METADATA } from './fixtures/sc846';

const SC846_HDD_RAW_TB = 576;
const SC846_DB_WAL_TB = 23.04;
const SC846_HDD_OSD_COUNT = 24;
const SC846_WITH_META_OSD_COUNT = 26;
const SC846_RAM_PER_OSD_GB = 4;
const RAM_REQUIRED_HDD_ONLY_GB = SC846_HDD_OSD_COUNT * SC846_RAM_PER_OSD_GB;
const RAM_REQUIRED_WITH_META_GB = SC846_WITH_META_OSD_COUNT * SC846_RAM_PER_OSD_GB;
const SC846_TOTAL_CORES = 32;
const SC846_PCIE_LANES_USED = 40;
const SC846_PCIE_SLOTS_AT_8 = 5;
const SC846_PCIE_SLOTS_AVAIL = 7;

const lib = bundledLibrary();
const defaults = defaultClusterDefaults();

describe('SC846 reference node — HDD-only variant', () => {
  const d = deriveNode(SC846_HDD_ONLY, lib, defaults);

  it('counts 24 OSDs (all HDD)', () => {
    expect(d.osd_count).toBe(SC846_HDD_OSD_COUNT);
    expect(d.hdd_osd_count).toBe(SC846_HDD_OSD_COUNT);
    expect(d.nvme_osd_count).toBe(0);
  });

  it('reports 576 TB HDD raw capacity', () => {
    expect(d.hdd_raw_capacity_bytes / 1e12).toBe(SC846_HDD_RAW_TB);
    expect(d.raw_capacity_bytes / 1e12).toBe(SC846_HDD_RAW_TB);
  });

  it('reports 23.04 TB DB/WAL capacity (6 × 3.84 TB)', () => {
    expect(d.db_wal_capacity_bytes / 1e12).toBeCloseTo(SC846_DB_WAL_TB, 5);
  });

  it('requires 96 GB RAM (24 OSDs × 4 GB/OSD), 256 GB installed', () => {
    expect(d.ram_required_gb).toBe(RAM_REQUIRED_HDD_ONLY_GB);
    expect(d.ram_installed_gb).toBe(256);
  });

  it('PCIe lanes: 3×8 HBA + 16 NIC = 40 → 5 slots at lanes_per_slot=8', () => {
    expect(d.pcie_lanes_used).toBe(SC846_PCIE_LANES_USED);
    expect(d.pcie_slots_used).toBe(SC846_PCIE_SLOTS_AT_8);
    expect(d.pcie_slots_available).toBe(SC846_PCIE_SLOTS_AVAIL);
  });

  it('PCIe at lanes_per_slot=4 would compute 10 slots used (regression guard for original outline bug)', () => {
    const d4 = deriveNode(SC846_HDD_ONLY, lib, { ...defaults, lanes_per_slot: 4 });
    expect(d4.pcie_slots_used).toBe(10);
  });

  it('reports 32 total cores from a single EPYC 7543', () => {
    expect(d.cpu_cores_total).toBe(SC846_TOTAL_CORES);
  });

  it('drive form-factor accounting: 24 × 3.5" + 6 × u.3', () => {
    expect(d.drives_by_form_factor['3.5in']).toBe(24);
    expect(d.drives_by_form_factor['u.3']).toBe(6);
  });
});

describe('SC846 reference node — with metadata NVMe variant', () => {
  const d = deriveNode(SC846_WITH_METADATA, lib, defaults);

  it('counts 26 OSDs (24 HDD + 2 metadata NVMe)', () => {
    expect(d.osd_count).toBe(SC846_WITH_META_OSD_COUNT);
    expect(d.hdd_osd_count).toBe(24);
    expect(d.nvme_osd_count).toBe(2);
  });

  it('raw capacity adds the 2 × 7.68 TB metadata NVMe (591.36 TB total)', () => {
    expect(d.raw_capacity_bytes / 1e12).toBeCloseTo(SC846_HDD_RAW_TB + 2 * 7.68, 5);
    expect(d.nvme_raw_capacity_bytes / 1e12).toBeCloseTo(2 * 7.68, 5);
  });

  it('requires 104 GB RAM (26 × 4 GB/OSD)', () => {
    expect(d.ram_required_gb).toBe(RAM_REQUIRED_WITH_META_GB);
  });

  it('NVMe bay form-factor count is 8 (6 db_wal + 2 metadata)', () => {
    expect(d.drives_by_form_factor['u.3']).toBe(8);
  });
});

describe('Network bandwidth and OSD throughput accounting', () => {
  it('SC846 reference: 24 × 1.6 Gb/s HDD throughput = 38.4 Gb/s; dual 100 GbE = 200 Gb/s', () => {
    const d = deriveNode(SC846_HDD_ONLY, lib, defaults);
    expect(d.osd_throughput_gbps).toBeCloseTo(38.4, 5);
    expect(d.network_bandwidth_gbps).toBe(200);
  });

  it('metadata variant adds 2 × 28 Gb/s NVMe (94.4 total)', () => {
    const d = deriveNode(SC846_WITH_METADATA, lib, defaults);
    expect(d.osd_throughput_gbps).toBeCloseTo(38.4 + 56, 5);
  });

  it('db_wal drives do not contribute to OSD throughput (not OSDs)', () => {
    // SC846 HDD-only has 6 × 3.84 TB NVMe in db_wal role — if those counted as
    // OSDs, throughput would jump by 168 Gb/s. The fixture's number must stay
    // at 38.4 Gb/s.
    const d = deriveNode(SC846_HDD_ONLY, lib, defaults);
    expect(d.osd_throughput_gbps).toBeCloseTo(38.4, 5);
  });

  it('multiple NIC slots aggregate (3 × dual 100 GbE = 600 Gb/s)', () => {
    const node = {
      ...SC846_HDD_ONLY,
      nics: [{ component_id: 'nic-mellanox-cx5-100gbe', count: 3 }],
    };
    const d = deriveNode(node, lib, defaults);
    expect(d.network_bandwidth_gbps).toBe(600);
  });
});
