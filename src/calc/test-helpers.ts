import bundled from '../data/components.json';
import type { Component, ComponentLibrary } from '../types/components';

export function bundledLibrary(): ComponentLibrary {
  const lib: ComponentLibrary = {};
  for (const c of bundled as Component[]) {
    lib[c.id] = c;
  }
  return lib;
}
