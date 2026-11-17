import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type World } from '../../src/engine/types';
import { block, crate, crateWorld, floor, run, tipDegrees, view } from './crate-helpers';

/**
 * Loose items as rigid bodies (switch "Vật lý thật" on, engine loaded). Numbers are the hand calculations the handbook
 * page teaches: friction F = μ·m·g, tipping when F·h reaches m·g·(width/2), belt carry a = μ·g, fall time sqrt(2h/g).
 */

const G = 9.81;
const TALL = { x: 0.4, y: 1.2, z: 0.4 };

/** A block along x that a node would move: it pushes at height `h` at `speed` m/s until its centre reaches `stopAt`. */
async function pushTall(h: number, speed: number, stopAt: number, over: { mass?: number; mu?: number } = {}) {
  const w = await crateWorld();
  floor(w);
  const t = crate(w, 0, 0.6, 0, TALL, { mass: over.mass ?? 10, mu: over.mu ?? 0.5 });
  const pusher = block(w, -1.5, h, 0, 0.2, 0.2, 0.6);
  let x = -1.5;
  let peak = 0;
  for (let i = 0; i < 480; i++) {
    x = Math.min(stopAt, x + speed * TICK_DT);
    w.moveBlock(pusher, { x, y: h, z: 0 });
    w.step(TICK_DT);
    peak = Math.max(peak, tipDegrees(view(w, t)));
  }
  return { peak, final: tipDegrees(view(w, t)), x: view(w, t).position.x };
}

describe('a crate falls, lands and stacks', () => {
  it('lands upright on the floor, reports ground, and stays put', async () => {
    const w = await crateWorld();
    floor(w);
    const c = crate(w, 0, 1, 0);
    run(w, 2);
    const v = view(w, c);
    expect(v.position.y).toBeCloseTo(0.2, 2);
    expect(tipDegrees(v)).toBeLessThan(0.5);
    expect(w.isOnGround(c)).toBe(true);
    const before = { ...v.position };
    run(w, 3);
    expect(Math.hypot(view(w, c).position.x - before.x, view(w, c).position.y - before.y, view(w, c).position.z - before.z)).toBeLessThan(1e-3);
  });

  it('falls for sqrt(2h/g) seconds at the gravity of the world', async () => {
    for (const [g, seconds] of [[9.81, 1], [4.905, Math.sqrt(2)], [1.62, Math.sqrt((2 * 4.905) / 1.62)]] as const) {
      const w = await crateWorld('3d', { gravity: g });
      floor(w);
      const c = crate(w, 0, 4.905 + 0.2, 0);
      let t = -1;
      for (let i = 0; i < 600 && t < 0; i++) {
        w.step(TICK_DT);
        if (view(w, c).position.y < 0.205) t = (i + 1) * TICK_DT;
      }
      expect(t, `g ${g}`).toBeGreaterThan(seconds - 0.03);
      expect(t, `g ${g}`).toBeLessThan(seconds + 0.06);
    }
  });

  it('three crates in a stack stay put: drift under 1 mm in 5 s, nobody sinks into the one below', async () => {
    const w = await crateWorld();
    floor(w);
    const ids = [0, 1, 2].map((n) => crate(w, 0, 0.2 + 0.4 * n + 0.01 * n, 0, undefined, { mass: 2 }));
    run(w, 1.5);
    const start = ids.map((i) => ({ ...view(w, i).position }));
    let drift = 0;
    for (let s = 0; s < 300; s++) {
      w.step(TICK_DT);
      ids.forEach((id, n) => {
        const p = view(w, id).position;
        drift = Math.max(drift, Math.hypot(p.x - start[n]!.x, p.y - start[n]!.y, p.z - start[n]!.z));
      });
    }
    expect(drift).toBeLessThan(1e-3);
    ids.forEach((id, n) => {
      const bottomOfThis = view(w, id).position.y - 0.2;
      const topOfBelow = n === 0 ? 0 : view(w, ids[n - 1]!).position.y + 0.2;
      expect(bottomOfThis - topOfBelow, `crate ${n}`).toBeGreaterThan(-0.005);
      expect(bottomOfThis - topOfBelow, `crate ${n}`).toBeLessThan(0.01);
    });
  });

  it('a crate dropped on another lands on top of it and does not go through', async () => {
    const w = await crateWorld();
    floor(w);
    const low = crate(w, 0, 0.2, 0);
    const high = crate(w, 0.05, 2, 0);
    run(w, 3);
    expect(view(w, high).position.y).toBeGreaterThan(0.55);
    expect(view(w, high).position.y).toBeLessThan(0.62);
    expect(view(w, low).position.y).toBeCloseTo(0.2, 2);
  });
});

