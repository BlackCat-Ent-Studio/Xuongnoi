import { describe, expect, it } from 'vitest';
import { level07 } from '../../src/puzzle/levels/level-07';
import { runLevel } from '../../src/puzzle/run-level';
import { GRAB_REACH } from '../../src/nodes/carry';
import type { EntityView, Params, World } from '../../src/engine/types';
import type { PuzzleAnswer } from '../../src/puzzle/types';

const sol = level07.solution;
const TICK = 1 / 60;
/** Planar distance per tick below which the robot counts as standing still (0.6 units/s). */
const STILL_STEP = 0.01;

function withWant(a: PuzzleAnswer, want: number): PuzzleAnswer {
  const p: Params = { want };
  return { ...a, nodes: a.nodes.map((n) => (n.kind === 'color-sensor' ? { ...n, params: { ...n.params, ...p } } : n)) };
}

interface Grab {
  tick: number;
  robot: { x: number; z: number };
  crate: EntityView;
  crateStart: { x: number; z: number };
  /** Distance the robot moved on the tick of the grab (it has stopped by then). */
  stepBefore: number;
  /** Biggest jump of the carried crate between two ticks during the first second after the grab. */
  crateJump: number;
  /** Which way the robot looks (z) when it lifts the crate. */
  faceZ: number;
}
interface Trace {
  outcome: string;
  seconds: number;
  grabs: Grab[];
  /** Per tick: robot x and whether the hands were full. */
  xs: number[];
  full: boolean[];
  /** Ticks at which the robot stood still, with its x. */
  stills: { tick: number; x: number; faceZ: number }[];
  dropTicks: number[];
}

function trace(answer: PuzzleAnswer, limit = level07.timeLimit): Trace {
  const starts = new Map<string, { x: number; z: number }>();
  const t: Trace = { outcome: '', seconds: 0, grabs: [], xs: [], full: [], stills: [], dropTicks: [] };
  let prev: { x: number; z: number } | null = null;
  let prevHeld: string | null = null;
  const carriedAt = new Map<string, { x: number; z: number }>();
  const watching: { g: Grab; until: number }[] = [];
  const result = runLevel(level07, answer, limit, (world: World, tick) => {
    const all = world.listEntities();
    const robot = all.find((e) => e.kind === 'character')!;
    for (const e of all) if (e.kind === 'item' && !starts.has(e.id)) starts.set(e.id, { x: e.position.x, z: e.position.z });
    const step = prev ? Math.hypot(robot.position.x - prev.x, robot.position.z - prev.z) : 0;
    const held = world.heldItem(robot.id);
    if (held !== null && prevHeld === null) {
      const crate = world.getEntity(held)!;
      const g: Grab = { tick, robot: { x: robot.position.x, z: robot.position.z }, crate, crateStart: starts.get(held)!, stepBefore: step, crateJump: 0, faceZ: robot.facing?.z ?? 0 };
      t.grabs.push(g);
      watching.push({ g, until: tick + 60 });
    }
    for (const w of watching) {
      if (tick > w.until) continue;
      const c = world.getEntity(w.g.crate.id)!;
      const before = carriedAt.get(c.id);
      if (before) w.g.crateJump = Math.max(w.g.crateJump, Math.hypot(c.position.x - before.x, c.position.z - before.z));
      carriedAt.set(c.id, { x: c.position.x, z: c.position.z });
    }
    if (held === null && prevHeld !== null) t.dropTicks.push(tick);
    if (step < STILL_STEP) t.stills.push({ tick, x: robot.position.x, faceZ: robot.facing?.z ?? 0 });
    t.xs.push(robot.position.x);
    t.full.push(held !== null);
    prev = { x: robot.position.x, z: robot.position.z };
    prevHeld = held;
  });
  t.outcome = result.outcome;
  t.seconds = result.seconds;
  return t;
}

const PAD_X = [-6, -3, 0, 3, 6, 9];

