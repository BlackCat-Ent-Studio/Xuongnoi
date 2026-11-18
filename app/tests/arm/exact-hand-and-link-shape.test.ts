import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { crateInArm, handBoxesOf } from '../helpers/grip-metrics';
import { obbOf, obbSeparation } from '../../src/world/oriented-box';

/**
 * "Vật lý thật": a crate meets the hand and the arm links by their exact, turned boxes (not by upright cubes that are fatter when the
 * piece is tilted). A yaw joint swings an arm whose last piece is turned 45 degrees to the one before it into a 0.4 m crate on a table;
 * the gap between the DRAWN boxes and the crate is read on the tick the crate first moves by more than 0.1 mm.
 *
 * Before (upright covers, same boards, first-contact gap / deepest overlap, mm):
 *   hand at 45 deg:  first +0.5 .. +27.6, deepest -1.6 .. -6.8
 *   link at 45 deg:  first -27 .. +40,    deepest -22 .. -55
 * Now: first within +-2 mm of touching, deepest overlap under 3 mm (the engine's contact margin is about 2 mm).
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const MM = 0.001;

function board(yaw: number, withHand: boolean, crate: { x: number; z: number }) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
    ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
    ['table', 'block', { position: { x: 1.8, y: 0.5, z: 0 }, size: { x: 3, y: 1, z: 4 } }],
    ['go', 'on-start'],
    ['sw', 'const', { value: 80 }],
    ['ya', 'const', { value: yaw }],
    ['j1', 'joint', { axis: 'yaw', start: 0, min: -90, max: 90, maxTorque: 1000, maxSpeed: 15, mount: { x: 0, y: 0.7, z: 0 }, solid: 'yes' }],
    ['l1', 'link', { length: withHand ? 1.2 : 1.0, mass: 0, solid: 'yes' }],
    ['j2', 'joint', { axis: 'yaw', start: yaw, min: -90, max: 90, maxTorque: 1000, solid: 'yes' }],
    ['l2', 'link', { length: withHand ? 0.1 : 1.2, mass: 0, solid: 'yes' }],
    ['c', 'item', { shape: 'crate', position: { x: crate.x, y: 1.2, z: crate.z }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 2, mu: 0.5 }],
  ];
  const wires: WireSpec[] = [
    ['ped', 'self', 'j1', 'base'],
    ['go', 'started', 'j1', 'power'],
    ['go', 'started', 'j2', 'power'],
    ['sw', 'value', 'j1', 'angle'],
    ['ya', 'value', 'j2', 'angle'],
    ['j1', 'tip', 'l1', 'base'],
    ['l1', 'tip', 'j2', 'base'],
    ['j2', 'tip', 'l2', 'base'],
  ];
  if (withHand) {
    nodes.push(['g', 'gripper', { mass: 0, width: 0.2 }]);
    wires.push(['l2', 'tip', 'g', 'base']);
  }
  return rig(nodes, wires, '3d', false, true, rapier);
}

/** Gap (m) between the drawn boxes and the crate: negative = they overlap. */
function gapOf(r: ReturnType<typeof board>, withHand: boolean): number {
  const c = r.entity('c')!;
  if (!withHand) return -crateInArm(r.world, ['l1', 'l2'], 'none', c);
  const h = handBoxesOf(r.world, 'l2', 'g')!;
  const co = obbOf(c.position, c.size, c.rotation);
  return Math.min(...[h.palm, h.fingers[0], h.fingers[1]].map((o) => obbSeparation(o, co)));
}

function swing(yaw: number, withHand: boolean, crate: { x: number; z: number }) {
  const r = board(yaw, withHand, crate);
  r.tick(3);
  const at = r.entity('c')!.position;
  let first: number | null = null;
  let worst = Infinity;
  for (let i = 0; i < 60 * 10; i++) {
    r.tick();
    const c = r.entity('c')!;
    const gap = gapOf(r, withHand);
    worst = Math.min(worst, gap);
    if (first === null && Math.hypot(c.position.x - at.x, c.position.z - at.z) > 1e-4) first = gap;
  }
  return { first, worst, moved: Math.hypot(r.entity('c')!.position.x - at.x, r.entity('c')!.position.z - at.z) };
}

const at = (R: number, a: number) => ({ x: R * Math.cos(a), z: -R * Math.sin(a) });

describe('a hand turned 45 degrees touches a crate exactly where it is drawn', () => {
  for (const [R, a] of [[1.3, 0.8], [1.4, 0.8], [1.5, 0.8], [1.4, 1.0], [1.5, 1.0]] as const) {
    it(`crate at radius ${R} m, angle ${a} rad: first contact within 2 mm, deepest overlap under 3 mm`, () => {
      const o = swing(45, true, at(R, a));
      expect(o.first).not.toBeNull();
      expect(Math.abs(o.first!)).toBeLessThan(2 * MM);
      expect(o.worst).toBeGreaterThan(-3 * MM);
      expect(o.moved).toBeGreaterThan(0.1);
    });
  }
});

describe('a link turned 45 degrees touches a crate exactly where it is drawn', () => {
  for (const [yaw, R, a] of [[45, 1.5, 0.8], [45, 1.9, 0.8], [45, 1.7, 1.0], [-45, 1.7, 0.8], [-45, 1.9, 0.8]] as const) {
    it(`link at ${yaw} deg, crate at radius ${R} m, angle ${a} rad: first contact within 2 mm, deepest overlap under 3 mm`, () => {
      const o = swing(yaw, false, at(R, a));
      expect(o.first).not.toBeNull();
      expect(Math.abs(o.first!)).toBeLessThan(2 * MM);
      expect(o.worst).toBeGreaterThan(-3 * MM);
    });
  }
});
