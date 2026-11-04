import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Params, type Runtime, type Vec3, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { routeFollowNode } from '../../src/nodes/route-follow';
import { vehicleNode } from '../../src/nodes/vehicle';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';
import { defaultParams } from '../nodes/fake-world';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

const v = (x: number, z: number, y = 0.7): Vec3 => ({ x, y, z });
type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

interface Sim {
  world: World;
  rt: Runtime;
  step(n: number, keys?: string[], each?: () => void): void;
  entity(ownerId: string): EntityView;
}

function sim(nodes: NodeSpec[], wires: WireSpec[]): Sim {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld('2d-top');
  const rt = createRuntime(wireStarts(graph, '2d-top'), world, '2d-top');
  return {
    world,
    rt,
    step(n, keys = [], each) {
      for (let i = 0; i < n; i++) {
        rt.tick({ keysDown: new Set(keys) });
        world.step(TICK_DT);
        each?.();
      }
    },
    entity: (id) => world.entities().find((e) => e.ownerNodeId === id)!,
  };
}

const floor: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 }, color: '#888' }];

/** A rounded rectangle of 12 points, 20 x 12, as a closed track. */
const TRACK12: Vec3[] = [
  v(-8, -6), v(0, -6), v(8, -6), v(10, -4), v(10, 0), v(10, 4), v(8, 6), v(0, 6), v(-8, 6), v(-10, 4), v(-10, 0), v(-10, -4),
];
const trackParams = (pts: Vec3[], extra: Params = {}): Params => {
  const out: Params = { count: pts.length, follow: 'rail', ...extra };
  pts.forEach((p, k) => (out[`p${k + 1}`] = p));
  return out;
};

function distToPolyline(p: { x: number; z: number }, pts: readonly Vec3[], closed: boolean): number {
  let best = Infinity;
  const n = pts.length;
  for (let k = 0; k < (closed ? n : n - 1); k++) {
    const a = pts[k]!;
    const b = pts[(k + 1) % n]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const f = len2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2)) : 0;
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * f), p.z - (a.z + dz * f)));
  }
  return best;
}

const loco = (x: number, z: number, extra: Params = {}): NodeSpec => [
  'loco',
  'vehicle',
  { position: v(x, z), model: 'locomotive', maxSpeed: 12, accel: 10, control: 'auto', ...extra },
];
const wagon = (id: string, x: number, z: number): NodeSpec => [id, 'vehicle', { position: v(x, z), model: 'wagon', maxSpeed: 12, accel: 10, control: 'auto' }];
const route = (extra: Params = {}): NodeSpec => ['route', 'route-follow', trackParams(TRACK12, { speed: 6, lookAhead: 0, ...extra })];
const attach: WireSpec[] = [['loco', 'self', 'route', 'self']];

