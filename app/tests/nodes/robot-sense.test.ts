import { beforeAll, describe, expect, it } from 'vitest';
import { TRAFFIC_COLORS } from '../../src/engine/block-styles';
import { createRuntime } from '../../src/engine/runtime';
import { addWire } from '../../src/engine/wiring';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Params, type ViewMode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { headingOf } from '../../src/nodes/line-sensor';
import { lookDirection } from '../../src/nodes/vision-sensor';
import { groundHeading, turnDirection } from '../../src/world/heading';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

type W = readonly [string, string, string, string];
const node = (id: string, kind: string, params: Params = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });
const DEG = Math.PI / 180;

function wired(nodes: GraphNode[], wires: readonly W[]): Graph {
  let g: Graph = { nodes, wires: [] };
  for (const [fn, fp, tn, tp] of wires) {
    const res = addWire(g, { node: fn, port: fp }, { node: tn, port: tp });
    if ('ok' in res) throw new Error(`cannot wire ${fn}.${fp} -> ${tn}.${tp}: ${res.reason}`);
    g = res;
  }
  return g;
}

const FLOOR = node('floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 80, y: 1, z: 80 }, type: 'solid', color: '#777777' });

function run(graph: Graph, mode: ViewMode, seconds: number): { rt: ReturnType<typeof createRuntime>; views: () => readonly EntityView[] } {
  const world = createWorld(mode);
  const rt = createRuntime(graph, world, mode);
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
  }
  return { rt, views: () => world.entities() };
}

/** Distance along the ray from (0, 0) at `heading` to a box, by the slab method (independent of the sensor code). */
function rayToBox(heading: number, c: { x: number; z: number }, half: number): number {
  const d = { x: Math.cos(heading), z: Math.sin(heading) };
  let lo = 0;
  let hi = Infinity;
  for (const [o, dir, centre] of [
    [0, d.x, c.x],
    [0, d.z, c.z],
  ] as const) {
    if (Math.abs(dir) < 1e-12) {
      if (Math.abs(centre - o) > half) return Infinity;
      continue;
    }
    const t1 = (centre - half - o) / dir;
    const t2 = (centre + half - o) / dir;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
  }
  return lo <= hi ? lo : Infinity;
}

const robotView = (heading: number): EntityView => ({
  id: 'r', kind: 'robot', ownerNodeId: 'r', position: { x: 2, y: 0.3, z: 1 }, size: { x: 1, y: 0.3, z: 1 }, color: '#fff', visible: true,
  robot: { length: 1, width: 0.7, speed: 0, heading, turnRate: 0, wheels: [] },
});

describe('one heading helper for robots, vehicles and characters', () => {
  it('reads robot, vehicle and character headings, and defaults to +x', () => {
    expect(groundHeading({ robot: { heading: Math.PI / 2 } }).z).toBeCloseTo(1);
    expect(groundHeading({ vehicle: { heading: Math.PI } }).x).toBeCloseTo(-1);
    expect(groundHeading({ facing: { x: 0, z: -2 } })).toEqual({ x: 0, z: -1 });
    expect(groundHeading({})).toEqual({ x: 1, z: 0 });
    expect(groundHeading({ facing: { x: 0, z: 0 } })).toEqual({ x: 1, z: 0 });
  });

  it('turnDirection grows clockwise seen from above (+x turns toward +z)', () => {
    const d = turnDirection({ x: 1, z: 0 }, 90 * DEG);
    expect(d.x).toBeCloseTo(0);
    expect(d.z).toBeCloseTo(1);
  });

  it('line eye and vision cone agree on a robot at 0, 45, 90 and 200 degrees', () => {
    for (const deg of [0, 45, 90, 200]) {
      const v = robotView(deg * DEG);
      const eye = headingOf(v, '2d-top');
      const look = lookDirection(v, '2d-top');
      expect(eye.x, `${deg}`).toBeCloseTo(Math.cos(deg * DEG));
      expect(eye.z, `${deg}`).toBeCloseTo(Math.sin(deg * DEG));
      expect(look.a, `${deg}`).toBeCloseTo(eye.x);
      expect(look.b, `${deg}`).toBeCloseTo(eye.z);
    }
  });

  it('the side view only tells left from right', () => {
    expect(headingOf(robotView(200 * DEG), '2d-side')).toEqual({ x: -1, z: 0 });
    expect(lookDirection(robotView(10 * DEG), '2d-side')).toEqual({ a: 1, b: 0 });
  });
});

