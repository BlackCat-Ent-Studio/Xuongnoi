import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { marker, navRig, poseOf, stateHash, CHASSIS_Y } from '../helpers/nav-rig';
import { crateOnTray, liesOnTray, trayPose, type TraySize } from '../helpers/tray-metrics';

/**
 * A tilt tray made of existing pieces (a pitch joint at the back edge of a robot chassis, drawn hub only, and a wide
 * solid link) on a robot that "Đi tới điểm" drives. The crate must ride on the tray through the turn on the spot, the run
 * and the stop, and leave it when the joint tips to 35 degrees or more at no more than 60 degrees per second.
 * The crate is measured against the plate worked out from the joint's frame on every tick.
 *
 * Crates meet a chassis by its real outline, turned to its heading, so nothing reaches out under the tray's edge when the
 * robot stands askew to the world axes: the dump works at every heading, squared up or not.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const CHASSIS = { length: 1.2, width: 1, height: 0.3, mass: 5 };
const TRAY: TraySize = { length: 0.6, thickness: 0.05, width: 0.6 };
const CRATE = 0.4;
const UP = CHASSIS.height / 2 + 0.01 + TRAY.thickness / 2;
const TRAY_TOP = CHASSIS_Y + UP + TRAY.thickness / 2;
const PIVOT = -CHASSIS.length / 2;
const GOAL = { x: 5, z: 3 };

interface Build {
  crateKg: number;
  /** Degrees the tray tips to once the robot has arrived. */
  tilt: number;
  jointSpeed?: number;
  /** Start heading of the robot, degrees. */
  heading?: number;
  /** Settings of the "Đi tới điểm" card. */
  drive?: Record<string, number | string>;
  /** Heading (degrees) the robot turns to at the goal before it counts as arrived; absent = it stops as it came. */
  face?: number;
  goal?: { x: number; z: number };
  /** Motor ramp, rpm per second. */
  accel?: number;
}

function build(b: Build) {
  const heading = b.heading ?? 0;
  const rad = (heading * Math.PI) / 180;
  // The crate starts over the middle of the tray, which lies behind the pivot's forward direction of the turned chassis.
  const along = PIVOT + TRAY.length / 2;
  const goal = b.goal ?? GOAL;
  const facing = b.face !== undefined;
  const nodes: NodeSpec[] = [
    ['r', 'robot-body', { position: { x: 0, y: CHASSIS_Y, z: 0 }, heading, ...CHASSIS, friction: 0.8, showPayload: 'yes' }],
    ['ml', 'motor', { side: -0.45, accel: b.accel ?? 400 }],
    ['mr', 'motor', { side: 0.45, accel: b.accel ?? 400 }],
    ['r-go', 'robot-goto', { ...(b.drive ?? {}), ...(facing ? { faceOnArrive: 'yes' } : {}) }],
    ['face', 'const', { value: b.face ?? 0 }],
    marker(1, goal.x, goal.z),
    ['on', 'on-start', {}],
    ['tilt', 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, maxSpeed: b.jointSpeed ?? 60, mount: { x: PIVOT, y: UP, z: 0 }, solid: 'no' }],
    ['tray', 'link', { length: TRAY.length, thickness: TRAY.thickness, width: TRAY.width, solid: 'yes', mass: 1 }],
    ['angle', 'bool-to-number', { whenOn: b.tilt, whenOff: 0 }],
    ['crate', 'item', { shape: 'crate', position: { x: Math.cos(rad) * along, y: TRAY_TOP + CRATE / 2 + 0.005, z: Math.sin(rad) * along }, size: { x: CRATE, y: CRATE, z: CRATE }, mass: b.crateKg }],
  ];
  const wires: WireSpec[] = [
    ['r', 'self', 'ml', 'body'], ['r', 'self', 'mr', 'body'], ['r', 'self', 'r-go', 'robot'],
    ['r-go', 'left', 'ml', 'power'], ['r-go', 'right', 'mr', 'power'],
    ['m1', 'self', 'r-go', 'target'], ['on', 'started', 'r-go', 'go'],
    ['r', 'self', 'tilt', 'base'], ['on', 'started', 'tilt', 'power'], ['tilt', 'tip', 'tray', 'base'],
    // The tray tips when the controller says the robot has arrived.
    ['r-go', 'arrived', 'angle', 'on'], ['angle', 'value', 'tilt', 'angle'],
    ...(facing ? ([['face', 'value', 'r-go', 'face']] as WireSpec[]) : []),
  ];
  return navRig(nodes, wires, rapier);
}

