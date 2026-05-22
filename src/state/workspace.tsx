import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { Workspace } from '../types/scenario';
import { emptyWorkspace } from './defaults';

const STORAGE_KEY = 'ccp.v1.workspace';

export type WorkspaceAction =
  | { type: 'replace_workspace'; workspace: Workspace }
  | { type: 'reset' };

function reducer(state: Workspace, action: WorkspaceAction): Workspace {
  switch (action.type) {
    case 'replace_workspace':
      return action.workspace;
    case 'reset':
      return emptyWorkspace();
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
    return {
      ...emptyWorkspace(),
      ...parsed,
    };
  } catch {
    return emptyWorkspace();
  }
}

interface Ctx {
  workspace: Workspace;
  dispatch: Dispatch<WorkspaceAction>;
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

  return (
    <WorkspaceContext.Provider value={{ workspace, dispatch }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): Ctx {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
