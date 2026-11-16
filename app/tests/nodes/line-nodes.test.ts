import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView, type LineTrackSpec, type Params, type PortValues, type ViewMode } from '../../src/engine/types';
import { tryLineSensor } from '../../src/handbook/boards-robot-line';
import { registerAllNodes } from '../../src/nodes';
import { lineSensorNode } from '../../src/nodes/line-sensor';
import { lineTrackNode, trackSpecOf } from '../../src/nodes/line-track';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld, type FakeWorld } from './fake-world';

beforeAll(() => registerAllNodes());

/** A vertical line (along z) at x = 3, 0.2 m wide, in the plane of the top-down view. */
const lineAtX3: LineTrackSpec = { path: [{ u: 3, v: -6 }, { u: 3, v: 6 }], closed: false, width: 0.2 };

function addTrack(w: FakeWorld, id: string, track: LineTrackSpec): void {
  w.entities.set(id, { id, kind: 'block', ownerNodeId: id, position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 0.02, z: 1 }, color: '#111111', look: 'line-track', zone: true, track, visible: true });
}

function addHero(w: FakeWorld, over: Partial<EntityView> = {}): void {
  w.entities.set('hero', {
    id: 'hero',
    kind: 'character',
    ownerNodeId: 'hero',
    position: { x: 2, y: 0.5, z: 0 },
    size: { x: 0.6, y: 1, z: 0.6 },
    color: '#ef4444',
    facing: { x: 1, z: 0 },
    visible: true,
    ...over,
  });
}

/** Runs the sensor for the given ticks on a fake world; every tick returns the outputs. */
function read(w: FakeWorld, inputs: PortValues, params: Params = {}, mode: ViewMode = '2d-top', ticks = 1): PortValues[] {
  const p = defaultParams(lineSensorNode, params);
  const state = lineSensorNode.create!(makeCtx(w), p);
  const out: PortValues[] = [];
  for (let t = 0; t < ticks; t++) out.push(lineSensorNode.evaluate({ ...makeCtx(w, { tick: t }), mode }, inputs, p, state));
  return out;
}

describe('line sensor: where the eye looks', () => {
  it('reads the spot ahead of the nose, and the spot turns with the way the object faces', () => {
    const cases: [string, { x: number; z: number }, boolean][] = [
      ['facing +x reaches the line at x = 3', { x: 1, z: 0 }, true],
      ['facing -x looks away', { x: -1, z: 0 }, false],
      ['facing +z looks along the line, not at it', { x: 0, z: 1 }, false],
      ['facing -z looks along the line, not at it', { x: 0, z: -1 }, false],
    ];
    for (const [name, facing, expected] of cases) {
      const w = makeWorld();
      addTrack(w, 't1', lineAtX3);
      addHero(w, { facing });
      const [o] = read(w, { who: 'hero' }, { forward: 1, side: 0 });
      expect(o!.onLine, name).toBe(expected);
    }
  });

  it('a side offset is to the right of the facing (negative = left) and rotates with it', () => {
    const lookWith = (facing: { x: number; z: number }, side: number): boolean => {
      const w = makeWorld();
      addTrack(w, 't1', lineAtX3);
      // Standing at x = 2 and 1 m to the side of a nose pointing along z: the eye is at x = 2 -+ 1
      addHero(w, { facing });
      return read(w, { who: 'hero' }, { forward: 0, side })[0]!.onLine === true;
    };
    // Facing +z, the right hand points to -x and the left hand to +x (top view, z down).
    expect(lookWith({ x: 0, z: 1 }, -1)).toBe(true);
    expect(lookWith({ x: 0, z: 1 }, 1)).toBe(false);
    // Turn around: facing -z swaps the hands.
    expect(lookWith({ x: 0, z: -1 }, 1)).toBe(true);
    expect(lookWith({ x: 0, z: -1 }, -1)).toBe(false);
    // Facing +x, a side offset moves the eye along z, which stays on this vertical line only for a zero forward offset.
    expect(lookWith({ x: 1, z: 0 }, 1)).toBe(false);
  });

  it('follows a vehicle by the way its nose points', () => {
    const w = makeWorld();
    addTrack(w, 't1', lineAtX3);
    addHero(w, { kind: 'vehicle', facing: undefined, vehicle: { model: 'car', speed: 0, wheelSpin: 0, heading: 0, driver: null } });
    expect(read(w, { who: 'hero' }, { forward: 1 })[0]!.onLine).toBe(true);
    addHero(w, { kind: 'vehicle', facing: undefined, vehicle: { model: 'car', speed: 0, wheelSpin: 0, heading: Math.PI, driver: null } });
    expect(read(w, { who: 'hero' }, { forward: 1 })[0]!.onLine).toBe(false);
  });

  it('with no facing at all the object counts as looking along +x', () => {
    const w = makeWorld();
    addTrack(w, 't1', lineAtX3);
    addHero(w, { kind: 'block', facing: undefined });
    expect(read(w, { who: 'hero' }, { forward: 1 })[0]!.onLine).toBe(true);
  });
});

