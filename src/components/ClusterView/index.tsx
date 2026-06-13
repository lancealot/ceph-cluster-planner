import { useMemo } from 'react';
import { useWorkspace } from '../../state/workspace';
import { useLibrary } from '../../state/useLibrary';
import { useClusterOutputs } from '../../state/useClusterOutputs';
import { deriveCluster, poolEfficiency } from '../../calc/cluster';
import { validateCluster, validatePool } from '../../calc/clusterValidation';
import { deriveRack } from '../../calc/rack';
import { format_bytes as fmtCap } from '../../calc/units';
import { Panel, Field } from '../Shell/primitives';
import { BigWaterfall } from './BigWaterfall';
import { WarningsList } from '../Common/WarningsList';
import type { ClusterConfig, FailureDomain, PoolConfig, PoolType, DeviceTier } from '../../types/cluster';

const POOL_TYPES: PoolType[] = ['replicated', 'ec'];
// 'datacenter' stays in the schema for back-compat but isn't offered as a
// choice — DC grouping above the rack level isn't modeled yet.
const FAILURE_DOMAINS: FailureDomain[] = ['osd', 'host', 'rack'];
// 'ssd' is accepted by the schema for backward-compat and treated identically
// to 'nvme' (deriveNode lumps every non-HDD drive into the flash bucket); only
// these two are offered going forward.
const TIERS: DeviceTier[] = ['hdd', 'nvme'];

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
  const outputs = useClusterOutputs();
  const cluster = workspace.cluster;

  const rackMap = useMemo(() => new Map(workspace.racks.map((r) => [r.id, r])), [workspace.racks]);
  const nodeMap = useMemo(() => new Map(workspace.nodes.map((n) => [n.id, n])), [workspace.nodes]);
  const derived = useMemo(() => deriveCluster(cluster, rackMap, nodeMap, library), [cluster, rackMap, nodeMap, library]);

  const issues = useMemo(() => {
    const all = validateCluster(cluster, derived);
    for (const pool of cluster.pools) all.push(...validatePool(cluster, pool, derived));
    return all;
  }, [cluster, derived]);

  const rackRollup = useMemo(() => {
    let totalU = 0;
    let totalKw = 0;
    let totalRacks = 0;
    let totalNodes = 0;
    for (const slot of cluster.racks) {
      const rack = rackMap.get(slot.rack_config_id);
      if (!rack) continue;
      const rd = deriveRack(rack, nodeMap, library, cluster.defaults);
      totalU += rd.ru_used * slot.count;
      totalKw += (rd.power_typical_w / 1000) * slot.count;
      totalRacks += slot.count;
      totalNodes += rd.node_count * slot.count;
    }
    return { totalU, totalKw, totalRacks, totalNodes };
  }, [cluster, rackMap, nodeMap, library]);

  function updateDefaults(patch: Partial<ClusterConfig['defaults']>) {
    updateCluster({ ...cluster, defaults: { ...cluster.defaults, ...patch } });
  }
  function setRackCount(rackId: string, count: number) {
    const existing = cluster.racks.find((r) => r.rack_config_id === rackId);
    if (count <= 0) {
      updateCluster({ ...cluster, racks: cluster.racks.filter((r) => r.rack_config_id !== rackId) });
    } else if (existing) {
      updateCluster({ ...cluster, racks: cluster.racks.map((r) => (r.rack_config_id === rackId ? { ...r, count } : r)) });
    } else {
      updateCluster({ ...cluster, racks: [...cluster.racks, { rack_config_id: rackId, count }] });
    }
  }
  function updatePool(idx: number, patch: Partial<PoolConfig>) {
    updateCluster({ ...cluster, pools: cluster.pools.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  }
  function addPool() {
    updateCluster({ ...cluster, pools: [...cluster.pools, newPool()] });
  }
  function removePool(idx: number) {
    updateCluster({ ...cluster, pools: cluster.pools.filter((_, i) => i !== idx) });
  }

  return (
    <div className="screen">
      <div className="screen-inner stack">
        <div className="row">
          <div className="field w-300">
            <span className="microlabel">Cluster name</span>
            <input className="inp" value={cluster.name} onChange={(e) => updateCluster({ ...cluster, name: e.target.value })} />
          </div>
          <span className="grow" />
          <button className="btn" type="button" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>

        <Panel title="Capacity cascade — raw to usable">
          <BigWaterfall rows={outputs.waterfall} />
        </Panel>

        <div className="cols c2">
          <Panel title="Cluster defaults">
            <div className="cols c2 gap-10">
              <Field label="nearfull_ratio">
                <input className="inp mono" type="number" step={0.01} min={0} max={1} value={cluster.defaults.nearfull_ratio} onChange={(e) => updateDefaults({ nearfull_ratio: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Field label="bluestore_overhead_pct">
                <input className="inp mono" type="number" step={0.005} min={0} max={1} value={cluster.defaults.bluestore_overhead_pct} onChange={(e) => updateDefaults({ bluestore_overhead_pct: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Field label="ram_per_osd_gb">
                <input className="inp mono" type="number" min={0} step={0.5} value={cluster.defaults.ram_per_osd_gb} onChange={(e) => updateDefaults({ ram_per_osd_gb: parseFloat(e.target.value) || 0 })} />
              </Field>
              <Field label="lanes_per_slot">
                <input className="inp mono" type="number" min={1} value={cluster.defaults.lanes_per_slot} onChange={(e) => updateDefaults({ lanes_per_slot: parseInt(e.target.value) || 1 })} />
              </Field>
            </div>
          </Panel>

          <Panel title="Racks in cluster">
            <div className="stack-sm">
              {workspace.racks.length === 0 ? (
                <span className="counts">Build racks on the Racks tab first.</span>
              ) : (
                workspace.racks.map((r) => {
                  const slot = cluster.racks.find((s) => s.rack_config_id === r.id);
                  return (
                    <div className="slotrow card" key={r.id}>
                      <span className="slot-name">{r.name}</span>
                      <input className="inp mono" type="number" min={0} value={slot?.count ?? 0} onChange={(e) => setRackCount(r.id, parseInt(e.target.value) || 0)} />
                      <span className="counts">×</span>
                    </div>
                  );
                })
              )}
              {rackRollup.totalRacks > 0 ? (
                <div className="counts">
                  {rackRollup.totalRacks} racks · {rackRollup.totalNodes} nodes · {rackRollup.totalU}U · {rackRollup.totalKw.toFixed(2)} kW typical
                </div>
              ) : null}
            </div>
          </Panel>
        </div>

        <Panel
          title="Pools"
          right={<button className="btn prime sm" type="button" onClick={addPool}>+ Add pool</button>}
        >
          {cluster.pools.length === 0 ? (
            <p className="note">No pools defined yet.</p>
          ) : (
            <div className="stack-sm">
              {cluster.pools.map((pool, idx) => {
                const { efficiency } = poolEfficiency(pool);
                const pd = derived.pools.find((x) => x.pool_id === pool.id);
                return (
                  <div className="poolcard" key={pool.id}>
                    <div className="pool-hd">
                      <input
                        className="inp mono name-input"
                        value={pool.name}
                        onChange={(e) => updatePool(idx, { name: e.target.value })}
                      />
                      <span className="tag">
                        {pool.type === 'ec' ? `EC ${pool.k ?? 8}+${pool.m ?? 3}` : `×${pool.replicas ?? 3} replica`}
                      </span>
                      <span className="tag muted">domain: {pool.failure_domain}</span>
                      {pool.target_tier ? <span className="tag muted">tier: {pool.target_tier}</span> : null}
                      <span className="counts">
                        efficiency {(efficiency * 100).toFixed(1)}%{pd ? ` → ${fmtCap(pd.usable_bytes)}` : ''}
                      </span>
                      <button className="btn sm danger" type="button" onClick={() => removePool(idx)}>Remove</button>
                    </div>
                    <div className="row wrap gap-14">
                      <div className="w-110">
                        <Field label="Type">
                          <select
                            className="sel"
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
                          >
                            {POOL_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                          </select>
                        </Field>
                      </div>
                      {pool.type === 'ec' ? (
                        <>
                          <div className="w-90">
                            <Field label="k">
                              <input className="inp mono" type="number" min={1} value={pool.k ?? 8} onChange={(e) => updatePool(idx, { k: parseInt(e.target.value) || 1 })} />
                            </Field>
                          </div>
                          <div className="w-90">
                            <Field label="m">
                              <input className="inp mono" type="number" min={1} value={pool.m ?? 3} onChange={(e) => updatePool(idx, { m: parseInt(e.target.value) || 1 })} />
                            </Field>
                          </div>
                        </>
                      ) : (
                        <div className="w-110">
                          <Field label="replicas">
                            <input className="inp mono" type="number" min={1} value={pool.replicas ?? 3} onChange={(e) => updatePool(idx, { replicas: parseInt(e.target.value) || 1 })} />
                          </Field>
                        </div>
                      )}
                      <div className="w-130">
                        <Field label="Failure domain">
                          <select className="sel" value={pool.failure_domain} onChange={(e) => updatePool(idx, { failure_domain: e.target.value as FailureDomain })}>
                            {FAILURE_DOMAINS.map((d) => (<option key={d} value={d}>{d}</option>))}
                          </select>
                        </Field>
                      </div>
                      <div className="w-110">
                        <Field label="Tier">
                          <select
                            className="sel"
                            value={pool.target_tier ?? ''}
                            onChange={(e) => updatePool(idx, { target_tier: (e.target.value || undefined) as DeviceTier | undefined })}
                          >
                            <option value="">any</option>
                            {TIERS.map((t) => (<option key={t} value={t}>{t}</option>))}
                          </select>
                        </Field>
                      </div>
                      <div className="grow min-w-200">
                        <Field label={`capacity share — ${(pool.capacity_share * 100).toFixed(1)}%`}>
                          <input type="range" min={0} max={1} step={0.01} value={pool.capacity_share} onChange={(e) => updatePool(idx, { capacity_share: parseFloat(e.target.value) })} />
                        </Field>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Cluster + pool validation">
          <WarningsList issues={issues} empty="No cluster-scope issues." />
        </Panel>
      </div>
    </div>
  );
}
