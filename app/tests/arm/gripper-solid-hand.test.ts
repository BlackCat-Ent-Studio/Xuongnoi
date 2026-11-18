import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { crateInHand } from '../helpers/grip-metrics';
import { tipDegrees } from '../world/crate-helpers';

/**
 * "Vật lý thật": the gripper's palm and two fingers are solid. They move with the arm (the joints push them like any other arm
 * part) and the fingers move with the gripper's own opening and closing (each finger pushes with at most the grip force).
 *
 * Hand numbers used below (palm 0.15 deep x 0.25 x 1.24 wide, fingers 0.3 long x 0.12 x 0.12, grasp point 0.3 from the wrist,
 * g = 9.81, friction m x g with mu 0.5, tipping m x g x b / h):
 *   a 2 kg crate needs 0.5 x 2 x 9.81 = 9.81 N to slide;
 *   a 10 kg crate needs 49.05 N to slide and 98.1 x b / h to tip (b = half the base along the push, h = height of the push).
 * Lengths in metres, tolerances stated at each check.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const G = 9.81;
const DEG = Math.PI / 180;
const MM = 0.001;

// ---- the hand hangs from a joint 3 m up on a pedestal: wrist 2 m up, grasp point 1.7 m up ----

function fixedHand(crate: { y: number; z?: number; size?: { x: number; y: number; z: number } }, gripper: Record<string, number | string> = {}, crateExtra: Record<string, number | string> = {}) {
  const size = crate.size ?? { x: 0.6, y: 0.6, z: 0.6 };
  const z = crate.z ?? 0;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
    ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
    // The shelf top is the crate's bottom: it rests there.
    ['shelf', 'block', { position: { x: 0, y: crate.y - size.y / 2 - 0.25, z }, size: { x: 2, y: 0.5, z: 3 } }],
    ['go', 'on-start'],
    ['ang', 'const', { value: -90 }],
    ['j', 'joint', { axis: 'pitch', start: -90, min: -90, max: 90, maxTorque: 100, mount: { x: 0, y: 2.5, z: 0 } }],
    ['l', 'link', { length: 1, mass: 0 }],
    ['g', 'gripper', { width: 1, grip: 'between', mass: 0, defaultForce: 25, maxForce: 120, ...gripper }],
    ['c', 'item', { shape: 'crate', position: { x: 0, y: crate.y, z }, size, mass: 2, mu: 0.5, ...crateExtra }],
    ['k', 'key', { key: 'Space' }],
  ];
  const wires: WireSpec[] = [
    ['ped', 'self', 'j', 'base'],
    ['go', 'started', 'j', 'power'],
    ['ang', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
    ['l', 'tip', 'g', 'base'],
    ['k', 'held', 'g', 'close'],
  ];
  const r = rig(nodes, wires, '3d', false, true, rapier);
  r.tick(40);
  return r;
}

describe('a closing finger pushes a crate the hand does not grip, with at most the grip force', () => {
  // Crate 0.4 x 0.3 x 0.4, 2 kg, mu 0.5, top 0.12 m under the grasp point so the grasp point is not inside it (it is not gripped).
  // Only the lowest finger slice reaches it (fingers span y 1.55 .. 1.85, crate top 1.58): contact at its top edge, h = 0.30.
  // Slide 0.5 x 2 x 9.81 = 9.81 N; tip 2 x 9.81 x 0.2 / 0.30 = 13.08 N: it slides, so the limit is 9.81 N.
  const SMALL = { x: 0.4, y: 0.3, z: 0.4 };
  function push(forceN: number) {
    const r = fixedHand({ y: 1.43, z: 0.25, size: SMALL }, { defaultForce: forceN });
    expect(r.out('g', 'inReach')).toBe(false);
    r.hold('Space');
    let tilt = 0;
    // Where the crate stands on the tick the two pads first have it between them (their inner faces 0.4 m apart).
    let atMeet: number | null = null;
    for (let i = 0; i < 90; i++) {
      r.tick();
      tilt = Math.max(tilt, tipDegrees(r.entity('c')!));
      const [, f1, f2] = r.world.entities().filter((e) => e.ownerNodeId === 'g');
      if (atMeet === null && f1!.position.z - f2!.position.z - 0.12 <= 0.4 + MM) atMeet = r.entity('c')!.position.z;
    }
    return { r, tilt, atMeet };
  }

  it('9.81 N is the limit: 8 N stalls both fingers (crate stays), 12 N slides it between the pads', () => {
    const weak = push(8);
    expect(Math.abs(weak.r.entity('c')!.position.z - 0.25)).toBeLessThan(5 * MM);
    expect(weak.r.out('g', 'holding')).toBe(false);

    const strong = push(12);
    // Pushed from z = 0.25 until it meets the other finger: both pads close at 1 m/s, so they meet it half way, at z = 0 (+- 3 cm).
    // (Closing on past that squeezes it between the two fingertips, which only dip 3 cm into its top: not asserted.)
    expect(Math.abs(strong.atMeet!)).toBeLessThan(0.03);
    expect(strong.tilt).toBeLessThan(5);
    expect(strong.r.out('g', 'holding')).toBe(false);
  });
});

describe('the open hand is solid: lowered onto a crate it stops, it does not sink in', () => {
  /**
   * A joint 1.6 m up with a horizontal 3 m link, and a second joint that keeps the hand pointing straight down (its angle is
   * -90 minus the first joint's angle). The first joint turns from +10 to -5 deg at 10 deg/s, so the wrist goes straight down
   * (at y = 1.6 + 3 sin a, 3 m out) while the hand stays upright. The crate stands on a table, 3 m out, under the hand.
   */
  function lower(crate: { top: number; size: { x: number; z: number } }, gripper: Record<string, number | string>) {
    const height = crate.top - 1;
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
      ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
      ['table', 'block', { position: { x: 3, y: 0.5, z: 0 }, size: { x: 2.4, y: 1, z: 2.4 } }],
      ['go', 'on-start'],
      ['up', 'const', { value: -5 }],
      ['down', 'const', { value: -90 }],
      ['keep', 'math', { op: 'sub' }],
      ['j', 'joint', { axis: 'pitch', start: 10, min: -10, max: 20, maxTorque: 100, maxSpeed: 10, mount: { x: 0, y: 1.1, z: 0 } }],
      ['l', 'link', { length: 3, mass: 0 }],
      ['w', 'joint', { axis: 'pitch', start: -100, min: -180, max: 0, maxTorque: 1000, maxSpeed: 90 }],
      ['h', 'link', { length: 0.1, mass: 0 }],
      ['g', 'gripper', { grip: 'between', mass: 0, ...gripper }],
      ['c', 'item', { shape: 'crate', position: { x: 3, y: 1 + height / 2, z: 0 }, size: { x: crate.size.x, y: height, z: crate.size.z }, mass: 2, mu: 0.5 }],
    ];
    const wires: WireSpec[] = [
      ['ped', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['go', 'started', 'w', 'power'],
      ['up', 'value', 'j', 'angle'],
      ['down', 'value', 'keep', 'a'],
      ['j', 'angleNow', 'keep', 'b'],
      ['keep', 'out', 'w', 'angle'],
      ['j', 'tip', 'l', 'base'],
      ['l', 'tip', 'w', 'base'],
      ['w', 'tip', 'h', 'base'],
      ['h', 'tip', 'g', 'base'],
    ];
    return rig(nodes, wires, '3d', false, true, rapier);
  }

  // The wrist (where the hand starts) is 0.1 m past the joint: the short link that carries the hand cannot be shorter.
  const wristY = (a: number): number => 1.6 + 3 * Math.sin(a * DEG) - 0.1;

  it('the palm lands on a 1.75 m high crate: the joint stops where the palm face meets the top (7.66 deg), reads the load and reports overloaded', () => {
    // Hand upright: the palm's lower face is 0.15 under the wrist. 1.6 + 3 sin a - 0.1 - 0.15 = 1.75  ->  sin a = 0.1333  ->  a = 7.66 deg.
    // The planner counts a rigid crate as touched 5 mm before the faces meet, so the hand stops about 5 mm short (0.1 deg).
    const top = 1.75;
    const want = Math.asin((top + 0.25 - 1.6) / 3) / DEG;
    const r = lower({ top, size: { x: 0.9, z: 0.9 } }, { width: 1 });
    r.tick(60 * 4);
    const angle = r.out('j', 'angleNow') as number;
    expect(Math.abs(angle - want)).toBeLessThan(0.3);
    // The palm face is on the crate top: the gap is between -1 mm and +1 cm, the crate did not move.
    const c = r.entity('c')!;
    const gap = -crateInHand(r.world, 'h', 'g', c);
    expect(gap).toBeGreaterThan(-MM);
    expect(gap).toBeLessThan(0.01);
    expect(Math.abs(c.position.y - (1 + (top - 1) / 2))).toBeLessThan(MM);
    expect(Math.abs(c.position.x - 3)).toBeLessThan(MM);
    expect(r.out('j', 'overloaded')).toBe(true);
    // The hand presses the crate into the table: friction 0.5 x 2 x 9.81 = 9.81 N at the palm, 3.0 to 3.3 m from the joint axis.
    const load = r.out('j', 'load') as number;
    expect(load).toBeGreaterThan(0.5 * 2 * G * 2.9);
    expect(load).toBeLessThan(0.5 * 2 * G * 3.3);
  });

  it('a crate wider than the opening is never entered: the fingertips stop on it, overlap under 1 mm on every tick', () => {
    // Opening 0.5 m, crate 1.2 m wide across the fingers. Fingertips 0.45 under the wrist: 1.6 + 3 sin a - 0.1 - 0.45 = 1.4  ->  a = 6.70 deg.
    const top = 1.4;
    const want = Math.asin((top + 0.55 - 1.6) / 3) / DEG;
    const r = lower({ top, size: { x: 1.0, z: 1.2 } }, { width: 0.5 });
    let worst = -Infinity;
    for (let i = 0; i < 60 * 4; i++) {
      r.tick();
      worst = Math.max(worst, crateInHand(r.world, 'h', 'g', r.entity('c')!));
    }
    expect(worst).toBeLessThan(MM);
    expect(Math.abs((r.out('j', 'angleNow') as number) - want)).toBeLessThan(0.3);
    expect(r.out('j', 'overloaded')).toBe(true);
    expect(wristY(want) - 0.45).toBeCloseTo(top, 3);
  });
});

