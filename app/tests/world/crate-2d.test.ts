import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type World } from '../../src/engine/types';
import { block, crate, crateWorld, floor, run, tipDegrees, view } from './crate-helpers';

/** The side view keeps crates in the plane and turns them about z; the top view has no gravity and hand-made floor friction. */

const G = 9.81;
const TALL = { x: 0.4, y: 1.2, z: 0.4 };

describe('side view', () => {
  async function side(h: number) {
    const w = await crateWorld('2d-side');
    floor(w, '2d-side');
    const t = crate(w, 0, 0.6, 0, TALL, { mass: 10, mu: 0.5 });
    const pusher = block(w, -1.5, h, 0, 0.2, 0.2, 1);
    let x = -1.5;
    for (let i = 0; i < 480; i++) {
      x = Math.min(0.6, x + 0.3 * TICK_DT);
      w.moveBlock(pusher, { x, y: h, z: 0 });
      w.step(TICK_DT);
    }
    return view(w, t);
  }

  it('pushed high it tips over about the z axis only and stays in the plane; pushed low it slides', async () => {
    const high = await side(1.1);
    expect(tipDegrees(high)).toBeGreaterThan(80);
    expect(high.rotation!.x).toBeCloseTo(0, 6);
    expect(high.rotation!.y).toBeCloseTo(0, 6);
    expect(high.position.z).toBe(0);
    const low = await side(0.15);
    expect(tipDegrees(low)).toBeLessThan(2);
    expect(low.position.x).toBeGreaterThan(0.5);
    expect(low.position.z).toBe(0);
  });

  it('crates stack in the side view', async () => {
    const w = await crateWorld('2d-side');
    floor(w, '2d-side');
    const ids = [0, 1, 2].map((n) => crate(w, 0, 0.2 + 0.42 * n, 0));
    run(w, 4);
    ids.forEach((id, n) => expect(view(w, id).position.y, `crate ${n}`).toBeCloseTo(0.2 + 0.4 * n, 1));
  });
});

describe('top-down view', () => {
  /** A block pushes a crate to about 2 m/s and stops; returns how fast the crate loses speed afterwards (m/s²). */
  async function slowing(mu: number): Promise<number> {
    const w = await crateWorld('2d-top');
    const c = crate(w, 0, 0.2, 0, undefined, { mu, mass: 2 });
    const pusher = block(w, -1, 0.2, 0, 0.2, 0.4, 0.6);
    const speeds: number[] = [];
    let x = -1;
    let stoppedAt = -1;
    let prev = 0;
    for (let i = 0; i < 80; i++) {
      x = Math.min(0.1, x + 2 * TICK_DT);
      if (x === 0.1 && stoppedAt < 0) stoppedAt = i;
      w.moveBlock(pusher, { x, y: 0.2, z: 0 });
      w.step(TICK_DT);
      const cx = view(w, c).position.x;
      speeds.push((cx - prev) / TICK_DT);
      prev = cx;
    }
    // From 4 ticks after the block stopped (the crate is free by then) over the next 6 ticks.
    const from = stoppedAt + 4;
    return (speeds[from]! - speeds[from + 6]!) / (6 * TICK_DT);
  }

  it('a sliding crate slows by mu * g with no gravity pulling it down', async () => {
    for (const mu of [0.5, 0.2]) {
      const a = await slowing(mu);
      expect(a, `mu ${mu}`).toBeGreaterThan(mu * G * 0.9);
      expect(a, `mu ${mu}`).toBeLessThan(mu * G * 1.1);
    }
  });

  it('a crate on a belt picks up its speed at mu * g, and the y position never changes', async () => {
    const w = await crateWorld('2d-top');
    const belt: EntityId = block(w, 0, 0, 0, 20, 0.1, 4, { solid: false, belt: { axis: 'x', walls: false } });
    w.setBeltSpeed(belt, 0.5);
    const c = crate(w, 0, 0.2, 0, undefined, { mu: 0.5 });
    run(w, 0.05);
    const a = view(w, c).position.x;
    run(w, 0.05);
    const b = view(w, c).position.x;
    // After 0.05 s .. 0.1 s the belt pull (4.9 m/s²) has given 0.25..0.49 m/s.
    expect((b - a) / 0.05).toBeGreaterThan(0.25);
    expect((b - a) / 0.05).toBeLessThan(0.5);
    run(w, 0.5);
    const x0 = view(w, c).position.x;
    run(w, 0.5);
    expect((view(w, c).position.x - x0) / 0.5).toBeCloseTo(0.5, 2);
    expect(view(w, c).position.y).toBeCloseTo(0.2, 6);
  });

  it('two crates pushed together do not overlap', async () => {
    const w: World = await crateWorld('2d-top');
    const a = crate(w, 0, 0.2, 0);
    const b = crate(w, 0.5, 0.2, 0);
    const pusher = block(w, -1, 0.2, 0, 0.2, 0.4, 0.6);
    let x = -1;
    for (let i = 0; i < 240; i++) {
      x = Math.min(1, x + 0.5 * TICK_DT);
      w.moveBlock(pusher, { x, y: 0.2, z: 0 });
      w.step(TICK_DT);
    }
    expect(view(w, b).position.x - view(w, a).position.x).toBeGreaterThan(0.39);
    expect(view(w, a).position.x).toBeGreaterThan(0.3);
  });
});