describe('Dò phía trước on a robot chassis', () => {
  /** A chassis at the origin with a small wall 3 m away along `heading`; returns the sensor outputs. */
  function sense(headingDeg: number, extra: Params = {}, mode: ViewMode = '3d', wall = { x: 0, z: 0, half: 0.25 }): { distance: number; blocked: boolean } {
    const h = headingDeg * DEG;
    const w = { x: 3 * Math.cos(h) + wall.x, z: 3 * Math.sin(h) + wall.z };
    const g = wired(
      [
        node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: headingDeg, height: 0.3 }),
        node('eye', 'ahead-sensor', { reach: 10, beam: 0.02, ...extra }),
        node('wall', 'block', { position: { x: w.x, y: 0.5, z: w.z }, size: { x: wall.half * 2, y: 1, z: wall.half * 2 }, type: 'solid' }),
        FLOOR,
      ],
      [['body', 'self', 'eye', 'who']],
    );
    const { rt } = run(g, mode, 0.1);
    return { distance: rt.getOutput('eye', 'distance') as number, blocked: rt.getOutput('eye', 'blocked') as boolean };
  }

  it('looks along the nose at 0, 45, 90 and 200 degrees (exact distance)', () => {
    for (const deg of [0, 45, 90, 200]) {
      const h = deg * DEG;
      const c = { x: 3 * Math.cos(h), z: 3 * Math.sin(h) };
      const exit = 0.5 / Math.max(Math.abs(Math.cos(h)), Math.abs(Math.sin(h)));
      const want = rayToBox(h, c, 0.25) - exit;
      const got = sense(deg);
      expect(got.blocked, `${deg}`).toBe(true);
      // the beam is 2 cm wide, so a tilted box face is met up to 1 cm * tan(angle) earlier than on the centre line
      expect(got.distance, `${deg}`).toBeCloseTo(want, 2);
    }
  });

  it('is not blocked by a wall beside the line of sight, at any heading', () => {
    for (const deg of [0, 45, 90, 200]) {
      const h = deg * DEG;
      // 1.2 m to the right of the beam, well outside the body width
      const off = { x: -Math.sin(h) * 1.2, z: Math.cos(h) * 1.2 };
      expect(sense(deg, {}, '3d', { ...off, half: 0.25 }).blocked, `${deg}`).toBe(false);
    }
  });

  it('the default beam is as wide as the body: a wall just inside the body width blocks, just outside does not', () => {
    // body width 0.7 m, lane half-width 0.315: a wall whose near edge is 0.2 m off the centre line blocks at 45 degrees
    const h = 45 * DEG;
    const side = (m: number): { x: number; z: number } => ({ x: -Math.sin(h) * m, z: Math.cos(h) * m });
    expect(sense(45, { beam: 0 }, '3d', { ...side(0.45), half: 0.25 }).blocked).toBe(true);
    expect(sense(45, { beam: 0 }, '3d', { ...side(0.9), half: 0.25 }).blocked).toBe(false);
  });

  it('mount side moves the beam to that side of the body', () => {
    const wall = { x: 0, z: 0.7, half: 0.25 }; // wall at z 0.45..0.95: right of the centre line, heading 0
    expect(sense(0, { mountSide: 0.7 }, '3d', wall).blocked).toBe(true);
    expect(sense(0, { mountSide: -0.7 }, '3d', wall).blocked).toBe(false);
    expect(sense(0, {}, '3d', wall).blocked).toBe(false);
  });

  it('mount forward slides the sensor along the nose; the gap is still counted from the body edge', () => {
    expect(sense(0, { mountForward: 0 }).distance).toBeCloseTo(2.25, 3);
    expect(sense(0, { mountForward: 0.3 }).distance).toBeCloseTo(2.25, 3);
    // a sensor moved past the wall (3.5 m ahead) has it behind and sees nothing; one inside the wall reads 0
    expect(sense(0, { mountForward: 3.5 }).blocked).toBe(false);
    expect(sense(0, { mountForward: 3 }).distance).toBe(0);
  });

  it('look angle turns the beam: right, left and backwards', () => {
    // wall 3 m to the right of a robot facing +x (z = +3)
    const right = { x: -3, z: 3, half: 0.25 }; // (wall offset is added to the 3 m ahead position (3, 0))
    expect(sense(0, { lookAngle: 90 }, '3d', right).blocked).toBe(true);
    expect(sense(0, { lookAngle: 90 }, '3d', right).distance).toBeCloseTo(2.25, 3);
    expect(sense(0, { lookAngle: -90 }, '3d', right).blocked).toBe(false);
    expect(sense(0, {}, '3d', right).blocked).toBe(false);
    const behind = { x: -6, z: 0, half: 0.25 };
    expect(sense(0, { lookAngle: 180 }, '3d', behind).distance).toBeCloseTo(2.25, 3);
  });

  it('look angle and mount offsets turn with the chassis', () => {
    // chassis heading 90: its right is -x, so a left-looking (-90) sensor looks to +x
    const wall = { x: 3, z: -3, half: 0.25 }; // 3 m along +z heading plus (3, -3) = (3, 0)
    expect(sense(90, { lookAngle: -90 }, '3d', wall).blocked).toBe(true);
    expect(sense(90, { lookAngle: 90 }, '3d', wall).blocked).toBe(false);
  });

  it('the default neutral mount gives the same reading as the plain sensor on a character', () => {
    // the legacy facing test is untouched for characters
    const g = wired(
      [
        node('p', 'character', { position: { x: 0, y: 0.5, z: 0 } }),
        node('eye', 'ahead-sensor', { reach: 10 }),
        node('wall', 'block', { position: { x: 4, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, type: 'solid' }),
        FLOOR,
      ],
      [['p', 'self', 'eye', 'who']],
    );
    const { rt } = run(g, '3d', 0.1);
    expect(rt.getOutput('eye', 'blocked')).toBe(true);
  });

  it('works in the side view (x only) and the top-down view', () => {
    expect(sense(0, {}, '2d-side').distance).toBeCloseTo(2.25, 3);
    expect(sense(0, {}, '2d-top').distance).toBeCloseTo(2.25, 3);
    expect(sense(180, {}, '2d-side').blocked).toBe(true);
  });

  it('sees another robot chassis in front of it', () => {
    const g = wired(
      [
        node('a', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3 }),
        node('b', 'robot-body', { position: { x: 3, y: 0.15, z: 0 }, height: 0.3 }),
        node('eye', 'ahead-sensor', { reach: 10 }),
        FLOOR,
      ],
      [['a', 'self', 'eye', 'who']],
    );
    const { rt } = run(g, '3d', 0.1);
    expect(rt.getOutput('eye', 'blocked')).toBe(true);
    expect(rt.getOutput('eye', 'distance') as number).toBeCloseTo(2, 3);
  });
});