describe('a closed hand swept through a crate: the joint needs min(tipping, sliding) force x lever', () => {
  /**
   * Yaw joint on a pedestal (pivot 3 m up), link 1 m along +x, pitch joint at its end hanging the hand straight down, a link of `drop` m,
   * the gripper held closed (fingers 0.16 m apart). The hand swings about the vertical axis toward -z.
   */
  function sweep(o: { torque: number; drop: number; crate: { size: { x: number; y: number; z: number }; z: number }; wall?: boolean; wallFace?: number }) {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
      ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
      ['go', 'on-start'],
      ['yaw', 'const', { value: 40 }],
      ['down', 'const', { value: -90 }],
      ['j1', 'joint', { axis: 'yaw', start: 0, min: -90, max: 90, maxTorque: o.torque, maxSpeed: 15, mount: { x: 0, y: 2.5, z: 0 } }],
      ['l1', 'link', { length: 1, mass: 0 }],
      ['j2', 'joint', { axis: 'pitch', start: -90, min: -90, max: 90, maxTorque: 1000 }],
      ['l2', 'link', { length: o.drop, mass: 0 }],
      ['g', 'gripper', { mass: 0, width: 0.1 }],
      ['k', 'key', { key: 'Space' }],
      ['c', 'item', { shape: 'crate', position: { x: 1, y: o.crate.size.y / 2, z: o.crate.z }, size: o.crate.size, mass: 10, mu: 0.5 }],
    ];
    if (o.wall) nodes.push(['wall', 'block', { position: { x: 1, y: 1, z: (o.wallFace ?? o.crate.z - o.crate.size.z / 2) - 0.25 }, size: { x: 3, y: 2, z: 0.5 } }]);
    const wires: WireSpec[] = [
      ['ped', 'self', 'j1', 'base'],
      ['go', 'started', 'j1', 'power'],
      ['go', 'started', 'j2', 'power'],
      ['yaw', 'value', 'j1', 'angle'],
      ['down', 'value', 'j2', 'angle'],
      ['j1', 'tip', 'l1', 'base'],
      ['l1', 'tip', 'j2', 'base'],
      ['j2', 'tip', 'l2', 'base'],
      ['l2', 'tip', 'g', 'base'],
      ['k', 'held', 'g', 'close'],
    ];
    const r = rig(nodes, wires, '3d', false, true, rapier);
    r.tick(5);
    r.hold('Space');
    return r;
  }

  function go(r: ReturnType<typeof sweep>, seconds: number): { tilt: number; load: number } {
    let tilt = 0;
    let load = 0;
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      r.tick();
      tilt = Math.max(tilt, tipDegrees(r.entity('c')!));
      load = Math.max(load, r.out('j1', 'load') as number);
    }
    return { tilt, load };
  }

  // Tall crate 0.4 x 1.2 x 0.4 at x = 1.0, z = -0.45 (face at -0.25), hand at wrist height 1.0: the palm (0.34 wide, y 0.85 .. 1.0) leads
  // and meets it at h = 0.925 m. Its end is about 9.5 deg round the axis from the hand's own heading, so it pushes along (-0.16, -0.99):
  // the far bottom corner is 0.2 x (0.99 + 0.16) = 0.23 m ahead of the centre, F_tip = 98.1 x 0.23 / 0.925 = 24.4 N (slide: 49.05 N).
  // The palm is 1.0 m from the axis: 24.4 N m.
  const TALL = { x: 0.4, y: 1.2, z: 0.4 };
  it('tall crate: 15 N m stalls (crate untouched, overloaded), 40 N m tips it over', () => {
    const weak = sweep({ torque: 15, drop: 2, crate: { size: TALL, z: -0.45 } });
    const w = go(weak, 8);
    expect(w.tilt).toBeLessThan(0.5);
    expect(weak.out('j1', 'overloaded')).toBe(true);
    expect(Math.abs(weak.entity('c')!.position.z + 0.45)).toBeLessThan(MM);
    expect(w.load).toBeGreaterThan(24.4 * 0.95);
    expect(w.load).toBeLessThan(24.4 * 1.1);

    const strong = sweep({ torque: 40, drop: 2, crate: { size: TALL, z: -0.45 } });
    const s = go(strong, 12);
    expect(s.tilt).toBeGreaterThan(45);
    expect(strong.out('j1', 'overloaded')).toBe(false);
  });

  // Squat crate 0.4 x 0.4 x 0.6 (long across the push) at z = -0.55, hand at wrist height 0.6: the closed fingers (y 0.15 .. 0.45) lead.
  // Tip 98.1 x 0.3 / 0.4 = 73.6 N, slide 49.05 N: it slides. The finger is 1.0 m from the axis: 49 N m.
  const SQUAT = { x: 0.4, y: 0.4, z: 0.6 };
  it('low crate: 40 N m stalls, 80 N m slides it without tipping (the sliding force is the smaller one)', () => {
    const weak = sweep({ torque: 40, drop: 2.4, crate: { size: SQUAT, z: -0.55 } });
    const w = go(weak, 8);
    expect(w.tilt).toBeLessThan(0.5);
    expect(weak.out('j1', 'overloaded')).toBe(true);
    expect(w.load).toBeGreaterThan(49.05 * 0.95);
    expect(w.load).toBeLessThan(49.05 * 1.1);

    const strong = sweep({ torque: 80, drop: 2.4, crate: { size: SQUAT, z: -0.55 } });
    const s = go(strong, 12);
    expect(s.tilt).toBeLessThan(5);
    expect(strong.entity('c')!.position.z).toBeLessThan(-0.9);
    expect(strong.out('j1', 'overloaded')).toBe(false);
  });

  it('a crate against a wall stops the hand instead of being squeezed through: crate within 1 cm of the wall, joint stalled', () => {
    // The wall face is at z = -0.65, the crate's far face: it cannot move that way.
    const r = sweep({ torque: 1000, drop: 2, crate: { size: TALL, z: -0.45 }, wall: true });
    go(r, 12);
    const c = r.entity('c')!;
    expect(c.position.z - TALL.z / 2).toBeGreaterThan(-0.65 - 0.01);
    expect(tipDegrees(c)).toBeLessThan(2);
    expect(r.out('j1', 'overloaded')).toBe(true);
    expect(r.out('j1', 'angleNow') as number).toBeLessThan(40 - 1);
  });

  it('a crate leaning on the wall is not pushed either: joint stalled, crate moved less than 1 cm, tilt changed less than 1 degree', () => {
    // The crate stands 0.1 m off the wall (face at z = -0.65), then leans over onto it.
    const r = sweep({ torque: 1000, drop: 2, crate: { size: TALL, z: -0.35 }, wall: true, wallFace: -0.65 });
    // Lean it toward the wall (top toward -z): it is lifted a hair, turned, and the engine settles it against the wall.
    const c = r.entity('c')!;
    r.world.teleport(c.id, { x: c.position.x, y: c.position.y + 0.002, z: c.position.z }, false);
    const half = (-5.5 * DEG) / 2;
    r.world.setItemRotation(c.id, { x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) });
    r.tick(90);
    const leaning = tipDegrees(r.entity('c')!);
    expect(leaning).toBeGreaterThan(3);
    const before = r.entity('c')!.position;
    const run = go(r, 8);
    const after = r.entity('c')!;
    expect(Math.hypot(after.position.x - before.x, after.position.z - before.z)).toBeLessThan(0.01);
    expect(Math.abs(tipDegrees(after) - leaning)).toBeLessThan(1);
    expect(r.out('j1', 'overloaded')).toBe(true);
    expect(r.out('j1', 'angleNow') as number).toBeLessThan(40 - 1);
    expect(run.load).toBeGreaterThan(0);
  });
});

