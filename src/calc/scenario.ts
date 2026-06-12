import type { Workspace, Scenario, ValidationIssue } from '../types/scenario';
import type { ComponentLibrary } from '../types/components';
import { scenarioSchema } from './scenarioSchema';
import { validateNode } from './validation';
import { deriveRack, validateRack } from './rack';
import { deriveCluster, type ClusterDerived } from './cluster';
import { validateCluster, validatePool } from './clusterValidation';
import { mergeLibrary } from './library';

export function serialize(workspace: Workspace, name: string): Scenario {
  return {
    schema_version: '1',
    id: `scenario-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    name,
    created_at: new Date().toISOString(),
    workspace,
  };
}

export class ScenarioImportError extends Error {
  constructor(message: string, readonly issues: { path: string; message: string }[]) {
    super(message);
    this.name = 'ScenarioImportError';
  }
}

export function deserialize(json: unknown): Scenario {
  const result = scenarioSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    throw new ScenarioImportError('Scenario JSON failed schema validation', issues);
  }
  return result.data as unknown as Scenario;
}

export interface ScenarioComputed {
  cluster: ClusterDerived;
  issues: ValidationIssue[];
}

export function computeForWorkspace(
  workspace: Workspace,
  library: ComponentLibrary
): ScenarioComputed {
  const defaults = workspace.cluster.defaults;
  const nodeMap = new Map(workspace.nodes.map((n) => [n.id, n]));
  const rackMap = new Map(workspace.racks.map((r) => [r.id, r]));

  const issues: ValidationIssue[] = [];
  for (const n of workspace.nodes) issues.push(...validateNode(n, library, defaults));
  for (const r of workspace.racks) {
    const d = deriveRack(r, nodeMap, library, defaults);
    issues.push(...validateRack(r, d));
  }
  const cluster = deriveCluster(workspace.cluster, rackMap, nodeMap, library);
  issues.push(...validateCluster(workspace.cluster, cluster));
  for (const pool of workspace.cluster.pools) {
    issues.push(...validatePool(workspace.cluster, pool, cluster));
  }
  return { cluster, issues };
}

export interface ScenarioDelta {
  cost_usd: number;
  power_typical_w: number;
  power_max_w: number;
  raw_capacity_bytes: number;
  usable_capacity_bytes: number;
  rack_count: number;
  node_count: number;
  osd_count: number;
}

export interface ScenarioDiff {
  base_name: string;
  compare_name: string;
  delta: ScenarioDelta;
  warnings_introduced: ValidationIssue[];
  warnings_resolved: ValidationIssue[];
}

function issueKey(i: ValidationIssue): string {
  return `${i.scope}:${i.ref_id}:${i.code}`;
}

export function diff(base: Scenario, compare: Scenario, _library?: ComponentLibrary): ScenarioDiff {
  // Each scenario is priced against its own embedded library snapshot so a
  // price override at save time is preserved on display and diff.
  const a = computeForWorkspace(base.workspace, mergeLibrary(base.workspace));
  const b = computeForWorkspace(compare.workspace, mergeLibrary(compare.workspace));
  const aKeys = new Set(a.issues.map(issueKey));
  const bKeys = new Set(b.issues.map(issueKey));
  return {
    base_name: base.name,
    compare_name: compare.name,
    delta: {
      cost_usd: b.cluster.total_cost_usd - a.cluster.total_cost_usd,
      power_typical_w: b.cluster.total_power_typical_w - a.cluster.total_power_typical_w,
      power_max_w: b.cluster.total_power_max_w - a.cluster.total_power_max_w,
      raw_capacity_bytes: b.cluster.total_raw_bytes - a.cluster.total_raw_bytes,
      usable_capacity_bytes: b.cluster.total_usable_bytes - a.cluster.total_usable_bytes,
      rack_count: b.cluster.total_rack_count - a.cluster.total_rack_count,
      node_count: b.cluster.total_node_count - a.cluster.total_node_count,
      osd_count: b.cluster.total_osd_count - a.cluster.total_osd_count,
    },
    warnings_introduced: b.issues.filter((i) => !aKeys.has(issueKey(i))),
    warnings_resolved: a.issues.filter((i) => !bKeys.has(issueKey(i))),
  };
}