describe('Tầm nhìn on a robot chassis', () => {
  function sees(headingDeg: number, target: { x: number; z: number }): boolean {
    const g = wired(
      [
        node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: headingDeg, height: 0.3 }),
        node('eye', 'vision-sensor', { range: 8, angle: 60, walls: 'no' }),
        node('p', 'character', { position: { x: target.x, y: 0.5, z: target.z } }),
        FLOOR,
      ],
      [['body', 'self', 'eye', 'viewer']],
    );
    const { rt } = run(g, '3d', 0.1);
    return rt.getOutput('eye', 'seen') as boolean;
  }

  it('looks where the chassis points, not always along +x', () => {
    expect(sees(0, { x: 4, z: 0 })).toBe(true);
    expect(sees(0, { x: 0, z: 4 })).toBe(false);
    expect(sees(90, { x: 0, z: 4 })).toBe(true);
    expect(sees(90, { x: 4, z: 0 })).toBe(false);
    expect(sees(200, { x: -4 * Math.cos(20 * DEG), z: -4 * Math.sin(20 * DEG) })).toBe(true);
    expect(sees(200, { x: 4, z: 0 })).toBe(false);
  });

  it('can be told to watch only robots', () => {
    const g = wired(
      [
        node('a', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3 }),
        node('b', 'robot-body', { position: { x: 4, y: 0.15, z: 0 }, height: 0.3 }),
        node('eye', 'vision-sensor', { range: 8, angle: 60, walls: 'no', filter: 'robot' }),
        FLOOR,
      ],
      [['a', 'self', 'eye', 'viewer']],
    );
    expect(run(g, '3d', 0.1).rt.getOutput('eye', 'seen')).toBe(true);
  });
});

