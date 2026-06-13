import type { ClusterConfig, PoolConfig } from '../types/cluster';
import type { ValidationIssue } from '../types/scenario';
import { poolEfficiency, type ClusterDerived } from './cluster';

export function validatePool(
  _cluster: ClusterConfig,
  pool: PoolConfig,
  derived: ClusterDerived
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { effective_size } = poolEfficiency(pool);

  // 'nvme' and 'ssd' both name the flash bucket — deriveNode classifies every
  // non-HDD storage drive into nvme_osd_count, so 'ssd' counts the same OSDs
  // and rawForTier in cluster.ts does the same.
  let domainCount = 0;
  switch (pool.failure_domain) {
    case 'host':
      // Only hosts that contribute OSDs of this pool's tier can take its PGs.
      domainCount = !pool.target_tier
        ? derived.total_host_count
        : pool.target_tier === 'hdd'
        ? derived.total_hdd_host_count
        : derived.total_nvme_host_count;
      break;
    case 'rack':
      domainCount = derived.total_rack_count;
      break;
    case 'osd':
      domainCount = !pool.target_tier
        ? derived.total_osd_count
        : pool.target_tier === 'hdd'
        ? derived.total_hdd_osd_count
        : derived.total_nvme_osd_count;
      break;
    case 'datacenter':
      // Datacenter grouping isn't modeled yet — every cluster is treated as
      // one DC. The dropdown no longer offers this; back-compat for older
      // scenarios surfaces the failure as the count being 1.
      domainCount = 1;
      break;
  }

  if (domainCount < effective_size) {
    issues.push({
      severity: 'error',
      code: 'pool.failure_domain_too_few',
      scope: 'pool',
      ref_id: pool.id,
      message: `${domainCount} ${pool.failure_domain}(s) available, pool requires at least ${effective_size}`,
    });
  } else if (domainCount < 2 * effective_size) {
    issues.push({
      severity: 'warning',
      code: 'pool.failure_domain_tight',
      scope: 'pool',
      ref_id: pool.id,
      message: `${domainCount} ${pool.failure_domain}(s) available, ≥ ${2 * effective_size} recommended for recovery headroom`,
    });
  }

  if (pool.capacity_share < 0 || pool.capacity_share > 1) {
    issues.push({
      severity: 'error',
      code: 'pool.invalid_share',
      scope: 'pool',
      ref_id: pool.id,
      message: `capacity_share ${pool.capacity_share} outside [0, 1]`,
    });
  }

  return issues;
}

export function validateCluster(
  cluster: ClusterConfig,
  derived: ClusterDerived
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Shares are budgets per raw-byte source, mirroring rawForTier in cluster.ts:
  // 'hdd' and 'nvme'/'ssd' tiers each draw from their own raw pool, so each is
  // its own 100% budget. Untiered pools draw from total raw — bytes that live
  // on every tier — so their share counts toward each tier's budget.
  if (cluster.pools.length > 0) {
    let hddShare = 0;
    let flashShare = 0;
    let untieredShare = 0;
    let hasHdd = false;
    let hasFlash = false;
    for (const p of cluster.pools) {
      if (!p.target_tier) {
        untieredShare += p.capacity_share;
      } else if (p.target_tier === 'hdd') {
        hddShare += p.capacity_share;
        hasHdd = true;
      } else {
        flashShare += p.capacity_share;
        hasFlash = true;
      }
    }

    const checks: Array<{ label: string; sum: number }> = [];
    if (!hasHdd && !hasFlash) {
      checks.push({ label: 'Pool', sum: untieredShare });
    } else {
      if (hasHdd || (untieredShare > 0 && derived.total_hdd_raw_bytes > 0)) {
        checks.push({ label: 'hdd-tier pool', sum: hddShare + untieredShare });
      }
      if (hasFlash || (untieredShare > 0 && derived.total_nvme_raw_bytes > 0)) {
        checks.push({ label: 'nvme/ssd-tier pool', sum: flashShare + untieredShare });
      }
    }

    for (const c of checks) {
      if (Math.abs(c.sum - 1.0) > 0.001) {
        const untieredNote =
          untieredShare > 0 ? `; untiered pools count toward every tier` : '';
        issues.push({
          severity: 'warning',
          code: 'cluster.capacity_share_not_one',
          scope: 'cluster',
          ref_id: cluster.id,
          message: `${c.label} capacity shares sum to ${c.sum.toFixed(3)} (expected 1.000${untieredNote})`,
        });
      }
    }
  }

  const nf = cluster.defaults.nearfull_ratio;
  if (nf <= 0 || nf >= 1) {
    issues.push({
      severity: 'error',
      code: 'cluster.nearfull_out_of_bounds',
      scope: 'cluster',
      ref_id: cluster.id,
      message: `nearfull_ratio ${nf} must be in (0, 1)`,
    });
  }

  const bo = cluster.defaults.bluestore_overhead_pct;
  if (bo < 0 || bo >= 1) {
    issues.push({
      severity: 'error',
      code: 'cluster.bluestore_out_of_bounds',
      scope: 'cluster',
      ref_id: cluster.id,
      message: `bluestore_overhead_pct ${bo} must be in [0, 1)`,
    });
  }

  return issues;
}