describe('a tall crate: pushed high it tips, pushed low it slides', () => {
  // m = 10 kg, width 0.4 m, mu 0.5: slides at F = mu m g = 49.05 N, tips when F * h >= m g (w/2) = 19.62 N m.
  it('hand numbers: tipping force at 1.1 m is below the sliding force, at 0.15 m it is far above it', () => {
    const slide = 0.5 * 10 * G;
    const tipMoment = 10 * G * 0.2;
    expect(slide).toBeCloseTo(49.05, 2);
    expect(tipMoment / 1.1).toBeCloseTo(17.84, 2);
    expect(tipMoment / 1.1).toBeLessThan(slide);
    expect(tipMoment / 0.15).toBeCloseTo(130.8, 1);
    expect(tipMoment / 0.15).toBeGreaterThan(slide);
  });

  it('a block pushing slowly at 1.1 m tips it over; at 0.15 m it slides it without tipping', async () => {
    const high = await pushTall(1.1, 0.3, 0.6);
    expect(high.final).toBeGreaterThan(80);
    const low = await pushTall(0.15, 0.3, 0.6);
    expect(low.peak).toBeLessThan(2);
    expect(low.x).toBeGreaterThan(0.5);
  });

  it('a lower friction makes no difference to the slow top push and a very low one lets the low push slip past', async () => {
    const slippery = await pushTall(1.1, 0.3, 0.6, { mu: 0.05 });
    expect(slippery.peak).toBeLessThan(2);
    expect(slippery.x).toBeGreaterThan(0.5);
  });

  it('a short 1 m/s hit at the top (3 cm) does not tip it; the same hit with a 10 cm stroke does', async () => {
    // The hit alone gives it about 2.2 J; lifting the centre of mass to the tipping point takes m g dh = 3.1 J.
    const short = await pushTall(1.1, 1, -0.27);
    expect(short.peak).toBeLessThan(18.4);
    expect(short.final).toBeLessThan(5);
    const long = await pushTall(1.1, 1, -0.2);
    expect(long.final).toBeGreaterThan(80);
  });

  it('a crate that was resting for a long time is still pushed (nothing falls asleep)', async () => {
    const w = await crateWorld();
    floor(w);
    const c = crate(w, 0, 0.2, 0);
    run(w, 6);
    const pusher = block(w, -0.6, 0.15, 0, 0.2, 0.2, 0.6);
    for (let i = 0; i < 30; i++) {
      w.moveBlock(pusher, { x: -0.6 + (i + 1) * 0.02, y: 0.15, z: 0 });
      w.step(TICK_DT);
    }
    run(w, 1);
    expect(view(w, c).position.x).toBeGreaterThan(0.1);
  });
});

describe('crates collide with each other, with walls and with the floor', () => {
  it('a pushed crate shoves the next ones in the row; none overlaps another', async () => {
    const w = await crateWorld();
    floor(w);
    const ids = [0, 1, 2].map((n) => crate(w, n * 0.5, 0.2, 0, undefined, { mass: 2 }));
    const pusher = block(w, -1.5, 0.2, 0, 0.2, 0.4, 0.6);
    let x = -1.5;
    for (let i = 0; i < 360; i++) {
      x = Math.min(1, x + 0.5 * TICK_DT);
      w.moveBlock(pusher, { x, y: 0.2, z: 0 });
      w.step(TICK_DT);
    }
    const xs = ids.map((i) => view(w, i).position.x);
    for (const [n, px] of xs.entries()) expect(px, `crate ${n}`).toBeGreaterThan(n * 0.5 + 0.8);
    for (let n = 1; n < xs.length; n++) expect(xs[n]! - xs[n - 1]!, `gap ${n}`).toBeGreaterThan(0.4 - 0.01);
  });

  it('a crate pushed into a wall stops at the wall face, and the block that pushes it stops too instead of crushing it', async () => {
    const w = await crateWorld();
    floor(w);
    block(w, 3, 1, 0, 0.2, 2, 4);
    const c = crate(w, 0, 0.2, 0);
    const pusher = block(w, -1.5, 0.2, 0, 0.2, 0.4, 0.6);
    let x = -1.5;
    for (let i = 0; i < 420; i++) {
      x = Math.min(2.5, x + 0.8 * TICK_DT);
      w.moveBlock(pusher, { x, y: 0.2, z: 0 });
      w.step(TICK_DT);
    }
    // Wall face at 2.9; the crate's centre may not pass 2.7, and the pusher's face (centre + 0.1) stays behind the crate's.
    expect(view(w, c).position.x).toBeGreaterThan(2.69 - 0.02);
    expect(view(w, c).position.x).toBeLessThan(2.7 + 0.005);
    expect(view(w, pusher).position.x + 0.1).toBeLessThan(2.5 + 0.02);
  });

  it('a tumbling crate thrown at the floor never ends below it', async () => {
    const w = await crateWorld();
    floor(w);
    const ids = [0, 1, 2, 3].map((n) => crate(w, 0.3 * n, 2 + 0.7 * n, 0.1 * n, { x: 0.5, y: 0.3, z: 0.7 }));
    run(w, 4);
    for (const id of ids) expect(view(w, id).position.y).toBeGreaterThan(0.1);
  });
});