describe('other sensors accept a robot chassis', () => {
  it('Đọc màu reads the box under the chassis and the box in front of it', () => {
    const red = TRAFFIC_COLORS[0];
    const under = wired(
      [node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3 }), node('c', 'color-sensor', {}), node('floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 20 }, type: 'solid', color: red })],
      [['body', 'self', 'c', 'who']],
    );
    expect(run(under, '3d', 0.2).rt.getOutput('c', 'index')).toBe(1);
    const ahead = wired(
      [
        node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: 90, height: 0.3 }),
        node('c', 'color-sensor', { where: 'ahead', want: 3 }),
        node('box', 'block', { position: { x: 0, y: 0.5, z: 2 }, size: { x: 1, y: 1, z: 1 }, type: 'solid', color: TRAFFIC_COLORS[2] }),
        FLOOR,
      ],
      [['body', 'self', 'c', 'who']],
    );
    const { rt } = run(ahead, '3d', 0.2);
    expect(rt.getOutput('c', 'index')).toBe(3);
    expect(rt.getOutput('c', 'match')).toBe(true);
  });

  it('Va chạm sees the chassis touch a wall', () => {
    const g = wired(
      [
        node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3 }),
        node('ml', 'motor', { side: -0.4 }),
        node('mr', 'motor', { side: 0.4 }),
        node('p', 'const', { value: 1 }),
        node('wall', 'block', { position: { x: 3, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 4 }, type: 'solid' }),
        node('t', 'touch', {}),
        FLOOR,
      ],
      [
        ['body', 'self', 'ml', 'body'],
        ['body', 'self', 'mr', 'body'],
        ['p', 'value', 'ml', 'power'],
        ['p', 'value', 'mr', 'power'],
        ['body', 'self', 't', 'a'],
        ['wall', 'self', 't', 'b'],
      ],
    );
    expect(run(g, '3d', 0.2).rt.getOutput('t', 'touching')).toBe(false);
    expect(run(g, '3d', 4).rt.getOutput('t', 'touching')).toBe(true);
  });

  it('Đo khoảng cách measures from the chassis', () => {
    const g = wired(
      [
        node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3 }),
        node('wall', 'block', { position: { x: 5, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, type: 'solid' }),
        node('d', 'distance', { threshold: 6 }),
        FLOOR,
      ],
      [
        ['body', 'self', 'd', 'a'],
        ['wall', 'self', 'd', 'b'],
      ],
    );
    const { rt } = run(g, '3d', 0.1);
    expect(rt.getOutput('d', 'distance') as number).toBeCloseTo(5, 1); // the chassis has settled a little lower than the wall's centre
    expect(rt.getOutput('d', 'within')).toBe(true);
  });

  it('Vùng kích hoạt follows a chassis, turns with it, and can count robots', () => {
    const make = (headingDeg: number, rotate: string): boolean => {
      const g = wired(
        [
          node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: headingDeg, height: 0.3 }),
          // 2 m ahead of the nose (in the chassis frame), 1 m wide
          node('z', 'zone', { center: { x: 2, y: 0, z: 0 }, size: { x: 1, y: 2, z: 1 }, filter: 'character', rotate }),
          node('p', 'character', { position: { x: 0, y: 0.15, z: 2 } }),
          FLOOR,
        ],
        [['body', 'self', 'z', 'follow']],
      );
      return run(g, '3d', 0.1).rt.getOutput('z', 'inside') as boolean;
    };
    expect(make(90, 'yes')).toBe(true); // nose points to +z: the zone sits at z = 2
    expect(make(90, 'no')).toBe(false);
    expect(make(0, 'yes')).toBe(false);
    const g = wired(
      [
        node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3 }),
        node('z', 'zone', { center: { x: 0, y: 0, z: 0 }, size: { x: 3, y: 2, z: 3 }, filter: 'robot' }),
        FLOOR,
      ],
      [['body', 'self', 'z', 'follow']],
    );
    expect(run(g, '3d', 0.1).rt.getOutput('z', 'count')).toBe(1);
  });
});
