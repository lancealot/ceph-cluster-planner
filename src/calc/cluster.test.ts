import { describe, expect, it } from 'vitest';
import type { ClusterConfig, PoolConfig } from '../types/cluster';
import type { RackConfig } from '../types/rack';
import { deriveCluster } from './cluster';
import { validateCluster, validatePool } from './clusterValidation';
import { bundledLibrary } from './test-helpers';
import { defaultClusterDefaults } from '../state/defaults';
import { SC846_HDD_ONLY } from './fixtures/sc846';

const EC_K = 8;
const EC_M = 3;
const EC_KM = EC_K + EC_M;
const BLUESTORE = 0.01;
const NEARFULL_PHASE3 = 0.75;
const REF_USABLE_PB_TARGET = 9.3;
const REF_USABLE_TOLERANCE = 0.005;

const lib = bundledLibrary();
const nodeMap = new Map([[SC846_HDD_ONLY.id, SC846_HDD_ONLY]]);

function rackOf(nodeCount: number, id = 'rack1'): RackConfig {
  return {
    id,
    name: id,
    ru_capacity: 1000,
    power_capacity_w: 1_000_000,
    nodes: [{ node_config_id: SC846_HDD_ONLY.id, count: nodeCount }],
  };
}

function ecPool(extra: Partial<PoolConfig> = {}): PoolConfig {
  return {
    id: 'data',
    name: 'EC data',
    type: 'ec',
    k: EC_K,
    m: EC_M,
    failure_domain: 'host',
    capacity_share: 1,
    target_tier: 'hdd',
    ...extra,
  };
}

describe('30 × SC846 EC 8+3 host-domain reference scenario', () => {
  const rack = rackOf(10);
  const cluster: ClusterConfig = {
    id: 'sc846-30',
    name: 'SC846 30-node reference',
    racks: [{ rack_config_id: rack.id, count: 3 }],
    pools: [ecPool()],
    defaults: {
      ...defaultClusterDefaults(),
      nearfull_ratio: NEARFULL_PHASE3,
      bluestore_overhead_pct: BLUESTORE,
    },
  };
  const derived = deriveCluster(cluster, new Map([[rack.id, rack]]), nodeMap, lib);

  it('total host count = 30', () => {
    expect(derived.total_host_count).toBe(30);
  });

  it('total HDD raw = 17.28 PB (30 × 576 TB)', () => {
    expect(derived.total_hdd_raw_bytes / 1e15).toBeCloseTo(17.28, 2);
  });

  it('pool usable ≈ 9.3 PB (within 0.5%)', () => {
    const usablePb = derived.pools[0].usable_bytes / 1e15;
    const drift = Math.abs(usablePb - REF_USABLE_PB_TARGET) / REF_USABLE_PB_TARGET;
    expect(drift).toBeLessThan(REF_USABLE_TOLERANCE);
  });

  it('cascade math: raw × 0.99 × 8/11 × 0.75', () => {
    const p = derived.pools[0];
    expect(p.raw_share_bytes).toBeCloseTo(17.28e15, -12);
    expect(p.after_bluestore_bytes / p.raw_share_bytes).toBeCloseTo(0.99, 5);
    expect(p.after_efficiency_bytes / p.after_bluestore_bytes).toBeCloseTo(EC_K / EC_KM, 5);
    expect(p.usable_bytes / p.after_efficiency_bytes).toBeCloseTo(NEARFULL_PHASE3, 5);
  });

  it('validation is clean (host count 30 ≥ 2×11)', () => {
    const issues = validatePool(cluster, cluster.pools[0], derived);
    expect(issues).toEqual([]);
  });
});

describe('Multi-pool composition', () => {
  const rack = rackOf(10);
  const cluster: ClusterConfig = {
    id: 'multi',
    name: 'multi',
    racks: [{ rack_config_id: rack.id, count: 3 }],
    pools: [
      { id: 'meta', name: 'metadata', type: 'replicated', replicas: 3, failure_domain: 'host', capacity_share: 0.05, target_tier: 'hdd' },
      ecPool({ capacity_share: 0.95 }),
    ],
    defaults: { ...defaultClusterDefaults(), nearfull_ratio: NEARFULL_PHASE3, bluestore_overhead_pct: BLUESTORE },
  };
  const derived = deriveCluster(cluster, new Map([[rack.id, rack]]), nodeMap, lib);

  it('shares sum to 1.0 (no warning)', () => {
    const issues = validateCluster(cluster, derived);
    expect(issues.find((i) => i.code === 'cluster.capacity_share_not_one')).toBeUndefined();
  });

  it('each pool gets its share of the same tier raw', () => {
    const totalRaw = derived.total_hdd_raw_bytes;
    expect(derived.pools[0].raw_share_bytes).toBeCloseTo(totalRaw * 0.05, -10);
    expect(derived.pools[1].raw_share_bytes).toBeCloseTo(totalRaw * 0.95, -10);
  });

  it('replicated pool efficiency is 1/3, EC is 8/11', () => {
    expect(derived.pools[0].efficiency).toBeCloseTo(1 / 3, 5);
    expect(derived.pools[1].efficiency).toBeCloseTo(EC_K / EC_KM, 5);
  });

  it('total usable = sum of per-pool usable', () => {
    const sum = derived.pools[0].usable_bytes + derived.pools[1].usable_bytes;
    expect(derived.total_usable_bytes).toBeCloseTo(sum, 0);
  });
});

