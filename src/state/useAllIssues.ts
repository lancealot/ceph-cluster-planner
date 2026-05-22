import { useMemo } from 'react';
import { useWorkspace } from './workspace';
import { useLibrary } from './useLibrary';
import { validateNode } from '../calc/validation';
import { deriveRack, validateRack } from '../calc/rack';
import { deriveCluster } from '../calc/cluster';
import { validateCluster, validatePool } from '../calc/clusterValidation';
import type { ValidationIssue } from '../types/scenario';

export function useAllIssues(): ValidationIssue[] {
  const { workspace } = useWorkspace();
  const library = useLibrary();
  return useMemo(() => {
    const defaults = workspace.cluster.defaults;
    const nodeMap = new Map(workspace.nodes.map((n) => [n.id, n]));
    const rackMap = new Map(workspace.racks.map((r) => [r.id, r]));
    const issues: ValidationIssue[] = [];
    for (const n of workspace.nodes) issues.push(...validateNode(n, library, defaults));
    for (const r of workspace.racks) {
      const d = deriveRack(r, nodeMap, library, defaults);
      issues.push(...validateRack(r, d));
    }
    const cd = deriveCluster(workspace.cluster, rackMap, nodeMap, library);
    issues.push(...validateCluster(workspace.cluster, cd));
    for (const pool of workspace.cluster.pools) {
      issues.push(...validatePool(workspace.cluster, pool, cd));
    }
    return issues;
  }, [workspace, library]);
}
