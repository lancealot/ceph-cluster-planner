import { useMemo } from 'react';
import { useWorkspace } from './workspace';
import type { ComponentLibrary } from '../types/components';
import { mergeLibrary } from '../calc/library';

export { mergeLibrary };

export function useLibrary(): ComponentLibrary {
  const { workspace } = useWorkspace();
  return useMemo(
    () => mergeLibrary(workspace),
    [workspace.custom_components, workspace.deleted_component_ids]
  );
}