describe('Shares not summing to 1.0 fires cluster warning', () => {
  it('warns when sum > 1.0', () => {
    const rack = rackOf(10);
    const cluster: ClusterConfig = {
      id: 'c',
      name: 'c',
      racks: [{ rack_config_id: rack.id, count: 1 }],
      pools: [
        ecPool({ id: 'a', capacity_share: 0.6 }),
        ecPool({ id: 'b', capacity_share: 0.6 }),
      ],
      defaults: defaultClusterDefaults(),
    };
    const derived = deriveCluster(cluster, new Map([[rack.id, rack]]), nodeMap, lib);
    const issues = validateCluster(cluster, derived);
    const w = issues.find((i) => i.code === 'cluster.capacity_share_not_one');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
  });
});

describe('EC 8+3 failure-domain edge cases (host)', () => {
  function makeCluster(hostCount: number) {
    const rack = rackOf(hostCount, 'r');
    const cluster: ClusterConfig = {
      id: 'fd',
      name: 'fd',
      racks: [{ rack_config_id: rack.id, count: 1 }],
      pools: [ecPool()],
      defaults: defaultClusterDefaults(),
    };
    const derived = deriveCluster(cluster, new Map([[rack.id, rack]]), nodeMap, lib);
    const issues = validatePool(cluster, cluster.pools[0], derived);
    return { cluster, derived, issues };
  }

  it('10 hosts → error (count < k+m)', () => {
    const { derived, issues } = makeCluster(10);
    expect(derived.total_host_count).toBe(10);
    const e = issues.find((i) => i.code === 'pool.failure_domain_too_few');
    expect(e).toBeDefined();
    expect(e?.severity).toBe('error');
  });

  it('11 hosts → warning (count == k+m, no recovery headroom)', () => {
    const { derived, issues } = makeCluster(EC_KM);
    expect(derived.total_host_count).toBe(EC_KM);
    expect(issues.find((i) => i.code === 'pool.failure_domain_too_few')).toBeUndefined();
    const w = issues.find((i) => i.code === 'pool.failure_domain_tight');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
  });

  it('22 hosts → no warnings (count ≥ 2×(k+m))', () => {
    const { derived, issues } = makeCluster(2 * EC_KM);
    expect(derived.total_host_count).toBe(2 * EC_KM);
    expect(issues).toEqual([]);
  });
});

describe('Rack failure-domain validation', () => {
  it('3 racks vs EC 8+3 → error (3 < 11)', () => {
    const rack = rackOf(10, 'r');
    const cluster: ClusterConfig = {
      id: 'fd',
      name: 'fd',
      racks: [{ rack_config_id: rack.id, count: 3 }],
      pools: [ecPool({ failure_domain: 'rack' })],
      defaults: defaultClusterDefaults(),
    };
    const derived = deriveCluster(cluster, new Map([[rack.id, rack]]), nodeMap, lib);
    const issues = validatePool(cluster, cluster.pools[0], derived);
    const e = issues.find((i) => i.code === 'pool.failure_domain_too_few');
    expect(e).toBeDefined();
  });
});

describe('Nearfull and BlueStore bounds validation', () => {
  it('rejects nearfull > 1', () => {
    const rack = rackOf(10);
    const cluster: ClusterConfig = {
      id: 'c',
      name: 'c',
      racks: [{ rack_config_id: rack.id, count: 1 }],
      pools: [],
      defaults: { ...defaultClusterDefaults(), nearfull_ratio: 1.5 },
    };
    const derived = deriveCluster(cluster, new Map([[rack.id, rack]]), nodeMap, lib);
    const e = validateCluster(cluster, derived).find((i) => i.code === 'cluster.nearfull_out_of_bounds');
    expect(e).toBeDefined();
    expect(e?.severity).toBe('error');
  });
});