describe('route-follow: rail mode', () => {
  it('keeps the vehicle on the polyline, corners included, at exactly its speed', () => {
    const s = sim([floor, loco(-8, -6), route()], attach);
    let worst = 0;
    let length = 0;
    let prev = s.entity('loco').position;
    s.step(60 * 20, [], () => {
      const p = s.entity('loco').position;
      worst = Math.max(worst, distToPolyline(p, TRACK12, true));
      length += Math.hypot(p.x - prev.x, p.z - prev.z);
      prev = p;
    });
    // Arcs cut each corner a little (0.35 x the 1.5 rounding); straight pieces are exact.
    expect(worst).toBeLessThan(0.6);
    // Corners are shortened by the arcs, so a bit under 6 units/s x 20 s but never over.
    expect(length).toBeLessThanOrEqual(6 * 20 + 0.5);
    expect(length).toBeGreaterThan(6 * 20 * 0.97);
  });

  it('never drifts off the track after many laps', () => {
    const s = sim([floor, loco(-8, -6), route({ speed: 9 })], attach);
    s.step(60 * 90);
    expect(distToPolyline(s.entity('loco').position, TRACK12, true)).toBeLessThan(0.6);
  });

  it('pulses "Khi tới điểm" at each point it passes (not at the start) and reports the next point', () => {
    const sq: Vec3[] = [v(-6, -6), v(6, -6), v(6, 6), v(-6, 6)];
    const s = sim([floor, loco(-6, -6), ['route', 'route-follow', trackParams(sq, { speed: 6, lookAhead: 0 })]], attach);
    const log: number[] = [];
    s.step(60 * 20, [], () => {
      if (s.rt.getOutput('route', 'reached') === true) log.push(s.rt.getOutput('route', 'index') as number);
    });
    expect(log.slice(0, 6)).toEqual([3, 4, 1, 2, 3, 4]);
  });

  it('stops on "Phanh" and resumes where it was', () => {
    const s = sim([floor, loco(-8, -6), route(), ['k', 'key', { key: 'KeyS' }]], [...attach, ['k', 'held', 'route', 'stop']]);
    s.step(120);
    s.step(60, ['KeyS']);
    const held = { ...s.entity('loco').position };
    s.step(60, ['KeyS']);
    const still = s.entity('loco').position;
    expect(Math.hypot(still.x - held.x, still.z - held.z)).toBeLessThan(0.01);
    s.step(60);
    const moved = s.entity('loco').position;
    expect(Math.hypot(moved.x - held.x, moved.z - held.z)).toBeGreaterThan(3);
    expect(distToPolyline(moved, TRACK12, true)).toBeLessThan(0.6);
  });

  it('stops for an obstacle ahead and goes on when it is gone', () => {
    const s = sim(
      [floor, loco(-8, -6), route({ lookAhead: 2.5 }), ['crate', 'block', { position: v(2, -6, 0.5), size: v(1, 1, 1), color: '#a33', solid: 'yes' }]],
      attach,
    );
    s.step(60 * 4);
    const x = s.entity('loco').position.x;
    expect(x).toBeLessThan(2);
    s.step(60 * 2);
    expect(s.entity('loco').position.x).toBeCloseTo(x, 1);
    s.world.hide(s.entity('crate').id);
    s.step(60 * 2);
    expect(s.entity('loco').position.x).toBeGreaterThan(x + 3);
  });

  it('takes 32 points', () => {
    const pts: Vec3[] = [];
    for (let k = 0; k < 32; k++) pts.push(v(Math.round(12 * Math.cos((k / 32) * Math.PI * 2) * 10) / 10, Math.round(12 * Math.sin((k / 32) * Math.PI * 2) * 10) / 10));
    const s = sim([floor, loco(12, 0), ['route', 'route-follow', trackParams(pts, { speed: 8, lookAhead: 0, railCorner: 0.5 })]], attach);
    const seen = new Set<number>();
    s.step(60 * 30, [], () => {
      if (s.rt.getOutput('route', 'reached') === true) seen.add(s.rt.getOutput('route', 'index') as number);
      expect(distToPolyline(s.entity('loco').position, pts, true)).toBeLessThan(0.3);
    });
    expect(seen.size).toBe(32);
    expect(Math.max(...seen)).toBe(32);
  });

  it('keeps the old defaults: steer mode, 8 classic points, 32 allowed', () => {
    const p = defaultParams(routeFollowNode, {});
    expect(p.follow).toBe('steer');
    const count = routeFollowNode.params.find((d) => d.id === 'count')!;
    expect(count.max).toBe(32);
    expect(count.default).toBe(4);
    const ids = routeFollowNode.params.filter((d) => /^p\d+$/.test(d.id));
    expect(ids).toHaveLength(32);
    expect(ids.filter((d) => !d.advanced).map((d) => d.id)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    expect(ids[0]!.default).toEqual({ x: -6, y: 0.5, z: -6 });
  });
});

describe('Xe: model sizes and the coupling input', () => {
  it('locomotive and wagon have sizes; the coupling is off by default', () => {
    expect(vehicleSize('locomotive').x).toBeGreaterThan(vehicleSize('truck').x);
    expect(vehicleSize('wagon').y).toBeGreaterThan(0);
    expect(vehicleNode.inputs.some((i) => i.id === 'leader' && i.type === 'object')).toBe(true);
    expect(defaultParams(vehicleNode, {}).towDistance).toBe(0);
  });
});

describe('trains', () => {
  const gap = (a: EntityView, b: EntityView): number => Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);

  function train(n: number): { s: Sim; ids: string[] } {
    const nodes: NodeSpec[] = [floor, loco(-4, -6), route()];
    const wires: WireSpec[] = [...attach];
    const ids = ['loco'];
    for (let k = 1; k <= n; k++) {
      // Spawned right behind each other on the track, as a player would place them.
      nodes.push(wagon(`w${k}`, -4 - 2.7 * k, -6));
      wires.push([ids[k - 1]!, 'self', `w${k}`, 'leader']);
      ids.push(`w${k}`);
    }
    return { s: sim(nodes, wires), ids };
  }

  it('wagons keep their spacing through a whole loop and stay on the track', () => {
    const { s, ids } = train(2);
    let minGap = Infinity;
    let maxGap = 0;
    let offTrack = 0;
    let crashes = 0;
    let tick = 0;
    s.step(60 * 30, [], () => {
      tick++;
      for (let k = 1; k < ids.length; k++) {
        const g = gap(s.entity(ids[k - 1]!), s.entity(ids[k]!));
        minGap = Math.min(minGap, g);
        maxGap = Math.max(maxGap, g);
      }
      // Wagons that start behind the engine sit on the straight extension of its first stretch until they reach the track.
      for (const id of tick > 60 * 8 ? ids : []) {
        offTrack = Math.max(offTrack, distToPolyline(s.entity(id).position, TRACK12, true));
        crashes += s.entity(id).vehicle!.hitSeq ?? 0;
      }
    });
    // Center distance is 2.7 on a straight and a little less across a corner arc.
    expect(maxGap).toBeLessThan(2.72);
    expect(minGap).toBeGreaterThan(2.2);
    expect(offTrack).toBeLessThan(0.7);
    expect(crashes).toBe(0);
  });

  it('a chain of three wagons keeps order and never counts a crash', () => {
    const { s, ids } = train(3);
    s.step(60 * 25);
    for (let k = 1; k < ids.length; k++) {
      const g = gap(s.entity(ids[k - 1]!), s.entity(ids[k]!));
      expect(g).toBeGreaterThan(2.2);
      expect(g).toBeLessThan(2.75);
      expect(s.entity(ids[k]!).vehicle!.hitSeq).toBe(0);
    }
    expect(s.entity('loco').vehicle!.hitSeq).toBe(0);
    // The last wagon trails the head by about three coupling lengths along the track.
    expect(gap(s.entity('loco'), s.entity('w3'))).toBeGreaterThan(5);
  });

  it('a wagon matches the heading of the track, not its own drive input', () => {
    const { s } = train(1);
    s.step(60 * 1.5);
    // Top straight, travelling +x: both noses point along +x.
    const h = (id: string): number => s.entity(id).vehicle!.heading;
    expect(Math.abs(h('loco'))).toBeLessThan(0.2);
    expect(Math.abs(h('w1'))).toBeLessThan(0.2);
  });

  it('wagon stops when its leader is hidden', () => {
    const { s } = train(1);
    s.step(60 * 4);
    s.world.hide(s.entity('loco').id);
    s.step(60);
    const p = { ...s.entity('w1').position };
    s.step(60);
    const q = s.entity('w1').position;
    expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeLessThan(0.01);
    expect(Math.abs(s.entity('w1').vehicle!.speed)).toBeLessThan(0.01);
  });

  it('an uncoupled vehicle still drives itself exactly as before', () => {
    const w = createWorld('2d-top');
    w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 }, color: '#888', solid: true });
    const id = w.spawn({
      kind: 'vehicle', ownerNodeId: 'free', position: v(0, 0), size: vehicleSize('wagon'), color: '#fff', solid: true,
      vehicle: { model: 'wagon', steerMode: 'direction', maxSpeed: 8, accel: 8 },
    });
    for (let i = 0; i < 120; i++) {
      w.setVehicleInput(id, 1, 0);
      w.step(TICK_DT);
    }
    expect(w.entities().find((e) => e.id === id)!.position.x).toBeGreaterThan(5);
  });

  it('coupled vehicles do not crash, other vehicles still do', () => {
    const s = sim([floor, loco(0, 0, { control: 'driver' }), wagon('w1', -2.7, 0)], [['loco', 'self', 'w1', 'leader']]);
    const ram = s.world.spawn({
      kind: 'vehicle', ownerNodeId: 'ram', position: v(-9, 0), size: vehicleSize('car'), color: '#00f', solid: true,
      vehicle: { model: 'car', steerMode: 'direction', maxSpeed: 9, accel: 10 },
    });
    s.step(10);
    s.step(120, [], () => s.world.setVehicleInput(ram, 1, 0));
    expect(s.entity('loco').vehicle!.hitSeq).toBe(0);
    expect(s.entity('w1').vehicle!.hitSeq).toBeGreaterThan(0);
  });
});