describe('the crate the hand holds is part of the hand', () => {
  it('2 s held: the crate does not move by more than 1 mm; released in the air it falls straight down', () => {
    const r = fixedHand({ y: 1.5 });
    r.hold('Space');
    r.tick(45);
    expect(r.out('g', 'holding')).toBe(true);
    const at = r.entity('c')!.position;
    let drift = 0;
    for (let i = 0; i < 120; i++) {
      r.tick();
      const p = r.entity('c')!.position;
      drift = Math.max(drift, Math.hypot(p.x - at.x, p.y - at.y, p.z - at.z));
    }
    expect(drift).toBeLessThan(MM);

    // The shelf goes away: the grip carries the crate. Open the hand: it falls with no sideways push from the pads (under 5 mm all the way, landing included).
    r.world.hide(r.entity('shelf')!.id);
    r.tick(20);
    expect(r.out('g', 'holding')).toBe(true);
    const held = r.entity('c')!.position;
    r.hold();
    let lateral = 0;
    let fell = false;
    for (let i = 0; i < 30; i++) {
      r.tick();
      const p = r.entity('c')!.position;
      lateral = Math.max(lateral, Math.hypot(p.x - held.x, p.z - held.z));
      // It drops onto the pedestal top (y = 1.0): 0.2 m.
      if (held.y - p.y > 0.19) fell = true;
    }
    expect(fell).toBe(true);
    expect(lateral).toBeLessThan(5 * MM);
  });
});
