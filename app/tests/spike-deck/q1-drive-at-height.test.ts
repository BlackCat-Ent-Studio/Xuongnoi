import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { poseOf } from '../helpers/nav-rig';
import { CHASSIS, bot, deckRig, f, marker, seconds, slab } from './deck-rig';

/** SPIKE ONLY. Question 1: does a chassis stand, drive and arrive on a block at height, the same as on the ground? */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

interface Trace {
  arrivedAt: number;
  errXZ: number;
  headingErr: number;
  yMin: number;
  yMax: number;
  payloadMin: number;
  payloadMax: number;
  crateY: number;
  path: { x: number; z: number; h: number }[];
}

function run(H: number, opts: { deck?: boolean; markerY?: number; bare?: boolean } = {}): Trace {
  const goal = { x: 2, z: 1.5 };
  const b = bot({ id: 'r', x: -3, z: -2, floor: H, heading: 120, goal: 1, face: 90, tilt: 0, bare: opts.bare });
  const nodes = [...(opts.deck === false || H === 0 ? [] : [slab('deck', H, -6, 6, -6, 6)]), marker(1, goal.x, goal.z, opts.markerY ?? H), ...b.nodes];
  const r = deckRig(nodes, b.wires, rapier);
  const t: Trace = { arrivedAt: -1, errXZ: 0, headingErr: 0, yMin: Infinity, yMax: -Infinity, payloadMin: Infinity, payloadMax: -Infinity, crateY: 0, path: [] };
  for (let k = 0; k < seconds(20); k++) {
    r.tick();
    const e = r.entity('r')!;
    const p = poseOf(e);
    t.path.push({ x: p.x, z: p.z, h: p.heading });
    if (k > 30) {
      t.yMin = Math.min(t.yMin, e.position.y - H);
      t.yMax = Math.max(t.yMax, e.position.y - H);
      const kg = r.out('r', 'payload') as number;
      t.payloadMin = Math.min(t.payloadMin, kg);
      t.payloadMax = Math.max(t.payloadMax, kg);
    }
    if (t.arrivedAt < 0 && r.out('r-go', 'arrived') === true) t.arrivedAt = (k + 1) * TICK_DT;
  }
  const p = poseOf(r.entity('r')!);
  t.errXZ = Math.hypot(p.x - goal.x, p.z - goal.z);
  t.headingErr = Math.abs(((p.heading - 90 + 540) % 360) - 180);
  t.crateY = (r.entity('r-crate')?.position.y ?? 0) - H;
  r.world.dispose?.();
  return t;
}

function maxDiff(a: Trace, b: Trace): number {
  let d = 0;
  for (let k = 0; k < a.path.length; k++) d = Math.max(d, Math.abs(a.path[k]!.x - b.path[k]!.x), Math.abs(a.path[k]!.z - b.path[k]!.z), Math.abs(a.path[k]!.h - b.path[k]!.h) / 57.3);
  return d;
}

describe('SPIKE q1: a tray robot driven by "Đi tới điểm" on a block at height', () => {
  it('ground vs 0.5 m vs 2.6 m: arrival, error, height kept, payload, path difference', () => {
    const ground = run(0);
    const rows = ['| floor top | arrived s | pos err m | heading err deg | chassis y-floor min..max | payload kg min..max | crate y-floor end | max path diff vs ground |', '|---|---|---|---|---|---|---|---|'];
    for (const H of [0, 0.5, 2.6]) {
      const t = H === 0 ? ground : run(H);
      rows.push(`| ${H} | ${f(t.arrivedAt, 2)} | ${f(t.errXZ)} | ${f(t.headingErr, 2)} | ${f(t.yMin, 4)}..${f(t.yMax, 4)} | ${f(t.payloadMin, 2)}..${f(t.payloadMax, 2)} | ${f(t.crateY)} | ${maxDiff(t, ground).toExponential(2)} |`);
      expect(t.arrivedAt).toBeGreaterThan(0);
      expect(t.errXZ).toBeLessThan(0.1);
      expect(Math.abs(t.yMin - CHASSIS.height / 2)).toBeLessThan(0.01);
    }
    console.log(rows.join('\n'));
  });

  it('a marker left on the ground (y = 0) under a 2.6 m deck still steers the deck robot: the goal has no height', () => {
    const t = run(2.6, { markerY: 0 });
    console.log(`marker at y=0, robot on 2.6 m deck: arrived ${f(t.arrivedAt, 2)} s, pos err ${f(t.errXZ)} m`);
    expect(t.arrivedAt).toBeGreaterThan(0);
  });

  it('a chassis with nothing under it drives while it falls (traction does not ask whether the wheels touch)', () => {
    const b = bot({ id: 'r', x: -3, z: 0, floor: 2.6, heading: 0, goal: 1, bare: true });
    const r = deckRig([marker(1, 3, 0, 0), ...b.nodes], b.wires, rapier);
    let landedAt = -1;
    let xAtLanding = 0;
    let speedInAir = 0;
    for (let k = 0; k < seconds(3); k++) {
      r.tick();
      const e = r.entity('r')!;
      if (landedAt < 0) {
        speedInAir = Math.max(speedInAir, e.robot?.speed ?? 0);
        if (e.position.y < CHASSIS.height / 2 + 0.001) {
          landedAt = (k + 1) * TICK_DT;
          xAtLanding = e.position.x;
        }
      }
    }
    console.log(`no deck under it: fell 2.6 m in ${f(landedAt, 2)} s, travelled ${f(xAtLanding + 3)} m forward in the air, top speed in the air ${f(speedInAir, 2)} m/s`);
    r.world.dispose?.();
    expect(landedAt).toBeGreaterThan(0);
  });
});
