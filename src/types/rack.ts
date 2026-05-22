export interface RackNodeSlot {
  node_config_id: string;
  count: number;
}

export interface RackConfig {
  id: string;
  name: string;
  ru_capacity: number;
  power_capacity_w: number;
  nodes: RackNodeSlot[];
}
