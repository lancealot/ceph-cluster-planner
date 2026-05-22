import type { Scenario, Workspace } from '../types/scenario';
import { SC846_HDD_ONLY } from '../calc/fixtures/sc846';
import { defaultClusterDefaults } from '../state/defaults';

export function buildSc846ReferenceScenario(): Scenario {
  const rack = {
    id: 'rack-sc846-10x',
    name: 'Reference rack (10 × SC846)',
    ru_capacity: 42,
    power_capacity_w: 12000,
    nodes: [{ node_config_id: SC846_HDD_ONLY.id, count: 10 }],
  };

  const workspace: Workspace = {
    nodes: [SC846_HDD_ONLY],
    racks: [rack],
    cluster: {
      id: 'sc846-30node',
      name: '30 × SC846 reference',
      racks: [{ rack_config_id: rack.id, count: 3 }],
      pools: [
        {
          id: 'pool-data',
          name: 'EC 8+3 data',
          type: 'ec',
          k: 8,
          m: 3,
          failure_domain: 'host',
          capacity_share: 1,
          target_tier: 'hdd',
        },
      ],
      defaults: {
        ...defaultClusterDefaults(),
        nearfull_ratio: 0.75,
        bluestore_overhead_pct: 0.01,
      },
    },
    custom_components: [],
    deleted_component_ids: [],
  };

  return {
    schema_version: '1',
    id: 'scenario-sc846-reference',
    name: 'SC846 30-node reference',
    created_at: new Date(0).toISOString(),
    workspace,
  };
}