describe('conveyors carry crates by friction', () => {
  const belt = (w: World, speed: number): EntityId => {
    const id = block(w, 0, -0.5, 0, 20, 1, 4, { belt: { axis: 'x', walls: false } });
    w.setBeltSpeed(id, speed);
    return id;
  };

  it('a crate reaches the belt speed after about v / (mu g) seconds, whatever its mass', async () => {
    const times: number[] = [];
    for (const mu of [0.5, 0.1]) {
      for (const mass of [0.5, 20]) {
        const w = await crateWorld();
        belt(w, 0.5);
        const c = crate(w, 0, 0.2, 0, undefined, { mu, mass });
        let prev = view(w, c).position.x;
        let reach = -1;
        for (let i = 0; i < 400 && reach < 0; i++) {
          w.step(TICK_DT);
          const x = view(w, c).position.x;
          if ((x - prev) / TICK_DT >= 0.495) reach = (i + 1) * TICK_DT;
          prev = x;
        }
        const analytic = 0.5 / (mu * G);
        expect(reach, `mu ${mu} mass ${mass}`).toBeGreaterThan(analytic - 0.01);
        expect(reach, `mu ${mu} mass ${mass}`).toBeLessThan(analytic * 1.35 + 0.03);
        times.push(reach);
      }
    }
    // Same material, different mass: the same time (within two ticks).
    expect(Math.abs(times[0]! - times[1]!)).toBeLessThan(2.5 * TICK_DT);
    expect(Math.abs(times[2]! - times[3]!)).toBeLessThan(2.5 * TICK_DT);
  });

  it('crates queue up against a wall at the end and the belt slides under the first one', async () => {
    const w = await crateWorld();
    belt(w, 0.5);
    block(w, 3, 0.5, 0, 0.2, 1, 4);
    const ids = [0, 1, 2].map((n) => crate(w, -1 + n * 0.6, 0.2, 0));
    run(w, 12);
    const xs = ids.map((i) => view(w, i).position.x);
    expect(xs[2]).toBeGreaterThan(2.7 - 0.01);
    expect(xs[2]).toBeLessThan(2.7 + 0.01);
    expect(xs[2]! - xs[1]!).toBeGreaterThan(0.39);
    expect(xs[2]! - xs[1]!).toBeLessThan(0.42);
    expect(xs[1]! - xs[0]!).toBeGreaterThan(0.39);
    expect(xs[1]! - xs[0]!).toBeLessThan(0.42);
    const first = view(w, ids[2]!).position.x;
    run(w, 3);
    expect(Math.abs(view(w, ids[2]!).position.x - first)).toBeLessThan(0.002);
  });

  it('a belt started late still moves a crate that had been resting on it', async () => {
    const w = await crateWorld();
    const b = belt(w, 0);
    const c = crate(w, 0, 0.2, 0);
    run(w, 4);
    w.setBeltSpeed(b, 1);
    run(w, 1);
    expect(view(w, c).position.x).toBeGreaterThan(0.5);
  });
});

describe('crates keep their own material', () => {
  it('a heavy crate hit by a light one at the same speed moves it little: momentum with the real masses', async () => {
    // Frictionless crates: a 1 kg crate sliding at v hits a 4 kg crate at rest; with no bounce both leave at v / 5.
    const w = await crateWorld();
    floor(w);
    const light = crate(w, 0, 0.2, 0, undefined, { mass: 1, mu: 0 });
    const heavy = crate(w, 1.5, 0.2, 0, undefined, { mass: 4, mu: 0 });
    // A block that a node moves pushes the light crate to 1 m/s and lets go (it stops, the crate slides on).
    const pusher = block(w, -1, 0.2, 0, 0.2, 0.4, 0.6);
    let x = -1;
    for (let i = 0; i < 160; i++) {
      x += TICK_DT * 1;
      w.moveBlock(pusher, { x: Math.min(x, -0.1), y: 0.2, z: 0 });
      w.step(TICK_DT);
    }
    // The pusher stopped at -0.1 and let go; the light crate then hit the heavy one. Measure each crate's speed after the crash.
    const p = (id: EntityId): number => view(w, id).position.x;
    const a0 = p(light);
    const b0 = p(heavy);
    run(w, 0.5);
    const va = (p(light) - a0) / 0.5;
    const vb = (p(heavy) - b0) / 0.5;
    // m1 v / (m1 + m2) with the light crate at about 1.05 m/s: both leave at roughly 0.21 m/s, together.
    expect(Math.abs(va - vb)).toBeLessThan(0.03);
    expect(vb).toBeGreaterThan(0.18);
    expect(vb).toBeLessThan(0.25);
  });
});
