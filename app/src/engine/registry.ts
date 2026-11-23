import type { NodeDef, ViewMode } from './types';

const defs = new Map<string, NodeDef<any>>();

export function registerNode<S>(def: NodeDef<S>): void {
  if (defs.has(def.kind)) throw new Error(`Node kind already registered: ${def.kind}`);
  defs.set(def.kind, def as NodeDef<any>);
}

export function getNodeDef(kind: string): NodeDef<any> | undefined {
  return defs.get(kind);
}

/** All node defs, optionally filtered to those available in a view mode. */
export function listNodeDefs(mode?: ViewMode): NodeDef<any>[] {
  const all = [...defs.values()];
  return mode ? all.filter((d) => !d.modes || d.modes.includes(mode)) : all;
}

/** Test helper: clears the registry. */
export function clearRegistry(): void {
  defs.clear();
}