interface Ride {
  arrivedAt: number;
  /** Ticks before arrival on which the crate did not lie on the tray. */
  offTray: number;
  /** Largest move of the crate along / across the tray from where it started (m), up to arrival. */
  slideAlong: number;
  slideAcross: number;
  /** Deepest the crate got into the plate (m). */
  overlap: number;
  payloadOnTheWay: number;
  /** Seconds after arrival at which the crate left the tray (-1 = never). */
  leftAfter: number;
  /** Where the crate rests at the end: height of its middle, distance from the chassis middle, and how far behind the chassis. */
  restY: number;
  restFromChassis: number;
  restBehind: number;
  /** Heading of the chassis at the end, degrees. */
  heading: number;
  chassisMovedAfterArrival: number;
  hash: number;
}

function ride(b: Build, secondsAfter = 6): Ride {
  const r = build(b);
  const out: Ride = { arrivedAt: -1, offTray: 0, slideAlong: 0, slideAcross: 0, overlap: 0, payloadOnTheWay: 0, leftAfter: -1, restY: 0, restFromChassis: 0, restBehind: 0, heading: 0, chassisMovedAfterArrival: 0, hash: 2166136261 };
  let first: { along: number; lateral: number } | null = null;
  let stopAt: { x: number; z: number } | null = null;
  for (let k = 0; k < 40 / TICK_DT; k++) {
    r.tick();
    out.hash = stateHash(out.hash, r.world.entities());
    const pose = trayPose(r.world, 'tilt', TRAY)!;
    const m = crateOnTray(pose, TRAY, r.entity('crate')!);
    const on = liesOnTray(m, TRAY, CRATE);
    if (out.arrivedAt < 0) {
      // The first ticks are the crate settling the 5 mm it was placed above the tray.
      if (k >= 30) {
        first ??= { along: m.along, lateral: m.lateral };
        if (!on) out.offTray += 1;
        out.slideAlong = Math.max(out.slideAlong, Math.abs(m.along - first.along));
        out.slideAcross = Math.max(out.slideAcross, Math.abs(m.lateral - first.lateral));
        out.overlap = Math.max(out.overlap, m.overlap);
        out.payloadOnTheWay = Math.max(out.payloadOnTheWay, r.out('r', 'payload') as number);
      }
      if (r.out('r-go', 'arrived') === true) {
        out.arrivedAt = (k + 1) * TICK_DT;
        const at = poseOf(r.entity('r')!);
        stopAt = { x: at.x, z: at.z };
      }
      continue;
    }
    const since = (k + 1) * TICK_DT - out.arrivedAt;
    if (out.leftAfter < 0 && !on && (m.along < 0 || m.rise > CRATE)) out.leftAfter = since;
    if (since >= secondsAfter) break;
  }
  const crate = r.entity('crate')!;
  const body = poseOf(r.entity('r')!);
  const rad = (body.heading * Math.PI) / 180;
  out.heading = body.heading;
  out.restY = crate.position.y;
  out.restFromChassis = Math.hypot(crate.position.x - body.x, crate.position.z - body.z);
  out.restBehind = -((crate.position.x - body.x) * Math.cos(rad) + (crate.position.z - body.z) * Math.sin(rad));
  if (stopAt) out.chassisMovedAfterArrival = Math.hypot(body.x - stopAt.x, body.z - stopAt.z);
  r.world.dispose?.();
  return out;
}

