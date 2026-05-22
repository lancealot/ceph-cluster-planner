import type { Component } from './components';
import type { NodeConfig } from './node';
import type { RackConfig } from './rack';
import type { ClusterConfig } from './cluster';

export interface Workspace {
  nodes: NodeConfig[];
  racks: RackConfig[];
  cluster: ClusterConfig;
  custom_components: Component[];
  deleted_component_ids: string[];
}

export interface Scenario {
  schema_version: '1';
  id: string;
  name: string;
  created_at: string;
  workspace: Workspace;
}

export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationScope = 'node' | 'rack' | 'cluster' | 'pool';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  scope: ValidationScope;
  ref_id: string;
  message: string;
}
