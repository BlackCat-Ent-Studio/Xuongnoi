import type { Board, Graph, ParamValue, Vec3 } from '../../src/engine/types';

/**
 * N copies of a board as one flat graph: card ids get a prefix and the params that hold a place in the world are shifted along z.
 * The list of those params comes from the placement audit (spike 3); only the kinds the AGV board uses are listed here.
 */
export const WORLD_POINTS: Record<string, RegExp> = {
  block: /^position$/,
  'robot-body': /^position$/,
  'line-track': /^(center|p\d+)$/,
  zone: /^center$/,
  spawner: /^position$/,
  'linear-actuator': /^position$/,
  camera: /^point$/,
};

const isVec3 = (v: ParamValue | undefined): v is Vec3 => typeof v === 'object' && v !== null;

export function cloneBoard(base: Board, copies: number, spacingZ: number, shift: Record<string, RegExp> = WORLD_POINTS): Graph {
  const nodes: Graph['nodes'] = [];
  const wires: Graph['wires'] = [];
  for (let k = 0; k < copies; k++) {
    const pre = `m${k + 1}-`;
    for (const n of base.graph.nodes) {
      const params = structuredClone(n.params);
      const rule = shift[n.kind];
      if (rule) for (const [id, v] of Object.entries(params)) if (rule.test(id) && isVec3(v)) params[id] = { x: v.x, y: v.y, z: v.z + k * spacingZ };
      nodes.push({ id: pre + n.id, kind: n.kind, params, pos: { x: n.pos.x, y: n.pos.y + k * 3000 } });
    }
    for (const w of base.graph.wires) wires.push({ id: pre + w.id, from: { node: pre + w.from.node, port: w.from.port }, to: { node: pre + w.to.node, port: w.to.port } });
  }
  return { nodes, wires, settings: structuredClone(base.graph.settings ?? {}) };
}