describe('line sensor: outputs', () => {
  it('is off, with no pulses, while "who" is unwired or points at nothing', () => {
    const w = makeWorld();
    addTrack(w, 't1', lineAtX3);
    for (const who of [null, 'ghost']) {
      for (const o of read(w, { who }, {}, '2d-top', 3)) expect(o).toEqual({ onLine: false, level: 0, entered: false, left: false });
    }
    // Inverted, an absent object still reads nothing rather than "all floor".
    expect(read(w, { who: null }, { invert: 'yes' })[0]!.level).toBe(0);
  });

  it('is off for a hidden object', () => {
    const w = makeWorld();
    addTrack(w, 't1', lineAtX3);
    addHero(w, { visible: false });
    expect(read(w, { who: 'hero' }, { forward: 1 })[0]!.onLine).toBe(false);
  });

  it('holds "onLine" while on the line and pulses "entered" and "left" once each', () => {
    const w = makeWorld();
    addTrack(w, 't1', lineAtX3);
    const p = defaultParams(lineSensorNode, { forward: 0, spot: 0.1 });
    const state = lineSensorNode.create!(makeCtx(w), p);
    const xs = [1, 1.5, 3, 3, 3, 4.5, 4.5];
    const seen = xs.map((x, t) => {
      addHero(w, { position: { x, y: 0.5, z: 0 } });
      return lineSensorNode.evaluate({ ...makeCtx(w, { tick: t }), mode: '2d-top' }, { who: 'hero' }, p, state);
    });
    expect(seen.map((o) => o.onLine)).toEqual([false, false, true, true, true, false, false]);
    expect(seen.map((o) => o.entered)).toEqual([false, false, true, false, false, false, false]);
    expect(seen.map((o) => o.left)).toEqual([false, false, false, false, false, true, false]);
  });

  it('level only grows while the eye moves onto the line edge, and the threshold decides "onLine"', () => {
    const w = makeWorld();
    addTrack(w, 't1', { ...lineAtX3, width: 2 });
    const p = defaultParams(lineSensorNode, { forward: 0, spot: 0.4, threshold: 0.5 });
    const state = lineSensorNode.create!(makeCtx(w), p);
    let prev = -1;
    let flips = 0;
    let wasOn = false;
    for (let k = 0; k <= 200; k++) {
      addHero(w, { position: { x: 1 + k * 0.005, y: 0.5, z: 0 } });
      const o = lineSensorNode.evaluate({ ...makeCtx(w, { tick: k }), mode: '2d-top' }, { who: 'hero' }, p, state);
      expect(o.level as number, `step ${k}`).toBeGreaterThanOrEqual(prev);
      prev = o.level as number;
      if (o.onLine !== wasOn) flips++;
      wasOn = o.onLine === true;
      expect(o.onLine, `step ${k}`).toBe((o.level as number) >= 0.5);
    }
    expect(flips).toBe(1);
  });

  it('a threshold of 0 still needs some line under the eye', () => {
    const w = makeWorld();
    addTrack(w, 't1', lineAtX3);
    addHero(w, { position: { x: -4, y: 0.5, z: 0 } });
    expect(read(w, { who: 'hero' }, { threshold: 0 })[0]!.onLine).toBe(false);
  });

  it('invert reads the floor instead of the line', () => {
    const w = makeWorld();
    addTrack(w, 't1', { ...lineAtX3, width: 2 });
    addHero(w, { position: { x: 3, y: 0.5, z: 0 } });
    const [on] = read(w, { who: 'hero' }, { forward: 0 });
    const [inv] = read(w, { who: 'hero' }, { forward: 0, invert: 'yes' });
    expect(on!.level).toBe(1);
    expect(inv!.level).toBe(0);
    expect(inv!.onLine).toBe(false);
    addHero(w, { position: { x: -5, y: 0.5, z: 0 } });
    expect(read(w, { who: 'hero' }, { forward: 0, invert: 'yes' })[0]).toMatchObject({ level: 1, onLine: true });
  });

  it('sees every line, or only the wired one', () => {
    const w = makeWorld();
    addTrack(w, 'near', lineAtX3);
    addTrack(w, 'far', { path: [{ u: -3, v: -6 }, { u: -3, v: 6 }], closed: false, width: 0.2 });
    addHero(w, { position: { x: -3, y: 0.5, z: 0 } });
    expect(read(w, { who: 'hero' }, { forward: 0 })[0]!.onLine).toBe(true);
    expect(read(w, { who: 'hero', track: 'far' }, { forward: 0 })[0]!.onLine).toBe(true);
    expect(read(w, { who: 'hero', track: 'near' }, { forward: 0 })[0]!.onLine).toBe(false);
    expect(read(w, { who: 'hero', track: 'ghost' }, { forward: 0 })[0]!.onLine).toBe(false);
  });

  it('in the side view reads along the floor from the feet', () => {
    const w = makeWorld();
    const strip: LineTrackSpec = { path: [{ u: 2, v: 0.5 }, { u: 6, v: 0.5 }], closed: false, width: 0.2 };
    addTrack(w, 't1', strip);
    addHero(w, { position: { x: 1, y: 1, z: 0 }, facing: { x: 1, z: 0 } });
    expect(read(w, { who: 'hero' }, { forward: 0.6 }, '2d-side')[0]!.onLine).toBe(false);
    addHero(w, { position: { x: 1.6, y: 1, z: 0 }, facing: { x: 1, z: 0 } });
    expect(read(w, { who: 'hero' }, { forward: 0.6 }, '2d-side')[0]!.onLine).toBe(true);
    // Facing left the eye looks the other way.
    addHero(w, { position: { x: 1.6, y: 1, z: 0 }, facing: { x: -1, z: 0 } });
    expect(read(w, { who: 'hero' }, { forward: 0.6 }, '2d-side')[0]!.onLine).toBe(false);
  });
});

