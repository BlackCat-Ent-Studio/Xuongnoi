import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { marker, navRig, poseOf, stateHash, CHASSIS_Y } from '../helpers/nav-rig';
import { crateOnTray, liesOnTray, trayPose, type TraySize } from '../helpers/tray-metrics';

/**
 * A tray that tips to the SIDE of a robot, made of existing pieces only:
 *  - a turntable joint (vertical axis, held at 90 degrees) on the chassis, at the side the load is to leave over;
 *  - a tilt joint (horizontal axis) on the turntable's tip;
 *  - a wide solid link on the tilt joint's tip.
 * The link then lies across the chassis, hinged along that side; tipping it raises the inner end and the crate slides off
 * over the side. "Đi tới điểm" drives the robot, and the tray tips when it says the robot has arrived.
 * The crate is measured against the plate worked out from the tilt joint's frame on every tick.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

interface Size {
  length: number;
  width: number;
  height: number;
}

const BIG: Size = { length: 1.2, width: 1, height: 0.3 };
/** The size the navigation boards use. */
const SMALL: Size = { length: 0.9, width: 0.7, height: 0.3 };
/** `length` runs across the chassis (from the hinge inwards), `width` along it. */
const TRAY: TraySize = { length: 0.6, thickness: 0.05, width: 0.6 };
const CRATE = { x: 0.4, y: 0.4, z: 0.4 };

interface Build {
  crateKg: number;
  tilt: number;
  /** +1 = dumps to the robot's right, -1 = to its left. */
  side?: 1 | -1;
  chassis?: Size;
  tray?: TraySize;
  crate?: { x: number; y: number; z: number };
  /** Gap (m) between the chassis top and the underside of the plate. */
  gap?: number;
  /** How far (m) from the centre line the hinge is; absent = on the side edge of the chassis. */
  hinge?: number;
  jointSpeed?: number;
  heading?: number;
  drive?: Record<string, number | string>;
  face?: number;
  goal?: { x: number; z: number };
  looks?: boolean;
}

function build(b: Build) {
  const chassis = b.chassis ?? BIG;
  const tray = b.tray ?? TRAY;
  const crate = b.crate ?? CRATE;
  const side = b.side ?? 1;
  const heading = b.heading ?? 0;
  const rad = (heading * Math.PI) / 180;
  const y0 = chassis.height / 2;
  const up = chassis.height / 2 + (b.gap ?? 0.01) + tray.thickness / 2;
  const top = y0 + up + tray.thickness / 2;
  const hinge = b.hinge ?? chassis.width / 2;
  // The plate reaches `tray.length` across the chassis from the hinge, so its middle is this far to the side.
  const across = side * (hinge - tray.length / 2);
  const goal = b.goal ?? { x: 5, z: 3 };
  const facing = b.face !== undefined;
  const nodes: NodeSpec[] = [
    ['r', 'robot-body', { position: { x: 0, y: y0, z: 0 }, heading, ...chassis, mass: 5, friction: 0.8, showPayload: 'yes', ...(b.looks ? { look: 'agv' } : {}) }],
    ['ml', 'motor', { side: -(chassis.width / 2 - 0.05), accel: 400 }],
    ['mr', 'motor', { side: chassis.width / 2 - 0.05, accel: 400 }],
    ['r-go', 'robot-goto', { ...(b.drive ?? {}), ...(facing ? { faceOnArrive: 'yes' } : {}) }],
    ['face', 'const', { value: b.face ?? 0 }],
    marker(1, goal.x, goal.z),
    ['on', 'on-start', {}],
    // Turntable: at the side, held at a quarter turn so that everything on it points across the chassis.
    ['turn', 'joint', { axis: 'yaw', start: side * 90, min: -180, max: 180, mount: { x: 0, y: up, z: side * hinge }, solid: 'no', ...(b.looks ? { look: 'hinge' } : {}) }],
    ['tilt', 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, maxSpeed: b.jointSpeed ?? 60, solid: 'no', ...(b.looks ? { look: 'hinge' } : {}) }],
    ['tray', 'link', { length: tray.length, thickness: tray.thickness, width: tray.width, solid: 'yes', mass: 1, ...(b.looks ? { look: 'factory' } : {}) }],
    ['angle', 'bool-to-number', { whenOn: b.tilt, whenOff: 0 }],
    // The crate starts over the middle of the plate, wherever the chassis points.
    ['crate', 'item', { shape: 'crate', position: { x: -Math.sin(rad) * across, y: top + crate.y / 2 + 0.005, z: Math.cos(rad) * across }, size: crate, mass: b.crateKg, ...(b.looks ? { look: 'parcel-carton' } : {}) }],
  ];
  const wires: WireSpec[] = [
    ['r', 'self', 'ml', 'body'], ['r', 'self', 'mr', 'body'], ['r', 'self', 'r-go', 'robot'],
    ['r-go', 'left', 'ml', 'power'], ['r-go', 'right', 'mr', 'power'],
    ['m1', 'self', 'r-go', 'target'], ['on', 'started', 'r-go', 'go'],
    ['r', 'self', 'turn', 'base'], ['on', 'started', 'turn', 'power'],
    ['turn', 'tip', 'tilt', 'base'], ['on', 'started', 'tilt', 'power'],
    ['tilt', 'tip', 'tray', 'base'],
    // The tray tips when the controller says the robot has arrived.
    ['r-go', 'arrived', 'angle', 'on'], ['angle', 'value', 'tilt', 'angle'],
    ...(facing ? ([['face', 'value', 'r-go', 'face']] as WireSpec[]) : []),
  ];
  return { rig: navRig(nodes, wires, rapier), chassis, tray, crate, side };
}

