import { useMemo } from 'react';
import bundled from '../data/components.json';
import { useWorkspace } from './workspace';
import type { Component, ComponentLibrary } from '../types/components';

const bundledList = bundled as Component[];

export function useLibrary(): ComponentLibrary {
  const { workspace } = useWorkspace();
  return useMemo(() => {
    const lib: ComponentLibrary = {};
    const deleted = new Set(workspace.deleted_component_ids);
    for (const c of bundledList) {
      if (!deleted.has(c.id)) lib[c.id] = c;
    }
    for (const c of workspace.custom_components) {
      lib[c.id] = c;
    }
    return lib;
  }, [workspace.custom_components, workspace.deleted_component_ids]);
}
