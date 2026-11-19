import type { Board, Graph, ParamValue, Vec3 } from '../../src/engine/types';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';

/**
 * Big boards made from small ones, for tests that ask how the engine behaves as a board grows. Nothing here is a feature of the
 * app: the copies are made by renaming card ids and shifting the params that hold a place in the world.
 */

/** Params that hold a place in the world, by node kind (the kinds the AGV sample uses). */
const WORLD_POINTS: Record<string, RegExp> = {
  block: /^position$/,
  'robot-body': /^position$/,
  'line-track': /^(center|p\d+)$/,
  zone: /^center$/,
  spawner: /^position$/,
  'linear-actuator': /^position$/,
  camera: /^point$/,
};

const isVec3 = (v: ParamValue | undefined): v is Vec3 => typeof v === 'object' && v !== null;

/** N copies of a board as one flat graph: card ids get the prefix `m<k>-`, and each copy stands `spacingZ` metres further along z. */
export function cloneBoard(base: Board, copies: number, spacingZ: number): Graph {
  const nodes: Graph['nodes'] = [];
  const wires: Graph['wires'] = [];
  for (let k = 0; k < copies; k++) {
    const pre = `m${k + 1}-`;
    for (const n of base.graph.nodes) {
      const params = structuredClone(n.params);
      const rule = WORLD_POINTS[n.kind];
      if (rule) for (const [id, v] of Object.entries(params)) if (rule.test(id) && isVec3(v)) params[id] = { x: v.x, y: v.y, z: v.z + k * spacingZ };
      nodes.push({ id: pre + n.id, kind: n.kind, params, pos: { x: n.pos.x, y: n.pos.y + k * 3000 } });
    }
    for (const w of base.graph.wires) wires.push({ id: pre + w.id, from: { node: pre + w.from.node, port: w.from.port }, to: { node: pre + w.to.node, port: w.to.port } });
  }
  return { nodes, wires, settings: structuredClone(base.graph.settings ?? {}) };
}

/**
 * N small chassis side by side on one floor, each with two motors, a look-ahead stop, a tilt tray (joint + solid link), a zone that
 * follows it, three line sensors on its own straight line and one crate on the tray. Rows for the `rig` helper.
 */
export function trayFleet(n: number): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const nodes: NodeSpec[] = [['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 120, y: 1, z: 60 } }], ['go', 'on-start', {}], ['pw', 'const', { value: 0.7 }], ['ang', 'const', { value: 0 }]];
  const wires: WireSpec[] = [];
  for (let k = 0; k < n; k++) {
    const z = (k - (n - 1) / 2) * 2.5;
    const id = `r${k + 1}`;
    nodes.push(
      [`${id}-line`, 'line-track', { shape: 'custom', count: 2, closed: 'no', smooth: 'no', center: { x: 0, y: 0.02, z: 0 }, width: 0.3, p1: { x: -55, y: 0, z }, p2: { x: 55, y: 0, z } }],
      [id, 'robot-body', { position: { x: -50, y: 0.15, z }, heading: 0, length: 0.8, width: 0.6, height: 0.3, mass: 5, friction: 0.8 }],
      [`${id}-ml`, 'motor', { side: -0.3, maxRpm: 90, maxForce: 6, accel: 300 }],
      [`${id}-mr`, 'motor', { side: 0.3, maxRpm: 90, maxForce: 6, accel: 300 }],
      [`${id}-eye`, 'ahead-sensor', { reach: 1 }],
      [`${id}-clear`, 'not', {}],
      [`${id}-num`, 'bool-to-number', {}],
      [`${id}-gate`, 'math', { op: 'mul' }],
      [`${id}-s1`, 'line-sensor', { side: -0.2, forward: 0.45, spot: 0.2 }],
      [`${id}-s2`, 'line-sensor', { side: 0, forward: 0.45, spot: 0.2 }],
      [`${id}-s3`, 'line-sensor', { side: 0.2, forward: 0.45, spot: 0.2 }],
      [`${id}-tilt`, 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, maxSpeed: 30, mount: { x: -0.4, y: 0.35, z: 0 }, solid: 'no' }],
      [`${id}-tray`, 'link', { length: 0.8, thickness: 0.2, solid: 'yes', mass: 1 }],
      [`${id}-load`, 'zone', { center: { x: 0, y: 0.75, z: 0 }, size: { x: 0.8, y: 0.6, z: 0.8 }, filter: 'item', rule: 'center', rotate: 'yes' }],
      [`${id}-crate`, 'item', { shape: 'crate', position: { x: -50, y: 0.15 + 0.35 + 0.1 + 0.15 + 0.005, z }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: 1 }],
    );
    wires.push(
      [id, 'self', `${id}-ml`, 'body'], [id, 'self', `${id}-mr`, 'body'], [id, 'self', `${id}-eye`, 'who'],
      [`${id}-eye`, 'blocked', `${id}-clear`, 'in'], [`${id}-clear`, 'out', `${id}-num`, 'on'],
      ['pw', 'value', `${id}-gate`, 'a'], [`${id}-num`, 'value', `${id}-gate`, 'b'],
      [`${id}-gate`, 'out', `${id}-ml`, 'power'], [`${id}-gate`, 'out', `${id}-mr`, 'power'],
      [id, 'self', `${id}-s1`, 'who'], [id, 'self', `${id}-s2`, 'who'], [id, 'self', `${id}-s3`, 'who'],
      [`${id}-line`, 'self', `${id}-s1`, 'track'], [`${id}-line`, 'self', `${id}-s2`, 'track'], [`${id}-line`, 'self', `${id}-s3`, 'track'],
      [id, 'self', `${id}-tilt`, 'base'], ['go', 'started', `${id}-tilt`, 'power'], ['ang', 'value', `${id}-tilt`, 'angle'], [`${id}-tilt`, 'tip', `${id}-tray`, 'base'],
      [id, 'self', `${id}-load`, 'follow'],
    );
  }
  return { nodes, wires };
}