/** Where the crate lies, seen from the robot: metres out to the dump side of the chassis middle, and metres ahead of it. */
function fromRobot(r: ReturnType<typeof build>): { y: number; side: number; ahead: number; heading: number } {
  const crate = r.rig.entity('crate')!;
  const body = poseOf(r.rig.entity('r')!);
  const rad = (body.heading * Math.PI) / 180;
  const dx = crate.position.x - body.x;
  const dz = crate.position.z - body.z;
  // The robot's right is (-sin, cos) of its heading on (x, z).
  return { y: crate.position.y, side: r.side * (-dx * Math.sin(rad) + dz * Math.cos(rad)), ahead: dx * Math.cos(rad) + dz * Math.sin(rad), heading: body.heading };
}

interface Ride {
  arrivedAt: number;
  /** Ticks before arrival on which the crate did not lie on the tray. */
  offTray: number;
  /** Largest move of the crate along / across the plate from where it started (m), up to arrival. */
  slideAlong: number;
  slideAcross: number;
  overlap: number;
  payloadOnTheWay: number;
  /** Seconds after arrival at which the crate left the tray (-1 = never). */
  leftAfter: number;
  restY: number;
  restSide: number;
  restAhead: number;
  heading: number;
  chassisMovedAfterArrival: number;
  hash: number;
}

function ride(b: Build, secondsAfter = 6): Ride {
  const built = build(b);
  const r = built.rig;
  const out: Ride = { arrivedAt: -1, offTray: 0, slideAlong: 0, slideAcross: 0, overlap: 0, payloadOnTheWay: 0, leftAfter: -1, restY: 0, restSide: 0, restAhead: 0, heading: 0, chassisMovedAfterArrival: 0, hash: 2166136261 };
  let first: { along: number; lateral: number } | null = null;
  let stopAt: { x: number; z: number } | null = null;
  for (let k = 0; k < 40 / TICK_DT; k++) {
    r.tick();
    out.hash = stateHash(out.hash, r.world.entities());
    const pose = trayPose(r.world, 'tilt', built.tray)!;
    const m = crateOnTray(pose, built.tray, r.entity('crate')!);
    const on = liesOnTray(m, built.tray, built.crate.y);
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
    if (out.leftAfter < 0 && !on && (m.along < 0 || m.rise > built.crate.y)) out.leftAfter = since;
    if (since >= secondsAfter) break;
  }
  const at = fromRobot(built);
  const body = poseOf(r.entity('r')!);
  out.heading = at.heading;
  out.restY = at.y;
  out.restSide = at.side;
  out.restAhead = at.ahead;
  if (stopAt) out.chassisMovedAfterArrival = Math.hypot(body.x - stopAt.x, body.z - stopAt.z);
  r.world.dispose?.();
  return out;
}

