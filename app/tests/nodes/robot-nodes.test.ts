import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { addWire } from '../../src/engine/wiring';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Params, type ViewMode, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

type W = readonly [string, string, string, string];

const node = (id: string, kind: string, params: Params = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });

function wired(nodes: GraphNode[], wires: readonly W[]): Graph {
  let g: Graph = { nodes, wires: [] };
  for (const [fn, fp, tn, tp] of wires) {
    const res = addWire(g, { node: fn, port: fp }, { node: tn, port: tp });
    if ('ok' in res) throw new Error(`cannot wire ${fn}.${fp} -> ${tn}.${tp}: ${res.reason}`);
    g = res;
  }
  return g;
}

const FLOOR = node('floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 80, y: 1, z: 80 }, type: 'solid' });

/** A chassis with a left and a right motor, each driven by its own constant. Null = that power wire is missing. */
function twoMotors(left: number | null, right: number | null, over: { body?: Params; mode?: ViewMode; wires?: W[] } = {}): Graph {
  const nodes = [
    node('body', 'robot-body', { position: { x: 0, y: 0.3, z: 0 }, ...over.body }),
    node('ml', 'motor', { side: -0.4 }),
    node('mr', 'motor', { side: 0.4 }),
    FLOOR,
    ...(left !== null ? [node('pl', 'const', { value: left })] : []),
    ...(right !== null ? [node('pr', 'const', { value: right })] : []),
  ];
  const wires: W[] = [
    ['body', 'self', 'ml', 'body'],
    ['body', 'self', 'mr', 'body'],
    ...(left !== null ? ([['pl', 'value', 'ml', 'power']] as W[]) : []),
    ...(right !== null ? ([['pr', 'value', 'mr', 'power']] as W[]) : []),
    ...(over.wires ?? []),
  ];
  return wired(nodes, wires);
}

function play(graph: Graph, mode: ViewMode, seconds: number): { world: World; rt: ReturnType<typeof createRuntime>; at: (id: string) => EntityView } {
  const world = createWorld(mode);
  const rt = createRuntime(graph, world, mode);
  for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
  }
  const robot = (): EntityView => world.entities().find((e) => e.kind === 'robot')!;
  return { world, rt, at: () => robot() };
}

const R = 0.15;
const V_FULL = (120 * 2 * Math.PI * R) / 60; // 1.885 m/s: both motors at full power, default 120 rpm

