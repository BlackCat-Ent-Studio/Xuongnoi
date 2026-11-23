import { beforeAll, describe, expect, it } from 'vitest';
import { chassisOutlineOfView, obbOf, obbSeparation } from '../../src/world/oriented-box';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec } from '../helpers/arm-rig';
import { bot, CHASSIS, deckRig, seconds } from './deck-rig';

/**
 * "Vật lý thật" on. A moving solid block (a moving platform, a lift, a door) is no force-limited pusher: it carries the chassis
 * that stands on it and pushes the chassis beside it, whatever that weighs, and never squeezes it into a wall. It meets the
 * chassis where its real outline is (its length by its width, turned to its heading), not at the upright square round it.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

interface Run {
  /** Where the platform starts and where it goes (its centre). */
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  /** Heading of the chassis (degrees) and the height of what it stands on. */
  heading?: number;
  floor?: number;
  mass?: number;
  extra?: NodeSpec[];
  seconds?: number;
}

/** The chassis stands at the origin; the platform runs once from `from` to `to` at 1 m/s. */
function run(p: Run) {
  const b = bot({ id: 'r', x: 0, z: 0, floor: p.floor ?? 0, heading: p.heading ?? 0, body: { mass: p.mass ?? 5 } });
  const nodes: NodeSpec[] = [...b.nodes, ['plat', 'moving-platform', { position: p.from, to: p.to, size: p.size, speed: 1, wait: 0, loop: 'once' }], ['e', 'key', { key: 'KeyE' }], ...(p.extra ?? [])];
  const r = deckRig(nodes, [...b.wires, ['e', 'held', 'plat', 'run']], rapier);
  r.tick(seconds(1));
  r.hold('KeyE');
  let deepest = 0;
  for (let k = 0; k < seconds(p.seconds ?? 7); k++) {
    r.tick();
    const plat = r.entity('plat')!;
    deepest = Math.max(deepest, -obbSeparation(obbOf(plat.position, plat.size), chassisOutlineOfView(r.entity('r')!)!));
  }
  const res = { chassis: { ...r.entity('r')!.position }, plat: { ...r.entity('plat')!.position }, deepest };
  r.world.dispose?.();
  return res;
}

const PUSHER = { x: 1, y: 0.5, z: 1 };

describe('a moving platform and a robot chassis ("Vật lý thật" on)', () => {
  it('a lift carries the chassis that stands on it up, and a platform carries it along', { timeout: 60_000 }, () => {
    const lift = run({ from: { x: 0, y: 0.1, z: 0 }, to: { x: 0, y: 2.1, z: 0 }, size: { x: 2, y: 0.2, z: 2 }, floor: 0.2 });
    expect(lift.plat.y).toBeCloseTo(2.1, 9);
    expect(lift.chassis.y).toBeCloseTo(2.2 + CHASSIS.height / 2, 3);
    expect(Math.hypot(lift.chassis.x, lift.chassis.z)).toBeLessThan(1e-6);
    const ferry = run({ from: { x: 0, y: 0.1, z: 0 }, to: { x: 3, y: 0.1, z: 2 }, size: { x: 2, y: 0.2, z: 2 }, floor: 0.2 });
    expect(ferry.chassis.x).toBeCloseTo(3, 6);
    expect(ferry.chassis.z).toBeCloseTo(2, 6);
    expect(ferry.chassis.y).toBeCloseTo(0.2 + CHASSIS.height / 2, 3);
  });

  it('pushes a chassis from behind however heavy it is, flush with its end', { timeout: 60_000 }, () => {
    for (const mass of [5, 200]) {
      const res = run({ from: { x: -3, y: 0.25, z: 0 }, to: { x: 2, y: 0.25, z: 0 }, size: PUSHER, mass });
      expect(res.plat.x).toBeCloseTo(2, 9);
      expect(res.chassis.x).toBeCloseTo(2 + PUSHER.x / 2 + CHASSIS.length / 2, 9);
      expect(res.chassis.z).toBeCloseTo(0, 9);
      expect(res.deepest).toBeLessThan(1e-3);
    }
  });

  it('pushes a chassis from the side where its real side is, not at the square round it', { timeout: 60_000 }, () => {
    const res = run({ from: { x: 0, y: 0.25, z: -3 }, to: { x: 0, y: 0.25, z: 2 }, size: PUSHER, mass: 200 });
    expect(res.plat.z).toBeCloseTo(2, 9);
    expect(res.chassis.z).toBeCloseTo(2 + PUSHER.z / 2 + CHASSIS.width / 2, 9);
    expect(res.chassis.x).toBeCloseTo(0, 9);
    expect(res.deepest).toBeLessThan(1e-3);
  });

  it('pushes a chassis that stands askew by its corner, without entering it', { timeout: 60_000 }, () => {
    for (const heading of [30, 45]) {
      const res = run({ from: { x: 0, y: 0.25, z: -3 }, to: { x: 0, y: 0.25, z: 2 }, size: PUSHER, heading });
      expect(res.plat.z).toBeCloseTo(2, 9);
      expect(res.chassis.z).toBeGreaterThan(2 + PUSHER.z / 2 + CHASSIS.width / 2);
      expect(res.chassis.x).toBeCloseTo(0, 9);
      expect(res.deepest).toBeLessThan(1e-3);
    }
  });

  it('never squeezes the chassis into a wall: it waits with the real side of the chassis at the wall', { timeout: 60_000 }, () => {
    const wall: NodeSpec = ['wall', 'block', { position: { x: 0, y: 0.5, z: 2.5 }, size: { x: 4, y: 1, z: 0.2 } }];
    const res = run({ from: { x: 0, y: 0.25, z: -3 }, to: { x: 0, y: 0.25, z: 3 }, size: PUSHER, extra: [wall] });
    const wallFace = 2.5 - 0.1;
    // The chassis is against the wall, the platform against the chassis, to within one step of the platform (1 m/s, 60 steps a second).
    expect(res.chassis.z + CHASSIS.width / 2).toBeLessThanOrEqual(wallFace + 1e-6);
    expect(res.chassis.z + CHASSIS.width / 2).toBeGreaterThan(wallFace - 0.02);
    expect(res.plat.z + PUSHER.z / 2).toBeLessThanOrEqual(res.chassis.z - CHASSIS.width / 2 + 1e-6);
    expect(res.deepest).toBeLessThan(1e-3);
  });
});