/** A parked robot tips its tray at once; where the crate lies after 6 s, seen from the robot. */
function dumpStanding(b: Build): { y: number; side: number; ahead: number } {
  const built = build({ ...b, goal: { x: 0, z: 0 } });
  for (let k = 0; k < 6 / TICK_DT; k++) built.rig.tick();
  const at = fromRobot(built);
  built.rig.world.dispose?.();
  return at;
}

/**
 * The zone the crate comes to rest in, beside the robot: on the floor, clear of the chassis side by at least half its own
 * width, no more than 0.75 m beyond that side, and within 0.35 m ahead of or behind the chassis middle (it tips over the
 * plate's edge and may roll a quarter turn on landing).
 */
function expectInZone(at: { y: number; side: number; ahead: number }, chassis: Size, crate: { x: number; y: number; z: number }, note: string): void {
  const lying = Math.min(crate.x, crate.y, crate.z) / 2;
  expect(at.y, note).toBeLessThan(Math.max(crate.x, crate.y, crate.z) / 2 + 0.02);
  expect(at.y, note).toBeGreaterThan(lying - 0.02);
  expect(at.side, note).toBeGreaterThan(chassis.width / 2 + lying);
  expect(at.side, note).toBeLessThan(chassis.width / 2 + 0.75);
  expect(Math.abs(at.ahead), note).toBeLessThan(0.35);
}