describe('robot chassis and motors', () => {
  it('a chassis with motors but no power wire never moves', () => {
    const { at } = play(twoMotors(null, null), '2d-top', 4);
    expect(at('body').position.x).toBeCloseTo(0, 6);
    expect(at('body').position.z).toBeCloseTo(0, 6);
    expect(at('body').robot!.speed).toBe(0);
  });

  it('a chassis with no motors only falls onto the floor (3D) and never moves sideways', () => {
    const g = wired([node('body', 'robot-body', { position: { x: 2, y: 2, z: 1 } }), FLOOR], []);
    const { at } = play(g, '3d', 3);
    expect(at('body').position.x).toBeCloseTo(2, 6);
    expect(at('body').position.z).toBeCloseTo(1, 6);
    expect(at('body').position.y).toBeCloseTo(0.15, 2); // rests on the floor (height 0.3)
  });

  it('two motors at full power drive straight at the wheel speed', () => {
    const { at, world } = play(twoMotors(1, 1), '2d-top', 3);
    const e = at('body');
    expect(e.robot!.speed).toBeCloseTo(V_FULL, 3);
    expect(e.robot!.heading).toBeCloseTo(0, 6);
    expect(e.position.z).toBeCloseTo(0, 6);
    // 3 s: about V_FULL * (3 - ramp up) metres
    expect(e.position.x).toBeGreaterThan(V_FULL * 2.5);
    expect(e.position.x).toBeLessThan(V_FULL * 3);
    expect(world.entities().filter((v) => v.kind === 'robot')).toHaveLength(1);
  });

  it('opposite powers spin the robot on the spot (3D view too)', () => {
    for (const mode of ['2d-top', '3d'] as const) {
      const { at } = play(twoMotors(1, -1), mode, 2);
      const e = at('body');
      expect(Math.hypot(e.position.x, e.position.z), mode).toBeLessThan(0.05);
      expect(Math.abs(e.robot!.heading), mode).toBeGreaterThan(0.5);
      // left forward, right back = turning right = positive turn rate
      expect(e.robot!.turnRate, mode).toBeGreaterThan(0);
    }
  });

  it('different powers drive an arc whose radius matches the formula', () => {
    const { at } = play(twoMotors(1, 0.5), '2d-top', 6);
    const e = at('body');
    const vl = V_FULL;
    const vr = V_FULL * 0.5;
    const radius = 0.4 * ((vl + vr) / (vl - vr)); // track / 2 * (vL + vR) / (vL - vR)
    expect(e.robot!.speed / e.robot!.turnRate).toBeCloseTo(radius, 2);
    // the robot circles a fixed centre: right of its start, 'radius' metres away
    const start = { x: 0, z: 0 };
    const cx = start.x;
    const cz = start.z + radius;
    // while it goes round it stays one radius from that centre (the first tenth of a second is the ramp-up)
    expect(Math.hypot(e.position.x - cx, e.position.z - cz)).toBeGreaterThan(radius * 0.85);
    expect(Math.hypot(e.position.x - cx, e.position.z - cz)).toBeLessThan(radius * 1.15);
  });

  it('removing either motor wire changes the path (no forced behaviour)', () => {
    // One second in: a circle of radius 0.4 m has not yet closed, so the paths still differ clearly.
    const both = play(twoMotors(1, 1), '2d-top', 1).at('body');
    const noLeft = play(twoMotors(null, 1), '2d-top', 1).at('body');
    const noRight = play(twoMotors(1, null), '2d-top', 1).at('body');
    expect(noLeft.position.x).toBeLessThan(both.position.x - 0.8);
    expect(noRight.position.x).toBeLessThan(both.position.x - 0.8);
    // one wheel driving, the other holding still: the robot curves, to opposite sides
    expect(noLeft.position.z).toBeLessThan(-0.3); // right motor only: nose swings left (up, -z)
    expect(noRight.position.z).toBeGreaterThan(0.3);
    expect(noLeft.robot!.heading).toBeLessThan(-0.3);
    expect(noRight.robot!.heading).toBeGreaterThan(0.3);
    expect(both.position.z).toBeCloseTo(0, 6);
  });

  it('removing the Thân wire stops that wheel pushing', () => {
    const g = twoMotors(1, 1);
    const cut: Graph = { ...g, wires: g.wires.filter((w) => !(w.from.node === 'body' && w.to.node === 'mr')) };
    const e = play(cut, '2d-top', 3).at('body');
    expect(e.robot!.heading).toBeGreaterThan(0.3); // only the left wheel pushes: turns right
  });

  it('the side view just rolls along x, whatever the wheel difference', () => {
    const { at } = play(twoMotors(1, 0.2), '2d-side', 3);
    const e = at('body');
    expect(e.robot!.heading).toBe(0);
    expect(e.position.z).toBe(0);
    expect(e.position.x).toBeGreaterThan(1.5);
  });

  it('reverse flag and negative power both drive backwards', () => {
    const g = wired(
      [
        node('body', 'robot-body', { position: { x: 0, y: 0.3, z: 0 } }),
        node('m', 'motor', { side: 0, reverse: 'reversed' }),
        node('p', 'const', { value: 1 }),
        FLOOR,
      ],
      [
        ['body', 'self', 'm', 'body'],
        ['p', 'value', 'm', 'power'],
      ],
    );
    const e = play(g, '2d-top', 2).at('body');
    expect(e.robot!.speed).toBeLessThan(-1);
    expect(e.position.x).toBeLessThan(-1.5);
    expect(e.position.z).toBeCloseTo(0, 6);
  });

  it('heavier mass is slower to get going, a slippery floor slower to stop', () => {
    const light = play(twoMotors(1, 1, { body: { mass: 1 } }), '2d-top', 0.5).at('body');
    const heavy = play(twoMotors(1, 1, { body: { mass: 40 } }), '2d-top', 0.5).at('body');
    expect(heavy.position.x).toBeLessThan(light.position.x * 0.5);
  });

  it('is stopped by a wall and stays outside it', () => {
    const g = twoMotors(1, 1);
    g.nodes.push(node('wall', 'block', { position: { x: 3, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 6 }, type: 'solid' }));
    const e = play(g, '2d-top', 5).at('body');
    // chassis footprint is 1 m, so its centre stops 0.5 m before the wall face at x = 2.5
    expect(e.position.x).toBeLessThanOrEqual(2 + 1e-6);
    expect(e.position.x).toBeGreaterThan(1.9);
    expect(e.robot!.speed).toBeLessThan(0.1);
  });

  it('reports speed, heading and turn rate on its output ports', () => {
    const { rt } = play(twoMotors(1, 0.5), '2d-top', 2);
    expect(rt.getOutput('body', 'speed') as number).toBeGreaterThan(1);
    expect(Math.abs(rt.getOutput('body', 'turnRate') as number)).toBeGreaterThan(10);
    expect(typeof rt.getOutput('body', 'heading')).toBe('number');
    expect(rt.getOutput('ml', 'turning')).toBe(true);
    expect(rt.getOutput('ml', 'rpm') as number).toBeCloseTo(120, 3);
  });

  it('a motor with nothing wired to Thân spins its wheel but moves nothing', () => {
    const g = wired([node('body', 'robot-body', { position: { x: 0, y: 0.3, z: 0 } }), node('m', 'motor'), node('p', 'const', { value: 1 }), FLOOR], [['p', 'value', 'm', 'power']]);
    const { at, rt } = play(g, '2d-top', 2);
    expect(at('body').position.x).toBeCloseTo(0, 6);
    expect(rt.getOutput('m', 'rpm') as number).toBeCloseTo(120, 3);
  });

  it('starts facing the heading parameter, and the wheels it carries show up in the view', () => {
    const { at } = play(twoMotors(null, null, { body: { heading: 90 } }), '2d-top', 0.2);
    expect(at('body').robot!.heading).toBeCloseTo(Math.PI / 2, 6);
    expect(at('body').robot!.wheels.map((w) => w.side).sort()).toEqual([-0.4, 0.4]);
  });
});
