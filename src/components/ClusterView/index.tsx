import { useMemo } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useLibrary } from '../../state/useLibrary';
import { deriveCluster } from '../../calc/cluster';
import { validateCluster, validatePool } from '../../calc/clusterValidation';
import { OutputsPanel } from './OutputsPanel';
import { CapacityWaterfall } from './CapacityWaterfall';
import { WarningsList } from '../Common/WarningsList';
import type { ClusterConfig, FailureDomain, PoolConfig, PoolType, DeviceTier } from '../../types/cluster';

const POOL_TYPES: PoolType[] = ['replicated', 'ec'];
const FAILURE_DOMAINS: FailureDomain[] = ['osd', 'host', 'rack', 'datacenter'];
const TIERS: DeviceTier[] = ['hdd', 'nvme', 'ssd'];

function newPool(): PoolConfig {
  return {
    id: `pool-${Date.now().toString(36)}`,
    name: 'New pool',
    type: 'ec',
    k: 8,
    m: 3,
    failure_domain: 'host',
    capacity_share: 1,
    target_tier: 'hdd',
  };
}

export function ClusterView() {
  const { workspace, updateCluster } = useWorkspace();
  const library = useLibrary();
  const { cluster } = workspace;

  const rackMap = useMemo(() => new Map(workspace.racks.map((r) => [r.id, r])), [workspace.racks]);
  const nodeMap = useMemo(() => new Map(workspace.nodes.map((n) => [n.id, n])), [workspace.nodes]);

  const derived = useMemo(
    () => deriveCluster(cluster, rackMap, nodeMap, library),
    [cluster, rackMap, nodeMap, library]
  );

  const issues = useMemo(() => {
    const all = validateCluster(cluster, derived);
    for (const pool of cluster.pools) {
      all.push(...validatePool(cluster, pool, derived));
    }
    return all;
  }, [cluster, derived]);

  function updateDefaults(patch: Partial<ClusterConfig['defaults']>) {
    updateCluster({ ...cluster, defaults: { ...cluster.defaults, ...patch } });
  }
  function updateName(name: string) {
    updateCluster({ ...cluster, name });
  }
  function updatePool(idx: number, patch: Partial<PoolConfig>) {
    updateCluster({
      ...cluster,
      pools: cluster.pools.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });
  }
  function addPool() {
    updateCluster({ ...cluster, pools: [...cluster.pools, newPool()] });
  }
  function removePool(idx: number) {
    updateCluster({ ...cluster, pools: cluster.pools.filter((_, i) => i !== idx) });
  }
  function setRackCount(rackId: string, count: number) {
    const existing = cluster.racks.find((r) => r.rack_config_id === rackId);
    if (count <= 0) {
      updateCluster({ ...cluster, racks: cluster.racks.filter((r) => r.rack_config_id !== rackId) });
    } else if (existing) {
      updateCluster({
        ...cluster,
        racks: cluster.racks.map((r) => (r.rack_config_id === rackId ? { ...r, count } : r)),
      });
    } else {
      updateCluster({ ...cluster, racks: [...cluster.racks, { rack_config_id: rackId, count }] });
    }
  }

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cluster name</label>
          <input
            value={cluster.name}
            onChange={(e) => updateName(e.target.value)}
            className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
          />
        </div>
        <button
          onClick={() => window.print()}
          className="px-3 py-1 text-sm bg-slate-200 dark:bg-slate-700 rounded h-fit"
          title="Print or save the cluster summary as PDF"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 space-y-3">
          <h4 className="text-sm font-semibold">Cluster defaults</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400">nearfull_ratio</div>
              <input
                type="number"
                step={0.01}
                min={0}
                max={1}
                value={cluster.defaults.nearfull_ratio}
                onChange={(e) => updateDefaults({ nearfull_ratio: parseFloat(e.target.value) || 0 })}
                className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400">bluestore_overhead_pct</div>
              <input
                type="number"
                step={0.005}
                min={0}
                max={1}
                value={cluster.defaults.bluestore_overhead_pct}
                onChange={(e) =>
                  updateDefaults({ bluestore_overhead_pct: parseFloat(e.target.value) || 0 })
                }
                className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400">ram_per_osd_gb</div>
              <input
                type="number"
                min={0}
                step={0.5}
                value={cluster.defaults.ram_per_osd_gb}
                onChange={(e) => updateDefaults({ ram_per_osd_gb: parseFloat(e.target.value) || 0 })}
                className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs text-slate-500 dark:text-slate-400">lanes_per_slot</div>
              <input
                type="number"
                min={1}
                value={cluster.defaults.lanes_per_slot}
                onChange={(e) => updateDefaults({ lanes_per_slot: parseInt(e.target.value) || 1 })}
                className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
              />
            </label>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 space-y-3">
          <h4 className="text-sm font-semibold">Racks in cluster</h4>
          {workspace.racks.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Build racks on the Racks tab first.</p>
          ) : (
            workspace.racks.map((r) => {
              const slot = cluster.racks.find((s) => s.rack_config_id === r.id);
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{r.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={slot?.count ?? 0}
                    onChange={(e) => setRackCount(r.id, parseInt(e.target.value) || 0)}
                    className="border rounded px-2 py-1 text-sm w-20 bg-white dark:bg-slate-800"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right">× count</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Pools</h4>
          <button onClick={addPool} className="text-sm px-2 py-1 bg-slate-900 text-white rounded">
            + Add pool
          </button>
        </div>
        {cluster.pools.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">No pools defined yet.</p>
        ) : (
          cluster.pools.map((pool, idx) => (
            <div key={pool.id} className="border border-slate-200 dark:border-slate-700 rounded p-2 grid grid-cols-7 gap-2 items-end">
              <label className="text-xs col-span-2">
                <div className="text-slate-500 dark:text-slate-400">Name</div>
                <input
                  value={pool.name}
                  onChange={(e) => updatePool(idx, { name: e.target.value })}
                  className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                />
              </label>
              <label className="text-xs">
                <div className="text-slate-500 dark:text-slate-400">Type</div>
                <select
                  value={pool.type}
                  onChange={(e) => {
                    const newType = e.target.value as PoolType;
                    updatePool(
                      idx,
                      newType === 'replicated'
                        ? { type: newType, replicas: pool.replicas ?? 3 }
                        : { type: newType, k: pool.k ?? 8, m: pool.m ?? 3 }
                    );
                  }}
                  className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                >
                  {POOL_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {pool.type === 'ec' ? (
                <>
                  <label className="text-xs">
                    <div className="text-slate-500 dark:text-slate-400">k</div>
                    <input
                      type="number"
                      min={1}
                      value={pool.k ?? 8}
                      onChange={(e) => updatePool(idx, { k: parseInt(e.target.value) || 1 })}
                      className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                    />
                  </label>
                  <label className="text-xs">
                    <div className="text-slate-500 dark:text-slate-400">m</div>
                    <input
                      type="number"
                      min={1}
                      value={pool.m ?? 3}
                      onChange={(e) => updatePool(idx, { m: parseInt(e.target.value) || 1 })}
                      className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                    />
                  </label>
                </>
              ) : (
                <label className="text-xs col-span-2">
                  <div className="text-slate-500 dark:text-slate-400">replicas</div>
                  <input
                    type="number"
                    min={1}
                    value={pool.replicas ?? 3}
                    onChange={(e) => updatePool(idx, { replicas: parseInt(e.target.value) || 1 })}
                    className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                  />
                </label>
              )}
              <label className="text-xs">
                <div className="text-slate-500 dark:text-slate-400">Failure domain</div>
                <select
                  value={pool.failure_domain}
                  onChange={(e) => updatePool(idx, { failure_domain: e.target.value as FailureDomain })}
                  className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                >
                  {FAILURE_DOMAINS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <div className="text-slate-500 dark:text-slate-400">Tier</div>
                <select
                  value={pool.target_tier ?? ''}
                  onChange={(e) =>
                    updatePool(idx, { target_tier: (e.target.value || undefined) as DeviceTier | undefined })
                  }
                  className="border rounded px-2 py-1 text-sm w-full bg-white dark:bg-slate-800"
                >
                  <option value="">any</option>
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs col-span-6">
                <div className="text-slate-500 dark:text-slate-400">capacity_share ({(pool.capacity_share * 100).toFixed(1)}%)</div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={pool.capacity_share}
                  onChange={(e) => updatePool(idx, { capacity_share: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </label>
              <button
                onClick={() => removePool(idx)}
                className="text-xs px-2 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 rounded h-fit"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <OutputsPanel derived={derived} pools={cluster.pools} />
      <CapacityWaterfall derived={derived} pools={cluster.pools} />

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded p-3">
        <h4 className="text-sm font-semibold mb-2">Cluster + pool validation</h4>
        <WarningsList issues={issues} empty="No cluster-scope issues." />
      </div>
    </div>
  );
}
