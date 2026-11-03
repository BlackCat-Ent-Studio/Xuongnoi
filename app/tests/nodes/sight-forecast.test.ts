import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type GraphNode, type Params, type Vec3 } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { NEVER_SEEN, forecastSight, legPoints } from '../../src/nodes/sight-forecast';
import { createWorld } from '../../src/world/world';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

const v = (x: number, z: number, y = 0.5): Vec3 => ({ x, y, z });
const floor: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 30 }, color: '#888' }];
const crate = (id: string, x: number, z: number): NodeSpec => [id, 'block', { position: { x, y: 1.1, z }, size: { x: 1.7, y: 2.2, z: 1.7 }, color: '#a16207', type: 'solid' }];

/** A guard walking a lane back and forth with eyes on a motionless probe, plus a forecast watching the same probe. */
function board(probe: Vec3, vision: Params = {}, patrol: Params = {}): { nodes: NodeSpec[]; wires: WireSpec[] } {
  return {
    nodes: [
      floor,
      crate('c1', 0.8, 1),
      crate('c2', -5, 1),
      ['guard', 'character', { position: v(0.5, -2.5), speed: 1.3, role: 'bot', look: 'robot-legs' }],
      ['probe', 'character', { position: probe, speed: 1, role: 'bot' }],
      ['walk', 'patrol', { pointA: v(0.5, -4.1), pointB: v(0.5, -0.9), wait: 0.4, pathfind: 'off', ...patrol }],
      ['eyes', 'vision-sensor', { range: 10, angle: 90, walls: 'yes', ...vision }],
      ['fore', 'sight-forecast', {}],
    ],
    wires: [
      ['guard', 'self', 'walk', 'self'],
      ['walk', 'moveX', 'guard', 'moveX'],
      ['walk', 'moveY', 'guard', 'moveY'],
      ['guard', 'self', 'eyes', 'viewer'],
      ['probe', 'self', 'eyes', 'target'],
      ['guard', 'self', 'fore', 'viewer'],
      ['probe', 'self', 'fore', 'target'],
    ],
  };
}

interface Trace {
  window: number[];
  safe: boolean[];
  seen: boolean[];
}

