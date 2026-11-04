import type { NodeDef, Params, PortDef, ViewMode } from './types';

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

/** Inputs a node shows and reads right now: its fixed ones plus any optional ones its settings switch on. */
export function activeInputs(def: NodeDef<any>, params: Params): PortDef[] {
  return def.optionalInputs ? [...def.inputs, ...def.optionalInputs.active(params)] : def.inputs;
}

/** Every input id a saved wire may name, switched on or not. */
export function knownInputs(def: NodeDef<any>): PortDef[] {
  return def.optionalInputs ? [...def.inputs, ...def.optionalInputs.all] : def.inputs;
}

/** Test helper: clears the registry. */
export function clearRegistry(): void {
  defs.clear();
}
