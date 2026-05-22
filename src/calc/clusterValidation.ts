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

  let domainCount = 0;
  switch (pool.failure_domain) {
    case 'host':
      domainCount = derived.total_host_count;
      break;
    case 'rack':
      domainCount = derived.total_rack_count;
      break;
    case 'osd':
      domainCount =
        pool.target_tier === 'hdd'
          ? derived.total_hdd_osd_count
          : pool.target_tier === 'nvme'
          ? derived.total_nvme_osd_count
          : derived.total_osd_count;
      break;
    case 'datacenter':
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
  _derived: ClusterDerived
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (cluster.pools.length > 0) {
    const totalShare = cluster.pools.reduce((s, p) => s + p.capacity_share, 0);
    if (Math.abs(totalShare - 1.0) > 0.001) {
      issues.push({
        severity: 'warning',
        code: 'cluster.capacity_share_not_one',
        scope: 'cluster',
        ref_id: cluster.id,
        message: `Pool capacity shares sum to ${totalShare.toFixed(3)} (expected 1.000)`,
      });
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