function trace(b: { nodes: NodeSpec[]; wires: WireSpec[] }, ticks: number, foreId = 'fore'): Trace {
  const graph: Graph = {
    nodes: b.nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: b.wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld('3d');
  const rt = createRuntime(wireStarts(graph, '3d'), world, '3d');
  const out: Trace = { window: [], safe: [], seen: [] };
  for (let i = 0; i < ticks; i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    out.window.push(rt.getOutput(foreId, 'window') as number);
    out.safe.push(rt.getOutput(foreId, 'safe') === true);
    out.seen.push(rt.getOutput('eyes', 'seen') === true);
  }
  return out;
}

/** Seconds from tick `from` until the real sensor first says "seen" (null when it never does in the run). */
function actualWindow(t: Trace, from: number): number | null {
  for (let k = from; k < t.seen.length; k++) if (t.seen[k]) return (k - from) * TICK_DT;
  return null;
}

describe('sight forecast against the real sensor (brute force)', () => {
  // Spots in the open and behind a crate, near and far from the lane.
  const SPOTS: Vec3[] = [v(0.5, 2.7), v(-3, 2.7), v(3, 2.5), v(-6.3, 1.8), v(0.9, 2.6), v(6.5, 1), v(-8, 2.7), v(0.5, 6)];

  it('"Còn" matches the time the real sensor needs to see the spot, from many moments of the patrol', () => {
    let compared = 0;
    let nonTrivial = 0;
    for (const spot of SPOTS) {
      const t = trace(board(spot), 60 * 40);
      for (const at of [10, 45, 90, 150, 233, 400, 777]) {
        const horizon = 12;
        const real = actualWindow(t, at);
        const predicted = t.window[at]!;
        if (real === null || real > horizon) {
          expect(predicted, `spot ${spot.x},${spot.z} at tick ${at}`).toBe(NEVER_SEEN);
        } else {
          expect(Math.abs(predicted - real), `spot ${spot.x},${spot.z} at tick ${at}: predicted ${predicted}, real ${real}`).toBeLessThanOrEqual(0.2);
          if (real > 0.3) nonTrivial++;
        }
        compared++;
      }
    }
    expect(compared).toBe(SPOTS.length * 7);
    expect(nonTrivial).toBeGreaterThan(5);
  }, 60_000);

  it('"An toàn" is on exactly when "Còn" says never', () => {
    const t = trace(board(v(0.5, 2.7)), 600);
    for (let k = 5; k < 600; k++) expect(t.safe[k], `tick ${k}`).toBe(t.window[k] === NEVER_SEEN);
    const open = trace(board(v(3, 2.5)), 120);
    expect(open.window[100]!).toBeLessThan(NEVER_SEEN);
    const far = trace(board(v(0.5, 2.7), { range: 2 }), 120);
    expect(far.window[100]).toBe(NEVER_SEEN);
    expect(far.safe[100]).toBe(true);
  });

  it('follows the sensor settings: a narrow cone sees the lane-side spot later (or never)', () => {
    const wide = trace(board(v(3, 2.5), { angle: 160 }), 120).window[60]!;
    const narrow = trace(board(v(3, 2.5), { angle: 20 }), 120).window[60]!;
    expect(narrow).toBeGreaterThanOrEqual(wide);
  });
});

describe('sight forecast pure rules', () => {
  const base = {
    mode: '3d' as const,
    boxes: [],
    viewer: { position: v(0, 0), facing: { x: 0, z: 1 }, speed: 1 },
    vision: { range: 10, angle: 90, walls: true },
    horizon: 12,
  };

  it('0 when the point is seen right now, null when out of range or behind the viewer', () => {
    expect(forecastSight({ ...base, points: [v(0, 4)] })).toBe(0);
    expect(forecastSight({ ...base, points: [v(0, 20)] })).toBeNull();
    expect(forecastSight({ ...base, points: [v(0, -4)] })).toBeNull();
  });

  it('a block between viewer and point hides it; with walls off it does not', () => {
    const wall = { position: v(0, 2, 1), size: { x: 2, y: 2, z: 1 } };
    expect(forecastSight({ ...base, boxes: [wall], points: [v(0, 4)] })).toBeNull();
    expect(forecastSight({ ...base, boxes: [wall], vision: { ...base.vision, walls: false }, points: [v(0, 4)] })).toBe(0);
  });

  it('a patrolling viewer turns round and sees the spot later; waiting delays it', () => {
    const patrol = { a: v(0, -3), b: v(0, 3), heading: 'A' as const, waitLeft: 0, wait: 1 };
    // Facing away (+z is toward the point at z=-4? no: viewer faces -z, the point lies at +z).
    const away = { ...base, viewer: { position: v(0, 0), facing: { x: 0, z: -1 }, speed: 1 }, patrol, points: [v(0, 6)] };
    const t = forecastSight(away)!;
    expect(t).toBeGreaterThan(3);
    const longer = forecastSight({ ...away, patrol: { ...patrol, wait: 4 } })!;
    expect(longer).toBeGreaterThan(t + 2);
  });

  it('a leg is watched along its whole length', () => {
    const pts = legPoints(v(-10, 5), v(10, 5));
    expect(pts[0]).toEqual(v(-10, 5));
    expect(pts[pts.length - 1]).toEqual(v(10, 5));
    expect(pts.length).toBe(51);
    // Only the middle of the leg is in the cone.
    const t = forecastSight({ ...base, vision: { range: 6, angle: 40, walls: true }, points: pts });
    expect(t).toBe(0);
    const none = forecastSight({ ...base, viewer: { ...base.viewer, position: v(0, -20) }, points: pts });
    expect(none).toBeNull();
  });
});

describe('sight forecast node', () => {
  it('does not move anything: the same run with and without it is identical', () => {
    const withIt = board(v(0.5, 2.7));
    const without = { nodes: withIt.nodes.filter(([id]) => id !== 'fore'), wires: withIt.wires.filter(([, , to]) => to !== 'fore') };
    const run = (b: typeof withIt): number[] => {
      const graph: Graph = {
        nodes: b.nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
        wires: b.wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
      };
      const world = createWorld('3d');
      const rt = createRuntime(wireStarts(graph, '3d'), world, '3d');
      const zs: number[] = [];
      for (let i = 0; i < 600; i++) {
        rt.tick({ keysDown: new Set() });
        world.step(TICK_DT);
        zs.push(world.entities().find((e) => e.ownerNodeId === 'guard')!.position.z);
      }
      return zs;
    };
    expect(run(withIt)).toEqual(run(without));
  });

  it('is careful (not safe, 0 s left) on the very first tick, before the eyes have reported', () => {
    const b = board(v(0.5, 6), { range: 2 });
    // Sorted ahead of the sensor, the forecast runs first in tick 0.
    const early = { nodes: b.nodes.map(([id, ...r]): NodeSpec => [id === 'fore' ? 'a-fore' : id, ...r] as NodeSpec), wires: b.wires.map(([f, fp, t, tp]): WireSpec => [f === 'fore' ? 'a-fore' : f, fp, t === 'fore' ? 'a-fore' : t, tp]) };
    const t = trace(early, 3, 'a-fore');
    expect(t.window[0]).toBe(0);
    expect(t.safe[0]).toBe(false);
    expect(t.window[2]).toBe(NEVER_SEEN);
  });
});
