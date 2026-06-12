import bundled from '../data/components.json';
import type { Component, ComponentLibrary } from '../types/components';
import type { Workspace } from '../types/scenario';

const bundledList = bundled as Component[];

export function mergeLibrary(
  workspace: Pick<Workspace, 'custom_components' | 'deleted_component_ids'>
): ComponentLibrary {
  const lib: ComponentLibrary = {};
  const deleted = new Set(workspace.deleted_component_ids);
  for (const c of bundledList) {
    if (!deleted.has(c.id)) lib[c.id] = c;
  }
  for (const c of workspace.custom_components) {
    lib[c.id] = c;
  }
  return lib;
}
