import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Workspace } from '../types/scenario';
import type { NodeConfig } from '../types/node';
import type { RackConfig } from '../types/rack';
import type { ClusterConfig } from '../types/cluster';
import type { Component } from '../types/components';
import { emptyWorkspace } from './defaults';

const STORAGE_KEY = 'ccp.v1.workspace';

export type WorkspaceAction =
  | { type: 'replace_workspace'; workspace: Workspace }
  | { type: 'reset' }
  | { type: 'upsert_node'; node: NodeConfig }
  | { type: 'delete_node'; id: string }
  | { type: 'upsert_rack'; rack: RackConfig }
  | { type: 'delete_rack'; id: string }
  | { type: 'update_cluster'; cluster: ClusterConfig }
  | { type: 'upsert_custom_component'; component: Component }
  | { type: 'delete_component'; id: string; isBundled: boolean }
  | { type: 'restore_component'; id: string };

function reducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'replace_workspace':
      return action.workspace;
    case 'reset':
      return emptyWorkspace();
    case 'upsert_node': {
      const idx = state.nodes.findIndex((n) => n.id === action.node.id);
      const nodes = idx >= 0 ? state.nodes.map((n, i) => (i === idx ? action.node : n)) : [...state.nodes, action.node];
      return { ...state, nodes };
    }
    case 'delete_node': {
      return {
        ...state,
        nodes: state.nodes.filter((n) => n.id !== action.id),
        racks: state.racks.map((r) => ({
          ...r,
          nodes: r.nodes.filter((s) => s.node_config_id !== action.id),
        })),
      };
    }
    case 'upsert_rack': {
      const idx = state.racks.findIndex((r) => r.id === action.rack.id);
      const racks = idx >= 0 ? state.racks.map((r, i) => (i === idx ? action.rack : r)) : [...state.racks, action.rack];
      return { ...state, racks };
    }
    case 'delete_rack': {
      return {
        ...state,
        racks: state.racks.filter((r) => r.id !== action.id),
        cluster: {
          ...state.cluster,
          racks: state.cluster.racks.filter((s) => s.rack_config_id !== action.id),
        },
      };
    }
    case 'update_cluster':
      return { ...state, cluster: action.cluster };
    case 'upsert_custom_component': {
      const idx = state.custom_components.findIndex((c) => c.id === action.component.id);
      const custom =
        idx >= 0
          ? state.custom_components.map((c, i) => (i === idx ? action.component : c))
          : [...state.custom_components, action.component];
      return {
        ...state,
        custom_components: custom,
        deleted_component_ids: state.deleted_component_ids.filter((id) => id !== action.component.id),
      };
    }
    case 'delete_component': {
      if (action.isBundled) {
        return {
          ...state,
          deleted_component_ids: state.deleted_component_ids.includes(action.id)
            ? state.deleted_component_ids
            : [...state.deleted_component_ids, action.id],
        };
      }
      return {
        ...state,
        custom_components: state.custom_components.filter((c) => c.id !== action.id),
      };
    }
    case 'restore_component':
      return {
        ...state,
        deleted_component_ids: state.deleted_component_ids.filter((id) => id !== action.id),
      };
    default:
      return state;
  }
}

function loadInitial(): Workspace {
  if (typeof window === 'undefined') return emptyWorkspace();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyWorkspace();
    const parsed = JSON.parse(raw) as Workspace;
    if (!parsed || typeof parsed !== 'object') return emptyWorkspace();
    return { ...emptyWorkspace(), ...parsed };
  } catch {
    return emptyWorkspace();
  }
}

interface Ctx {
  workspace: Workspace;
  dispatch: Dispatch<WorkspaceAction>;
  upsertNode: (n: NodeConfig) => void;
  deleteNode: (id: string) => void;
  upsertRack: (r: RackConfig) => void;
  deleteRack: (id: string) => void;
  updateCluster: (c: ClusterConfig) => void;
  upsertCustomComponent: (c: Component) => void;
  deleteComponent: (id: string, isBundled: boolean) => void;
  restoreComponent: (id: string) => void;
}

const WorkspaceContext = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, dispatch] = useReducer(reducer, undefined, loadInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      /* localStorage may be full or disabled; skip persistence */
    }
  }, [workspace]);

  const upsertNode = useCallback((n: NodeConfig) => dispatch({ type: 'upsert_node', node: n }), []);
  const deleteNode = useCallback((id: string) => dispatch({ type: 'delete_node', id }), []);
  const upsertRack = useCallback((r: RackConfig) => dispatch({ type: 'upsert_rack', rack: r }), []);
  const deleteRack = useCallback((id: string) => dispatch({ type: 'delete_rack', id }), []);
  const updateCluster = useCallback((c: ClusterConfig) => dispatch({ type: 'update_cluster', cluster: c }), []);
  const upsertCustomComponent = useCallback(
    (c: Component) => dispatch({ type: 'upsert_custom_component', component: c }),
    []
  );
  const deleteComponent = useCallback(
    (id: string, isBundled: boolean) => dispatch({ type: 'delete_component', id, isBundled }),
    []
  );
  const restoreComponent = useCallback((id: string) => dispatch({ type: 'restore_component', id }), []);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        dispatch,
        upsertNode,
        deleteNode,
        upsertRack,
        deleteRack,
        updateCluster,
        upsertCustomComponent,
        deleteComponent,
        restoreComponent,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
