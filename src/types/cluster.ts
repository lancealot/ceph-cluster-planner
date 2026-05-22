export type PoolType = 'replicated' | 'ec';
export type FailureDomain = 'osd' | 'host' | 'rack' | 'datacenter';
export type DeviceTier = 'hdd' | 'nvme' | 'ssd';

export interface PoolConfig {
  id: string;
  name: string;
  type: PoolType;
  replicas?: number;
  k?: number;
  m?: number;
  failure_domain: FailureDomain;
  capacity_share: number;
  target_tier?: DeviceTier;
}

export interface ClusterDefaults {
  nearfull_ratio: number;
  bluestore_overhead_pct: number;
  ram_per_osd_gb: number;
  lanes_per_slot: number;
}

export interface RackSlot {
  rack_config_id: string;
  count: number;
}

export interface ClusterConfig {
  id: string;
  name: string;
  racks: RackSlot[];
  pools: PoolConfig[];
  defaults: ClusterDefaults;
}
