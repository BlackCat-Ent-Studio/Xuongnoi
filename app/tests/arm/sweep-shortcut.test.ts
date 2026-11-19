import { describe, expect, it } from 'vitest';
import { sweepCubes, sweepWhole, type SweepInput } from '../../src/world/arm-solid';
import { planPush, planWhole, type Box, type PushBody } from '../../src/world/linear-actuator';
import { obbBounds, obbOf } from '../../src/world/oriented-box';

/**
 * A sweep whose cubes can touch no body leaves the bodies out and looks only at the solids in reach. That may only save work:
 * the result must be the one the whole sweep gives, number for number.
 */

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An arm piece near the origin stepping a little way, with crates, plain bodies and solids at `spread` around it. */
function sweep(next: () => number, spread: number, flat: SweepInput['flat']): SweepInput {
  const at = (s: number): number => (next() - 0.5) * s;
  const quat = (): { x: number; y: number; z: number; w: number } => {
    const q = { x: at(2), y: at(2), z: at(2), w: at(2) };
    const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
    return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
  };
  const before: Box[] = [];
  const after: Box[] = [];
  const levers: number[] = [];
  const exact = flat === null && next() < 0.5;
  const step = { x: at(0.2), y: at(0.2), z: at(0.2) };
  for (let k = 0; k < 1 + Math.floor(next() * 5); k++) {
    const pos = { x: at(1.5), y: 0.5 + at(1), z: at(1.5) };
    const size = { x: 0.1 + next() * 0.3, y: 0.1 + next() * 0.3, z: 0.1 + next() * 0.3 };
    const to = { x: pos.x + step.x * (k + 1), y: pos.y + step.y, z: pos.z + step.z };
    if (exact && next() < 0.7) {
      const turn = quat();
      const a = obbOf(pos, size, turn);
      const b = obbOf(to, size, next() < 0.5 ? turn : quat());
      before.push({ ...obbBounds(a), exact: a });
      after.push({ ...obbBounds(b), exact: b });
    } else {
      const fat = exact && next() < 0.5;
      before.push({ pos, size, ...(fat ? { fat: true } : {}) });
      after.push({ pos: to, size, ...(fat ? { fat: true } : {}) });
    }
    levers.push(next() * 1.5);
  }
  const bodies: PushBody[] = [];
  for (let k = 0; k < Math.floor(next() * 8); k++) {
    const pos = { x: at(spread), y: 0.4 + at(spread / 4), z: at(spread) };
    const size = { x: 0.2 + next() * 0.4, y: 0.2 + next() * 0.4, z: 0.2 + next() * 0.4 };
    if (next() < 0.6) {
      const real = obbOf(pos, size, next() < 0.5 ? quat() : undefined);
      bodies.push({ id: `c${k}`, box: obbBounds(real), massKg: 0.5 + next() * 5, mu: 0.5, crossTol: 0.05, skin: 0.005, real });
    } else {
      bodies.push({ id: `b${k}`, box: { pos, size }, massKg: 1 + next() * 60, mu: 0.4 });
    }
  }
  const solids: Box[] = [{ pos: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 } }];
  for (let k = 0; k < Math.floor(next() * 8); k++) solids.push({ pos: { x: at(spread), y: 0.5 + at(1), z: at(spread) }, size: { x: 0.2 + next(), y: 0.2 + next(), z: 0.2 + next() } });
  const mount = next() < 0.3 ? solids[solids.length - 1]! : null;
  return { before, after, levers, bodies, solids, flat, availableNm: next() < 0.2 ? 0.5 : 400, mount, ...(next() < 0.5 ? { probeContact: true } : {}) };
}

describe('sweepCubes gives what the whole sweep gives', () => {
  it('with bodies and solids from right at the arm to far away, in every view', () => {
    const next = rng(271828);
    let pushing = 0;
    let stopped = 0;
    let free = 0;
    for (let round = 0; round < 3000; round++) {
      const input = sweep(next, [1.5, 4, 12, 80][round % 4]!, ([null, null, 'y', 'z'] as const)[Math.floor(round / 4) % 4]!);
      const want = sweepWhole(input);
      expect(sweepCubes(input)).toEqual(want);
      if (want.moves.size > 0) pushing++;
      else if (want.fraction < 1) stopped++;
      else free++;
    }
    // All three happen often: a body is pushed, a solid stops the piece, nothing is in the way.
    expect(pushing).toBeGreaterThan(200);
    expect(stopped).toBeGreaterThan(200);
    expect(free).toBeGreaterThan(200);
  });

  it('with numbers that are not finite', () => {
    const next = rng(7);
    for (let round = 0; round < 200; round++) {
      const input = sweep(next, 12, null);
      const odd = [NaN, Infinity, -Infinity][round % 3]!;
      if (round % 4 === 0 && input.bodies[0]) input.bodies[0].box.pos.x = odd;
      if (round % 4 === 1) input.solids[0]!.size.z = odd;
      if (round % 4 === 2) input.after[0]!.pos.y = odd;
      if (round % 4 === 3) input.before[0]!.size.x = odd;
      expect(sweepCubes(input)).toEqual(sweepWhole(input));
    }
  });
});

describe('planPush gives what the whole plan gives', () => {
  it('for single heads (pistons, chassis, fingers) with bodies and solids near and far, in every view', () => {
    const next = rng(161803);
    let pushing = 0;
    let stopped = 0;
    let free = 0;
    for (let round = 0; round < 4000; round++) {
      const flat = ([null, null, 'y', 'z'] as const)[Math.floor(round / 4) % 4]!;
      const s = sweep(next, [1.5, 4, 12, 80][round % 4]!, flat);
      const from = s.before[0]!;
      const to = s.after[0]!;
      const d = { x: to.pos.x - from.pos.x, y: flat === 'y' ? 0 : to.pos.y - from.pos.y, z: flat === 'z' ? 0 : to.pos.z - from.pos.z };
      const len = Math.hypot(d.x, d.y, d.z) || 1;
      const input = {
        head: from,
        ...(to.exact && next() < 0.7 ? { headEnd: to.exact } : {}),
        dir: { x: d.x / len, y: d.y / len, z: d.z / len },
        step: [len, len * 5, 0, 1.5][Math.floor(next() * 4)]!,
        bodies: s.bodies,
        solids: s.solids,
        flat,
        lifting: d.y / len > 0.5,
        ...(next() < 0.5 ? { probeContact: true } : {}),
      };
      const want = planWhole(input);
      expect(planPush(input)).toEqual(want);
      if (want.moves.length > 0) pushing++;
      else if (want.blocked) stopped++;
      else free++;
    }
    expect(pushing).toBeGreaterThan(300);
    expect(stopped).toBeGreaterThan(300);
    expect(free).toBeGreaterThan(300);
  });
});
