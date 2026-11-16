import { beforeAll, describe, expect, it } from 'vitest';
import { activeInputs, activeOutputs, getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { addWire } from '../../src/engine/wiring';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Params, type ViewMode } from '../../src/engine/types';
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
const R = 0.15;
const WHEEL_M = 2 * Math.PI * R;

interface Run {
  rt: ReturnType<typeof createRuntime>;
  robot: () => EntityView;
  views: () => readonly EntityView[];
  /** Plays on for `seconds`, holding Space during [from, to) seconds of the whole run. */
  play: (seconds: number, press?: [number, number]) => void;
}

function start(graph: Graph, mode: ViewMode): Run {
  const world = createWorld(mode);
  const rt = createRuntime(graph, world, mode);
  let tick = 0;
  return {
    rt,
    robot: () => world.entities().find((e) => e.kind === 'robot')!,
    views: () => world.entities(),
    play(seconds, press) {
      for (let i = 0; i < Math.round(seconds / TICK_DT); i++, tick++) {
        const t = tick * TICK_DT;
        const down = press && t >= press[0] && t < press[1];
        rt.tick({ keysDown: new Set(down ? ['Space'] : []) });
        world.step(TICK_DT);
      }
    },
  };
}

/** Two motors at the given constant powers; each can have its encoder or the odometer switched on. */
function twoMotors(left: number, right: number, over: { body?: Params; motor?: Params; wires?: W[]; extra?: GraphNode[] } = {}): Graph {
  return wired(
    [
      node('body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3, ...over.body }),
      node('ml', 'motor', { side: -0.4, ...over.motor }),
      node('mr', 'motor', { side: 0.4 }),
      node('pl', 'const', { value: left }),
      node('pr', 'const', { value: right }),
      node('key', 'key', { key: 'Space' }),
      FLOOR,
      ...(over.extra ?? []),
    ],
    [
      ['body', 'self', 'ml', 'body'],
      ['body', 'self', 'mr', 'body'],
      ['pl', 'value', 'ml', 'power'],
      ['pr', 'value', 'mr', 'power'],
      ...(over.wires ?? []),
    ],
  );
}

describe('encoder: motor turns', () => {
  it('adds no ports to a motor card unless the counter is switched on', () => {
    const def = getNodeDef('motor')!;
    expect(activeOutputs(def, {}).map((p) => p.id)).toEqual(['rpm', 'turning']);
    expect(activeInputs(def, {}).map((p) => p.id)).toEqual(['body', 'power']);
    expect(activeOutputs(def, { showTurns: 'yes' }).map((p) => p.id)).toEqual(['rpm', 'turning', 'turns']);
    expect(activeInputs(def, { showTurns: 'yes' }).map((p) => p.id)).toEqual(['body', 'power', 'resetTurns']);
  });

  it('counts wheel revolutions: rpm integrated over time (ramp included)', () => {
    const r = start(twoMotors(1, 1, { motor: { showTurns: 'yes' } }), '2d-top');
    r.play(3);
    // default accel 400 rpm/s: 0.3 s ramp to 120 rpm, then 2 turns per second -> 2 * (3 - 0.15)
    expect(r.rt.getOutput('ml', 'turns') as number).toBeCloseTo(2 * (3 - 0.15), 1);
  });

  it('turns match the distance: turns x wheel circumference = path of a straight run', () => {
    const r = start(twoMotors(1, 1, { motor: { showTurns: 'yes' }, body: { friction: 2, mass: 0.5 } }), '2d-top');
    r.play(4);
    const turns = r.rt.getOutput('ml', 'turns') as number;
    // the chassis follows the wheels within a fraction of a second, so the path is a little under turns x circumference
    expect(r.robot().position.x).toBeLessThan(turns * WHEEL_M);
    expect(r.robot().position.x).toBeGreaterThan(turns * WHEEL_M - 0.5);
  });

  it('a custom wheel size and speed still give rpm / 60 turns per second', () => {
    const r = start(twoMotors(0.5, 0.5, { motor: { showTurns: 'yes', maxRpm: 60, accel: 10000 } }), '2d-top');
    r.play(2);
    // power 0.5 of 60 rpm = 30 rpm = 0.5 turn per second (ramp is a few ms)
    expect(r.rt.getOutput('ml', 'turns') as number).toBeCloseTo(1, 1);
  });

  it('is signed: reversing counts down', () => {
    const r = start(twoMotors(-1, -1, { motor: { showTurns: 'yes' } }), '2d-top');
    r.play(2);
    expect(r.rt.getOutput('ml', 'turns') as number).toBeLessThan(-3);
    const rev = start(twoMotors(1, 1, { motor: { showTurns: 'yes', reverse: 'reversed' } }), '2d-top');
    rev.play(2);
    expect(rev.rt.getOutput('ml', 'turns') as number).toBeLessThan(-3);
  });

  it('a pulse on "Đặt lại vòng" sets the count back to zero and it counts on from there', () => {
    const g = twoMotors(1, 1, { motor: { showTurns: 'yes' }, wires: [['key', 'held', 'ml', 'resetTurns']] });
    const r = start(g, '2d-top');
    r.play(3, [2, 2.1]);
    // reset at 2 s: about 1 s of 2 turns per second has been counted since
    const turns = r.rt.getOutput('ml', 'turns') as number;
    expect(turns).toBeGreaterThan(1.7);
    expect(turns).toBeLessThan(2.1);
  });

  it('the reset is a pulse: holding it does not freeze the count', () => {
    const g = twoMotors(1, 1, { motor: { showTurns: 'yes' }, wires: [['key', 'held', 'ml', 'resetTurns']] });
    const r = start(g, '2d-top');
    r.play(2, [0.5, 100]);
    // reset once at 0.5 s, then 1.5 s at 2 turns per second
    expect(r.rt.getOutput('ml', 'turns') as number).toBeCloseTo(3, 1);
  });
});

describe('odometer: chassis distance', () => {
  it('adds no ports to a chassis card unless switched on', () => {
    const def = getNodeDef('robot-body')!;
    expect(activeOutputs(def, {}).map((p) => p.id)).toEqual(['self', 'speed', 'heading', 'turnRate']);
    expect(activeInputs(def, {})).toEqual([]);
    expect(activeOutputs(def, { showDistance: 'yes' }).map((p) => p.id)).toEqual(['self', 'speed', 'heading', 'turnRate', 'distance']);
    expect(activeInputs(def, { showDistance: 'yes' }).map((p) => p.id)).toEqual(['resetDistance']);
    expect(activeOutputs(def, { showPayload: 'yes' }).map((p) => p.id)).toEqual(['self', 'speed', 'heading', 'turnRate', 'payload', 'overloaded']);
  });

  it('measures the ground path of a straight run', () => {
    const r = start(twoMotors(1, 1, { body: { showDistance: 'yes' } }), '2d-top');
    r.play(3);
    // the output is read before the last step moves the chassis, so it trails the position by one tick (0.03 m at full speed)
    expect(r.rt.getOutput('body', 'distance') as number).toBeCloseTo(r.robot().position.x, 1);
    expect(r.rt.getOutput('body', 'distance') as number).toBeGreaterThan(4);
  });

  it('follows a curve by its length, not the straight line to the end', () => {
    const r = start(twoMotors(1, 0.5, { body: { showDistance: 'yes' } }), '2d-top');
    r.play(6);
    const e = r.robot();
    const straight = Math.hypot(e.position.x, e.position.z);
    const speed = (120 * WHEEL_M) / 60;
    const path = r.rt.getOutput('body', 'distance') as number;
    expect(path).toBeGreaterThan(straight);
    // the middle of the chassis runs at the mean of the two wheel speeds, a little under it for the first tenth of a second
    expect(path).toBeLessThan(speed * 0.75 * 6);
    expect(path).toBeGreaterThan(speed * 0.75 * 6 - 0.6);
  });

  it('turning on the spot adds almost nothing', () => {
    const r = start(twoMotors(1, -1, { body: { showDistance: 'yes' } }), '2d-top');
    r.play(3);
    expect(r.rt.getOutput('body', 'distance') as number).toBeLessThan(0.05);
  });

  it('a pulse on "Đặt lại quãng đường" starts counting again', () => {
    const g = twoMotors(1, 1, { body: { showDistance: 'yes' }, wires: [['key', 'held', 'body', 'resetDistance']] });
    const r = start(g, '2d-top');
    r.play(3, [2, 2.05]);
    const x = r.robot().position.x;
    const d = r.rt.getOutput('body', 'distance') as number;
    // about one second of 1.885 m/s since the reset
    expect(d).toBeGreaterThan(1.6);
    expect(d).toBeLessThan(2.0);
    expect(x).toBeGreaterThan(d + 2);
  });

  it('the side view counts along x only', () => {
    const r = start(twoMotors(1, 1, { body: { showDistance: 'yes' } }), '2d-side');
    r.play(2);
    expect(r.rt.getOutput('body', 'distance') as number).toBeCloseTo(r.robot().position.x, 1);
  });
});

describe('payload and overload on the chassis piece', () => {
  const crate = (kg: number): GraphNode => node('crate', 'item', { position: { x: 0.2, y: 0.5, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: kg });

  it('reports what rides on top (kg) and carries it along', () => {
    const r = start(twoMotors(1, 1, { body: { showPayload: 'yes' }, extra: [crate(3)] }), '3d');
    r.play(2);
    expect(r.rt.getOutput('body', 'payload')).toBeCloseTo(3, 6);
    expect(r.rt.getOutput('body', 'overloaded')).toBe(false);
    const bot = r.robot();
    const c = r.views().find((e) => e.kind === 'item')!;
    expect(bot.position.x).toBeGreaterThan(1);
    expect(c.position.x - bot.position.x).toBeCloseTo(0.2, 1);
  });

  it('a heavier payload makes the same board accelerate slower', () => {
    const light = start(twoMotors(1, 1, { extra: [crate(0.5)] }), '3d');
    const heavy = start(twoMotors(1, 1, { extra: [crate(15)] }), '3d');
    light.play(0.5);
    heavy.play(0.5);
    expect(heavy.robot().position.x).toBeLessThan(light.robot().position.x * 0.6);
  });

  it('above the maximum payload it cannot move and says so', () => {
    const r = start(twoMotors(1, 1, { body: { showPayload: 'yes', maxPayload: 4 }, extra: [crate(6)] }), '3d');
    r.play(2);
    expect(r.robot().position.x).toBeCloseTo(0, 6);
    expect(r.rt.getOutput('body', 'overloaded')).toBe(true);
    expect(r.rt.getOutput('body', 'payload')).toBeCloseTo(6, 6);
    const ok = start(twoMotors(1, 1, { body: { showPayload: 'yes', maxPayload: 8 }, extra: [crate(6)] }), '3d');
    ok.play(2);
    expect(ok.robot().position.x).toBeGreaterThan(0.5);
    expect(ok.rt.getOutput('body', 'overloaded')).toBe(false);
  });

  it('with no payload the robot behaves exactly as before (maxPayload only matters when loaded)', () => {
    const a = start(twoMotors(1, 0.6), '3d');
    const b = start(twoMotors(1, 0.6, { body: { maxPayload: 3, showPayload: 'yes' } }), '3d');
    a.play(3);
    b.play(3);
    expect(b.robot().position).toEqual(a.robot().position);
    expect(b.robot().robot!.heading).toBe(a.robot().robot!.heading);
  });

  it('the top-down view has no stacking, so nothing loads the chassis there', () => {
    const r = start(twoMotors(1, 1, { body: { showPayload: 'yes', maxPayload: 1 }, extra: [crate(6)] }), '2d-top');
    r.play(1);
    expect(r.rt.getOutput('body', 'payload')).toBe(0);
    expect(r.robot().position.x).toBeGreaterThan(0.5);
  });
});
