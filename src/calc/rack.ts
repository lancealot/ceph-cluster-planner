import type { NodeConfig } from '../types/node';
import type { RackConfig } from '../types/rack';
import type { ClusterDefaults } from '../types/cluster';
import type { ComponentLibrary } from '../types/components';
import type { ValidationIssue } from '../types/scenario';
import { deriveNode, type NodeDerived } from './node';

export type BindingConstraint = 'ru' | 'power' | 'none';

export interface RackDerived {
  ru_used: number;
  ru_capacity: number;
  power_typical_w: number;
  power_max_w: number;
  power_capacity_w: number;
  cost_usd: number;
  node_count: number;
  total_osd_count: number;
  total_raw_bytes: number;
  binding_constraint: BindingConstraint;
  available_headroom_units: number;
}

export function deriveRack(
  rack: RackConfig,
  nodeMap: Map<string, NodeConfig>,
  library: ComponentLibrary,
  defaults: ClusterDefaults
): RackDerived {
  let ruUsed = 0;
  let powerTyp = 0;
  let powerMax = 0;
  let cost = 0;
  let nodeCount = 0;
  let osdCount = 0;
  let rawBytes = 0;

  const derivedByNodeId = new Map<string, NodeDerived>();

  for (const slot of rack.nodes) {
    const node = nodeMap.get(slot.node_config_id);
    if (!node) continue;
    let d = derivedByNodeId.get(node.id);
    if (!d) {
      d = deriveNode(node, library, defaults);
      derivedByNodeId.set(node.id, d);
    }
    ruUsed += d.chassis_ru * slot.count;
    powerTyp += d.power_typical_w * slot.count;
    powerMax += d.power_max_w * slot.count;
    cost += d.cost_usd * slot.count;
    nodeCount += slot.count;
    osdCount += d.osd_count * slot.count;
    rawBytes += d.raw_capacity_bytes * slot.count;
  }

  let binding: BindingConstraint = 'none';
  let headroom = 0;
  if (rack.nodes.length > 0) {
    const sorted = [...rack.nodes].sort((a, b) => b.count - a.count);
    const top = sorted[0];
    const d = derivedByNodeId.get(top.node_config_id);
    if (d) {
      const ruRem = rack.ru_capacity - ruUsed;
      const powRem = rack.power_capacity_w - powerMax;
      const ruRoom = d.chassis_ru > 0 ? Math.floor(ruRem / d.chassis_ru) : Infinity;
      const powRoom = d.power_max_w > 0 ? Math.floor(powRem / d.power_max_w) : Infinity;
      headroom = Math.max(0, Math.min(ruRoom, powRoom));
      if (ruRoom === Infinity && powRoom === Infinity) {
        binding = 'none';
      } else {
        binding = ruRoom <= powRoom ? 'ru' : 'power';
      }
    }
  }

  return {
    ru_used: ruUsed,
    ru_capacity: rack.ru_capacity,
    power_typical_w: powerTyp,
    power_max_w: powerMax,
    power_capacity_w: rack.power_capacity_w,
    cost_usd: cost,
    node_count: nodeCount,
    total_osd_count: osdCount,
    total_raw_bytes: rawBytes,
    binding_constraint: binding,
    available_headroom_units: headroom,
  };
}

export function validateRack(rack: RackConfig, derived: RackDerived): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (derived.ru_used > derived.ru_capacity) {
    issues.push({
      severity: 'error',
      code: 'rack.over_ru',
      scope: 'rack',
      ref_id: rack.id,
      message: `RU used ${derived.ru_used} > capacity ${derived.ru_capacity}`,
    });
  }
  if (derived.power_max_w > derived.power_capacity_w) {
    issues.push({
      severity: 'error',
      code: 'rack.over_power',
      scope: 'rack',
      ref_id: rack.id,
      message: `Max power ${derived.power_max_w} W > capacity ${derived.power_capacity_w} W`,
    });
  }
  return issues;
}