/** A parked robot at `heading` tips its tray at once; where the crate lies after 6 s, seen from the robot. */
function dumpStanding(heading: number, tilt: number, crateKg: number): { restY: number; restBehind: number; restAcross: number } {
  const r = build({ crateKg, tilt, heading, goal: { x: 0, z: 0 } });
  for (let k = 0; k < 6 / TICK_DT; k++) r.tick();
  const crate = r.entity('crate')!;
  const body = poseOf(r.entity('r')!);
  const rad = (body.heading * Math.PI) / 180;
  const dx = crate.position.x - body.x;
  const dz = crate.position.z - body.z;
  r.world.dispose?.();
  return { restY: crate.position.y, restBehind: -(dx * Math.cos(rad) + dz * Math.sin(rad)), restAcross: -dx * Math.sin(rad) + dz * Math.cos(rad) };
}

describe('a crate on a tilt tray, on a robot driven by "Đi tới điểm"', () => {
  for (const kg of [1, 5]) {
    for (const [heading, face] of [[0, 0], [120, 90], [-90, 180], [45, -90]] as const) {
      it(`${kg} kg, start heading ${heading}: rides through the turn, the run, the stop and the squaring-up to ${face}, then is tipped off at 35 degrees`, () => {
        const res = ride({ crateKg: kg, tilt: 35, heading, face });
        expect(res.arrivedAt).toBeGreaterThan(0);
        expect(res.arrivedAt).toBeLessThan(15);
        expect(Math.abs(((res.heading - face + 540) % 360) - 180)).toBeLessThanOrEqual(4);
        expect(res.offTray).toBe(0);
        // It may creep a little while the robot speeds up, turns and brakes; it stays well inside the 0.6 m plate.
        expect(res.slideAlong).toBeLessThan(0.08);
        expect(res.slideAcross).toBeLessThan(0.08);
        expect(res.overlap).toBeLessThan(0.003);
        // The chassis weighs the crate, not its own tray.
        expect(res.payloadOnTheWay).toBeCloseTo(kg, 1);
        // Tipped: off the tray within 3 s, lying on the floor behind the robot, clear of the chassis; the robot stays put.
        expect(res.leftAfter).toBeGreaterThan(0);
        expect(res.leftAfter).toBeLessThan(3);
        expect(res.restY).toBeLessThan(CRATE / 2 + 0.02);
        expect(res.restBehind).toBeGreaterThan(CHASSIS.length / 2 + CRATE / 2);
        expect(res.restFromChassis).toBeLessThan(2.5);
        expect(res.chassisMovedAfterArrival).toBeLessThan(0.03);
      });
    }
  }

  it.each([35, 45, 60])('driving along a world axis, a tilt of %s degrees at 60 degrees per second dumps the crate without squaring up', (tilt) => {
    for (const [heading, goal] of [[0, { x: 5, z: 0 }], [90, { x: 0, z: 5 }], [180, { x: -5, z: 0 }]] as const) {
      const res = ride({ crateKg: 2, tilt, heading, goal });
      expect(res.offTray, `${heading}`).toBe(0);
      expect(res.leftAfter, `${heading}`).toBeGreaterThan(0);
      expect(res.restY, `${heading}`).toBeLessThan(CRATE / 2 + 0.02);
    }
  });

  it('arriving askew (31 or 45 degrees to the axes) without squaring up, a tilt of 60 degrees dumps the crate', () => {
    for (const goal of [GOAL, { x: 4, z: 4 }, { x: -3, z: 4 }]) {
      const res = ride({ crateKg: 2, tilt: 60, goal });
      expect(res.offTray).toBe(0);
      expect(res.leftAfter).toBeGreaterThan(0);
      expect(res.restY).toBeLessThan(CRATE / 2 + 0.02);
    }
  });

  // The chassis box turns with the robot, so no corner of it reaches out under the tray's edge at any heading.
  const ARRIVALS = [10, 20, 30, 45, 60, 80, 135, -15, -30, -45, -60, -75, -120, -150, 165];
  const towards = (deg: number): { x: number; z: number } => ({ x: 5 * Math.cos((deg * Math.PI) / 180), z: 5 * Math.sin((deg * Math.PI) / 180) });

  it.each(ARRIVALS)('arriving at %s degrees to the axes without squaring up, a tilt of 35 degrees dumps the crate behind the robot', (deg) => {
    for (const kg of [1, 5]) {
      // It comes in along the line to the goal and turns to exactly this heading there: askew to the world axes.
      const res = ride({ crateKg: kg, tilt: 35, goal: towards(deg), face: deg });
      expect(res.arrivedAt, `${kg} kg`).toBeGreaterThan(0);
      expect(Math.abs(((res.heading - deg + 540) % 360) - 180), `${kg} kg`).toBeLessThanOrEqual(4);
      expect(res.offTray, `${kg} kg`).toBe(0);
      expect(res.slideAlong, `${kg} kg`).toBeLessThan(0.08);
      expect(res.slideAcross, `${kg} kg`).toBeLessThan(0.08);
      expect(res.leftAfter, `${kg} kg`).toBeGreaterThan(0);
      expect(res.leftAfter, `${kg} kg`).toBeLessThan(3);
      expect(res.restY, `${kg} kg`).toBeLessThan(CRATE / 2 + 0.02);
      expect(res.restBehind, `${kg} kg`).toBeGreaterThan(CHASSIS.length / 2 + CRATE / 2);
      expect(res.restFromChassis, `${kg} kg`).toBeLessThan(2.5);
      expect(res.chassisMovedAfterArrival, `${kg} kg`).toBeLessThan(0.03);
    }
  });

  it('standing at every heading in steps of 5 degrees, a tilt of 35 degrees dumps the crate to the same place behind the robot', () => {
    for (let deg = 0; deg < 360; deg += 5) {
      const res = dumpStanding(deg, 35, 2);
      expect(res.restY, `${deg}`).toBeLessThan(CRATE / 2 + 0.02);
      expect(res.restBehind, `${deg}`).toBeGreaterThan(CHASSIS.length / 2 + CRATE / 2);
      expect(res.restBehind, `${deg}`).toBeLessThan(1.4);
      // Measured over the 72 headings: 1.08 to 1.18 m behind the chassis middle, at most 0.22 m to either side.
      expect(Math.abs(res.restAcross), `${deg}`).toBeLessThan(0.3);
    }
  });

  it('tilts of 45 and 60 degrees dump at every one of those headings too', () => {
    for (const tilt of [45, 60]) {
      for (const deg of [20, 30, 45, 60, 135, -30, -120]) {
        const res = ride({ crateKg: 2, tilt, goal: towards(deg) });
        expect(res.offTray, `${tilt} at ${deg}`).toBe(0);
        expect(res.leftAfter, `${tilt} at ${deg}`).toBeGreaterThan(0);
        expect(res.restY, `${tilt} at ${deg}`).toBeLessThan(CRATE / 2 + 0.02);
        expect(res.restBehind, `${tilt} at ${deg}`).toBeGreaterThan(CHASSIS.length / 2 + CRATE / 2);
      }
    }
  });

  it('a slow joint (20 degrees per second) dumps at 35 degrees too', () => {
    const res = ride({ crateKg: 2, tilt: 35, jointSpeed: 20, goal: { x: 5, z: 0 } }, 8);
    expect(res.leftAfter).toBeGreaterThan(0);
    expect(res.restY).toBeLessThan(CRATE / 2 + 0.02);
  });

  it('a tilt of 15 degrees is under the friction angle: the crate stays on the tray', () => {
    const res = ride({ crateKg: 2, tilt: 15, goal: { x: 5, z: 0 } });
    expect(res.offTray).toBe(0);
    expect(res.leftAfter).toBe(-1);
    expect(res.restY).toBeGreaterThan(TRAY_TOP);
  });

  it('full power: the crate slides more on the tray but still arrives on it', () => {
    const res = ride({ crateKg: 1, tilt: 0, heading: 180, drive: { power: 1 } });
    expect(res.arrivedAt).toBeGreaterThan(0);
    expect(res.offTray).toBe(0);
    expect(res.slideAlong).toBeLessThan(0.2);
  });

  it('the same ride twice gives the same state on every tick', () => {
    expect(ride({ crateKg: 1, tilt: 35, heading: 120, face: 90 }).hash).toBe(ride({ crateKg: 1, tilt: 35, heading: 120, face: 90 }).hash);
  });
});
