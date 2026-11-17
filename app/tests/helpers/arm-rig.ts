import { createRuntime } from '../../src/engine/runtime';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { TICK_DT, type Graph, type GraphNode, type InputSnapshot, type ParamValue, type ViewMode } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';

registerAllNodes();

export type NodeSpec = [id: string, kind: string, params?: Record<string, ParamValue>];
export type WireSpec = [from: string, outPort: string, to: string, inPort: string];

/** Builds a graph from short rows (defaults filled in) and plays it headless. */
export function rig(nodes: NodeSpec[], wires: WireSpec[], mode: ViewMode = '2d-side', solidBodies = false) {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params], n): GraphNode => {
      const def = getNodeDef(kind);
      if (!def) throw new Error(`unknown kind ${kind}`);
      const base: Record<string, ParamValue> = {};
      // A saved board that never mentioned a setting plays with its legacy value, like a card loaded from an old file.
      for (const p of def.params) base[p.id] = p.legacyDefault ?? p.default;
      return { id, kind, params: { ...base, ...(params ?? {}) }, pos: { x: n * 10, y: 0 } };
    }),
    wires: wires.map(([f, fp, t, tp], n) => ({ id: `w${n}`, from: { node: f, port: fp }, to: { node: t, port: tp } })),
    settings: { wireRule: true, ...(solidBodies ? { solidBodies: true } : {}) },
  };
  const world = createWorld(mode, solidBodies ? { solidBodies: true } : undefined);
  const rt = createRuntime(graph, world, mode);
  let keys = new Set<string>();
  return {
    world,
    rt,
    graph,
    hold(...k: string[]) {
      keys = new Set(k);
    },
    tick(n = 1) {
      for (let i = 0; i < n; i++) {
        rt.tick({ keysDown: keys } as InputSnapshot);
        world.step(TICK_DT);
      }
    },
    out: (id: string, port: string) => rt.getOutput(id, port),
    set: (id: string, params: Record<string, ParamValue>) => rt.applyNodeParams(id, params),
    entity: (ownerId: string) => world.entities().find((e) => e.ownerNodeId === ownerId),
  };
}
