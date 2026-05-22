import type { ClusterDefaults, ClusterConfig } from '../types/cluster';
import type { Workspace } from '../types/scenario';

export function defaultClusterDefaults(): ClusterDefaults {
  return {
    nearfull_ratio: 0.85,
    bluestore_overhead_pct: 0.01,
    ram_per_osd_gb: 4,
    lanes_per_slot: 8,
  };
}

export function emptyCluster(): ClusterConfig {
  return {
    id: 'cluster-default',
    name: 'My Cluster',
    racks: [],
    pools: [],
    defaults: defaultClusterDefaults(),
  };
}

export function emptyWorkspace(): Workspace {
  return {
    nodes: [],
    racks: [],
    cluster: emptyCluster(),
    custom_components: [],
    deleted_component_ids: [],
  };
}