describe('a crate on a side-tipping tray, on a robot driven by "Đi tới điểm"', () => {
  for (const side of [1, -1] as const) {
    for (const chassis of [BIG, SMALL]) {
      for (const [kg, heading, face] of [[1, 0, 0], [5, 120, 90], [3, -90, 180], [5, 45, -90]] as const) {
        it(`${chassis.length} x ${chassis.width} m robot, ${kg} kg, tray to the ${side > 0 ? 'right' : 'left'}, start heading ${heading}: rides through the turn, the run and the stop, squares up to ${face}, then is tipped off sideways at 35 degrees`, () => {
          const res = ride({ crateKg: kg, tilt: 35, side, chassis, heading, face });
          expect(res.arrivedAt).toBeGreaterThan(0);
          expect(res.arrivedAt).toBeLessThan(15);
          expect(Math.abs(((res.heading - face + 540) % 360) - 180)).toBeLessThanOrEqual(4);
          expect(res.offTray).toBe(0);
          // Measured: it creeps at most 2 mm along and 7 mm across the 0.6 m plate.
          expect(res.slideAlong).toBeLessThan(0.03);
          expect(res.slideAcross).toBeLessThan(0.03);
          expect(res.overlap).toBeLessThan(0.003);
          // The chassis weighs the crate, not the turntable, the hinge or the plate.
          expect(res.payloadOnTheWay).toBeCloseTo(kg, 1);
          // Tipped: off the tray within 3 s, on the floor beside the robot; the robot stays put.
          expect(res.leftAfter).toBeGreaterThan(0);
          expect(res.leftAfter).toBeLessThan(3);
          expectInZone({ y: res.restY, side: res.restSide, ahead: res.restAhead }, chassis, CRATE, 'rest');
          expect(res.chassisMovedAfterArrival).toBeLessThan(0.03);
        });
      }
    }
  }

  it.each([30, 45, 60, 135, -15, -60, -120, 165])('arriving at %s degrees to the axes and turning to exactly that heading, a tilt of 35 degrees dumps the crate to the side', (deg) => {
    const goal = { x: 5 * Math.cos((deg * Math.PI) / 180), z: 5 * Math.sin((deg * Math.PI) / 180) };
    for (const side of [1, -1] as const) {
      const res = ride({ crateKg: 2, tilt: 35, side, goal, face: deg });
      expect(res.arrivedAt, `${side}`).toBeGreaterThan(0);
      expect(Math.abs(((res.heading - deg + 540) % 360) - 180), `${side}`).toBeLessThanOrEqual(4);
      expect(res.offTray, `${side}`).toBe(0);
      expect(res.leftAfter, `${side}`).toBeGreaterThan(0);
      expect(res.leftAfter, `${side}`).toBeLessThan(3);
      expectInZone({ y: res.restY, side: res.restSide, ahead: res.restAhead }, BIG, CRATE, `${side}`);
    }
  });

  it('standing at every heading in steps of 5 degrees, a tilt of 35 degrees dumps the crate into the same zone beside the robot, on either side', () => {
    for (const side of [1, -1] as const) {
      for (let deg = 0; deg < 360; deg += 5) {
        expectInZone(dumpStanding({ crateKg: 2, tilt: 35, side, heading: deg }), BIG, CRATE, `${side} at ${deg}`);
      }
    }
  });

  it('1 and 5 kg, on the small robot too, land in the zone at headings askew to the axes', () => {
    for (const chassis of [BIG, SMALL]) {
      for (const kg of [1, 5]) {
        for (const deg of [0, 30, 45, 60, 135, 200, 290]) {
          expectInZone(dumpStanding({ crateKg: kg, tilt: 35, chassis, heading: deg }), chassis, CRATE, `${chassis.length} m, ${kg} kg at ${deg}`);
        }
      }
    }
  });

  it.each([30, 45, 60])('a tilt of %s degrees dumps too', (tilt) => {
    for (const deg of [0, 45, 135]) expectInZone(dumpStanding({ crateKg: 2, tilt, heading: deg }), BIG, CRATE, `${deg}`);
  });

  it('a tilt of 20 degrees is under the friction angle: the crate stays on the tray', () => {
    const res = ride({ crateKg: 2, tilt: 20, goal: { x: 5, z: 0 } });
    expect(res.offTray).toBe(0);
    expect(res.leftAfter).toBe(-1);
    expect(res.restY).toBeGreaterThan(CHASSIS_Y + 0.3);
    expect(res.restSide).toBeLessThan(BIG.width / 2);
  });

  it('a slow joint (20 degrees per second) dumps at 35 degrees too', () => {
    const res = ride({ crateKg: 2, tilt: 35, jointSpeed: 20, goal: { x: 5, z: 0 } }, 8);
    expect(res.leftAfter).toBeGreaterThan(0);
    expectInZone({ y: res.restY, side: res.restSide, ahead: res.restAhead }, BIG, CRATE, 'slow');
  });

  it('full power: the crate still arrives on the tray', () => {
    const res = ride({ crateKg: 1, tilt: 0, heading: 180, drive: { power: 1 } });
    expect(res.arrivedAt).toBeGreaterThan(0);
    expect(res.offTray).toBe(0);
    expect(res.slideAlong).toBeLessThan(0.2);
    expect(res.slideAcross).toBeLessThan(0.2);
  });

  it('the factory-look robot (0.9 x 0.7 x 0.24 m, plate 0.62 across by 0.74 along on a 5 cm stand, hinge on the plate edge) carries and dumps a 0.3 m carton', () => {
    const chassis: Size = { length: 0.9, width: 0.7, height: 0.24 };
    const tray: TraySize = { length: 0.62, thickness: 0.05, width: 0.74 };
    const carton = { x: 0.3, y: 0.22, z: 0.26 };
    for (const side of [1, -1] as const) {
      for (const kg of [1, 2, 5]) {
        const res = ride({ crateKg: kg, tilt: 35, side, chassis, tray, crate: carton, gap: 0.05, hinge: 0.31, heading: 120, face: 45, looks: true });
        expect(res.arrivedAt, `${side} ${kg}`).toBeGreaterThan(0);
        expect(res.offTray, `${side} ${kg}`).toBe(0);
        expect(res.payloadOnTheWay, `${side} ${kg}`).toBeCloseTo(kg, 1);
        expect(res.leftAfter, `${side} ${kg}`).toBeGreaterThan(0);
        expect(res.leftAfter, `${side} ${kg}`).toBeLessThan(3);
        expectInZone({ y: res.restY, side: res.restSide, ahead: res.restAhead }, chassis, carton, `${side} ${kg}`);
        expect(res.chassisMovedAfterArrival, `${side} ${kg}`).toBeLessThan(0.03);
      }
    }
  });

  it('the same ride twice gives the same state on every tick', () => {
    expect(ride({ crateKg: 1, tilt: 35, heading: 120, face: 45 }).hash).toBe(ride({ crateKg: 1, tilt: 35, heading: 120, face: 45 }).hash);
  });
});