describe('line sensor: marker dot', () => {
  it('appears once an object is wired, follows the spot, lights on the line and hides when the object goes', () => {
    const w = makeWorld();
    addTrack(w, 't1', lineAtX3);
    addHero(w);
    const p = defaultParams(lineSensorNode, { forward: 1 });
    const state = lineSensorNode.create!(makeCtx(w), p);
    const spawnedBefore = w.spawned.length;
    expect(state.dot).toBeNull();
    lineSensorNode.evaluate({ ...makeCtx(w), mode: '2d-top' }, { who: null }, p, state);
    expect(w.spawned).toHaveLength(spawnedBefore);
    lineSensorNode.evaluate({ ...makeCtx(w), mode: '2d-top' }, { who: 'hero' }, p, state);
    expect(w.spawned).toHaveLength(spawnedBefore + 1);
    expect(w.spawned.at(-1)).toMatchObject({ kind: 'block', solid: false, zone: true, look: 'line-dot' });
    const dot = state.dot!;
    expect(w.entities.get(dot)!.color).toBe('#22c55e');
    addHero(w, { position: { x: -4, y: 0.5, z: 0 } });
    lineSensorNode.evaluate({ ...makeCtx(w), mode: '2d-top' }, { who: 'hero' }, p, state);
    expect(w.entities.get(dot)!.color).toBe('#9ca3af');
    lineSensorNode.evaluate({ ...makeCtx(w), mode: '2d-top' }, { who: null }, p, state);
    expect(w.hidden).toEqual([dot]);
    lineSensorNode.evaluate({ ...makeCtx(w), mode: '2d-top' }, { who: 'hero' }, p, state);
    expect(w.shown).toEqual([dot]);
    expect(w.spawned).toHaveLength(spawnedBefore + 1);
  });
});