describe('level 7: stop at the pad, grab only while standing at it', () => {
  const run = trace(sol);

  it('the reference solution wins inside the time limit', () => {
    expect(run.outcome).toBe('win');
    expect(run.seconds).toBeLessThan(level07.timeLimit);
  });

  it('removing each solution wire fails, and want=1 (red) loses', { timeout: 120_000 }, () => {
    for (const w of sol.wires) {
      expect(runLevel(level07, { ...sol, wires: sol.wires.filter((x) => x.id !== w.id) }).outcome, `without ${w.id}`).not.toBe('win');
    }
    expect(runLevel(level07, withWant(sol, 1)).outcome).toBe('lose');
  });

  it('never grabs while walking: the robot has stopped on a pad, with the crate within hand reach', () => {
    expect(run.grabs.length).toBe(3);
    for (const g of run.grabs) {
      expect(g.stepBefore, `step before grab at tick ${g.tick}`).toBeLessThan(STILL_STEP);
      expect(g.crateJump, `crate jump after grab at tick ${g.tick}`).toBeLessThan(0.3);
      const pad = PAD_X.find((x) => Math.abs(x - g.robot.x) < 0.3);
      expect(pad, `robot at ${g.robot.x} is not on a pad`).toBeDefined();
      expect(Math.hypot(g.crateStart.x - g.robot.x, g.crateStart.z - g.robot.z)).toBeLessThanOrEqual(GRAB_REACH);
      expect(g.crateStart.x).toBeCloseTo(pad!, 5);
    }
  });

  it('colour alone never lifts a crate mid-walk: the crates are out of reach when the robot steps onto a tile', () => {
    const colourOnly: PuzzleAnswer = {
      nodes: sol.nodes.filter((n) => n.id !== 's-and'),
      wires: sol.wires.filter((w) => w.id !== 'sw5' && w.id !== 'sw6' && w.id !== 'sw8').concat({ id: 'x', from: { node: 's-eye', port: 'match' }, to: { node: 's-hands', port: 'grab' } }),
    };
    const r = trace(colourOnly);
    for (const g of r.grabs) expect(g.stepBefore).toBeLessThan(STILL_STEP);
    expect(r.outcome).not.toBe('win');
  });

  it('after a grab the robot never goes farther from the store than the grab point before dropping', () => {
    for (const g of run.grabs) {
      const start = g.tick;
      const end = run.dropTicks.find((d) => d > start) ?? run.xs.length;
      for (let k = start; k < end; k++) {
        expect(run.xs[k]!, `tick ${k}`).toBeLessThanOrEqual(g.robot.x + 0.3);
      }
    }
  });

  it('on the way out the robot stops at every pad that still has a crate, red ones included', () => {
    // First sweep, before the first grab: it must have stood still at the first (red) pad.
    const firstGrab = run.grabs[0]!.tick;
    const sweep = run.stills.filter((s) => s.tick < firstGrab);
    expect(sweep.some((s) => Math.abs(s.x - PAD_X[0]!) < 0.3), 'stopped at the first pad').toBe(true);
    // Whole run: every pad (all six) was stood at, including the three red ones.
    for (const x of PAD_X) expect(run.stills.some((s) => Math.abs(s.x - x) < 0.3), `stopped at ${x}`).toBe(true);
  });

  it('with only the walk wired the robot pauses at all six pads and never grabs', () => {
    const walkOnly: PuzzleAnswer = {
      nodes: sol.nodes.filter((n) => n.id === 's-route'),
      wires: sol.wires.filter((w) => w.id === 'sw1').concat({ id: 'x', from: { node: 's-route', port: 'moveX' }, to: { node: 'robot', port: 'moveX' } }),
    };
    const r = trace(walkOnly, 40);
    for (const x of PAD_X) expect(r.stills.some((s) => Math.abs(s.x - x) < 0.3), `stopped at ${x}`).toBe(true);
    expect(r.grabs.length).toBe(0);
  });

  it('at a blue pad the robot faces the crate it lifts', () => {
    for (const g of run.grabs) expect(g.faceZ, `facing at tick ${g.tick}`).toBeGreaterThan(0.5);
  });

  it('the stop lasts about half a second', () => {
    const atPad = run.stills.filter((s) => Math.abs(s.x - PAD_X[0]!) < 0.3);
    expect(atPad.length * TICK).toBeGreaterThanOrEqual(0.4);
  });
});