describe('line track node', () => {
  const params = (over: Params = {}): Params => defaultParams(lineTrackNode, over);

  it('paints a closed oval by default, in the plane of the view', () => {
    const top = trackSpecOf(params(), '2d-top');
    expect(top.closed).toBe(true);
    expect(top.width).toBeCloseTo(0.2, 9);
    const vs = top.path.map((p) => p.v);
    expect(Math.max(...vs)).toBeCloseTo(3, 1);
    // In the side view the line lies along the floor at the floor height.
    const side = trackSpecOf(params(), '2d-side');
    expect(new Set(side.path.map((p) => p.v))).toEqual(new Set([0.5]));
  });

  it('draws the points of "Tự vẽ", rounds the corners and honours "closed"', () => {
    const custom = params({ shape: 'custom', count: 3, p1: { x: 0, y: 0, z: 0 }, p2: { x: 6, y: 0, z: 0 }, p3: { x: 6, y: 0, z: 6 }, smooth: 'no' });
    const sharp = trackSpecOf({ ...custom, closed: 'no' }, '2d-top');
    expect(sharp.closed).toBe(false);
    expect(sharp.path).toHaveLength(3);
    const round = trackSpecOf({ ...custom, closed: 'no', smooth: 'yes', radius: 1 }, '2d-top');
    expect(round.path.length).toBeGreaterThan(3);
    expect(round.path[0]).toEqual({ u: 0, v: 0 });
    expect(trackSpecOf({ ...custom, closed: 'yes' }, '2d-top').closed).toBe(true);
  });

  it('keeps every setting inside its range', () => {
    const wild = trackSpecOf(params({ shape: 'custom', count: 999, width: 99, radius: 99, p1: { x: Number.NaN, y: 0, z: 1 } }), '2d-top');
    expect(wild.width).toBe(3);
    expect(wild.path.every((p) => Number.isFinite(p.u) && Number.isFinite(p.v))).toBe(true);
    expect(trackSpecOf(params({ width: 0 }), '2d-top').width).toBeGreaterThan(0);
    expect(trackSpecOf(params({ shape: 'nonsense' }), '2d-top').closed).toBe(true);
  });

  it('spawns one non-solid zone box with the line on it, and nothing ever collides with it', () => {
    const w = makeWorld();
    const state = lineTrackNode.create!(makeCtx(w), params());
    const spec = w.spawned[0]!;
    expect(spec).toMatchObject({ kind: 'block', solid: false, zone: true, look: 'line-track', color: '#111111' });
    expect(spec.track?.closed).toBe(true);
    expect(lineTrackNode.evaluate(makeCtx(w), {}, params(), state)).toEqual({ self: state.id });
  });
});

describe('in a real world', () => {
  it('a character that walks the oval top edge sees the line, then loses it', () => {
    const board = tryLineSensor();
    const world = createWorld(board.mode);
    const rt = createRuntime(board.graph, world, board.mode);
    const eyeL = board.graph.nodes.find((n) => n.kind === 'line-sensor' && (n.params.side as number) < 0)!.id;
    const eyeR = board.graph.nodes.find((n) => n.kind === 'line-sensor' && (n.params.side as number) > 0)!.id;
    const levels: { l: number; r: number }[] = [];
    for (let i = 0; i < 60 * 8; i++) {
      rt.tick({ keysDown: new Set(['ArrowRight', 'KeyD']) });
      world.step(TICK_DT);
      levels.push({ l: rt.getOutput(eyeL, 'level') as number, r: rt.getOutput(eyeR, 'level') as number });
    }
    // Both eyes straddle the line at the start: neither is fully on it, but the line is under them.
    expect(Math.max(...levels.slice(0, 30).map((v) => v.l + v.r))).toBeGreaterThan(0);
    // Walking straight ahead leaves the oval for good.
    expect(levels.slice(-30).every((v) => v.l === 0 && v.r === 0)).toBe(true);
    // The marker dots are drawn while playing and the line itself is one flat non-solid entity.
    const dots = world.entities().filter((e) => e.visible && e.look === 'line-dot');
    expect(dots).toHaveLength(2);
    const lines = world.entities().filter((e) => e.track);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.look).toBe('line-track');
    // the marker floats above the paint so the paint never hides it
    for (const d of dots) expect(d.position.y).toBeGreaterThan(lines[0]!.position.y);
  });
});
