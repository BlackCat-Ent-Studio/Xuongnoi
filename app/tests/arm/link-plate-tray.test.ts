import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type ParamValue } from '../../src/engine/types';
import { linkCubes, linkOutline } from '../../src/world/arm-solid';
import type { Frame } from '../../src/world/arm-kinematics';
import { obbCorners, obbSeparation, obbOf, type Obb } from '../../src/world/oriented-box';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { crateOnTray, liesOnTray, trayPose, type OnTray, type TraySize } from '../helpers/tray-metrics';

/**
 * A link with a "Bề rộng" is a flat plate. Mounted on a pitch joint on a robot chassis it is a tilt tray: a rigid crate
 * rests on it, rides along, and slides off when the joint tips it past the friction angle (μ 0.5: 26.6 degrees).
 * The crate's place is measured every tick against the plate worked out from the joint frame and the sizes on the cards.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const MM = 0.001;
const CHASSIS = { length: 1.2, width: 1, height: 0.3, mass: 5 };
const TRAY: TraySize = { length: 0.6, thickness: 0.05, width: 0.6 };
const CRATE = 0.4;
/** The joint sits this far above the chassis centre: the tray's underside clears the chassis top by 1 cm. */
const UP = CHASSIS.height / 2 + 0.01 + TRAY.thickness / 2;
const TRAY_TOP = CHASSIS.height / 2 + UP + TRAY.thickness / 2;
/** The pivot sits at the back edge of the chassis's collision square (as wide as the chassis is long). */
const PIVOT_X = -CHASSIS.length / 2;

interface Build {
  crateKg: number;
  /** Tray sizes other than the 0.6 x 0.6 m plate. */
  tray?: Partial<TraySize>;
  jointSpeed?: number;
  maxTorque?: number;
  /** Crate centre sideways from the tray's centre line (m). */
  lateral?: number;
  real?: boolean;
  /** Leave the width param off the card altogether, like a board saved before it existed. */
  noWidthParam?: boolean;
}

function build(b: Build) {
  const tray = { ...TRAY, ...(b.tray ?? {}) };
  // A card saved before the setting existed has no value for it at all.
  const link: Record<string, ParamValue> = { length: tray.length, thickness: tray.thickness, solid: 'yes', mass: 1, width: b.noWidthParam ? (undefined as unknown as ParamValue) : tray.width };
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 20 } }],
    ['body', 'robot-body', { position: { x: 0, y: CHASSIS.height / 2, z: 0 }, heading: 0, ...CHASSIS, friction: 0.8 }],
    ['ml', 'motor', { side: -0.45, maxRpm: 90, maxForce: 6 }],
    ['mr', 'motor', { side: 0.45, maxRpm: 90, maxForce: 6 }],
    ['p', 'const', { value: 0 }],
    ['go', 'on-start', {}],
    ['ang', 'const', { value: 0 }],
    // The pivot is at the back edge of the chassis and of the tray; raising the angle lifts the front, so the crate slides off the back.
    // The hub is drawn only: a solid hub would stand 12 cm above the tray and hold the crate back.
    ['tilt', 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: b.maxTorque ?? 150, maxSpeed: b.jointSpeed ?? 60, mount: { x: PIVOT_X, y: UP, z: 0 }, solid: 'no' }],
    ['tray', 'link', link],
    ['crate', 'item', { shape: 'crate', position: { x: PIVOT_X + tray.length / 2, y: TRAY_TOP + CRATE / 2 + 0.005, z: b.lateral ?? 0 }, size: { x: CRATE, y: CRATE, z: CRATE }, mass: b.crateKg }],
  ];
  const wires: WireSpec[] = [
    ['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'],
    ['p', 'value', 'ml', 'power'], ['p', 'value', 'mr', 'power'],
    ['body', 'self', 'tilt', 'base'], ['go', 'started', 'tilt', 'power'], ['ang', 'value', 'tilt', 'angle'], ['tilt', 'tip', 'tray', 'base'],
  ];
  const real = b.real !== false;
  const r = rig(nodes, wires, '3d', false, real, real ? rapier : undefined);
  return { ...r, tray };
}

type Rig = ReturnType<typeof build>;

interface Sample extends OnTray {
  t: number;
  y: number;
  /** How deep the crate is inside the chassis box (m; negative = clear). */
  inChassis: number;
  on: boolean;
}

function watch(r: Rig, seconds: number, t0 = 0, each?: (t: number) => void): Sample[] {
  const out: Sample[] = [];
  for (let k = 0; k < Math.round(seconds / TICK_DT); k++) {
    each?.(t0 + k * TICK_DT);
    r.tick();
    const pose = trayPose(r.world, 'tilt', r.tray)!;
    const crate = r.entity('crate')!;
    const m = crateOnTray(pose, r.tray, crate);
    const body = r.entity('body')!;
    const inChassis = -obbSeparation(obbOf(body.position, body.size), obbOf(crate.position, crate.size, crate.rotation));
    out.push({ ...m, t: t0 + (k + 1) * TICK_DT, y: crate.position.y, inChassis, on: liesOnTray(m, r.tray, CRATE) });
  }
  return out;
}

const max = (xs: number[]): number => xs.reduce((a, c) => Math.max(a, c), -Infinity);
const min = (xs: number[]): number => xs.reduce((a, c) => Math.min(a, c), Infinity);

describe('the shape of a link with a width', () => {
  const level: Frame = { pos: { x: 1, y: 2, z: 3 }, yaw: 0, pitch: 0 };

  it('a link without a width is the square bar it always was: same cover cubes, same exact box', () => {
    for (const f of [level, { ...level, yaw: 0.7, pitch: 0.4 }]) {
      expect(linkCubes(f, 1.5, 0.2, 0.2)).toEqual(linkCubes(f, 1.5, 0.2));
      expect(linkOutline(f, 1.5, 0.2, 0.2)).toEqual(linkOutline(f, 1.5, 0.2));
    }
    const o = linkOutline(level, 1.5, 0.2);
    expect([o.half.x, o.half.y, o.half.z]).toEqual([0.75, 0.1, 0.1]);
  });

  it('the exact box of a plate is length x thickness x width, the width lying sideways', () => {
    const o = linkOutline(level, 0.6, 0.05, 0.8);
    expect([o.half.x, o.half.y, o.half.z]).toEqual([0.3, 0.025, 0.4]);
    expect(o.centre).toEqual({ x: 1.3, y: 2, z: 3 });
    // Sideways is the horizontal direction across the link: z for a link along x.
    expect(Math.abs(o.axes[2].z)).toBeCloseTo(1, 9);
  });

  it('the upright cover boxes hold the whole plate at any turn, and no corner of them is more than 15 cm off the plate (a cell is 20 cm)', () => {
    for (const f of [level, { ...level, yaw: Math.PI / 4 }, { ...level, pitch: 0.6 }, { ...level, yaw: 1.1, pitch: -0.5 }, { ...level, yaw: Math.PI / 2 }]) {
      const plate = linkOutline(f, 0.6, 0.05, 0.6);
      const cover = linkCubes(f, 0.6, 0.05, 0.6).map((c): Obb => obbOf(c.pos, c.size));
      const inside = (p: { x: number; y: number; z: number }): boolean =>
        cover.some((c) => Math.abs(p.x - c.centre.x) <= c.half.x + 1e-9 && Math.abs(p.y - c.centre.y) <= c.half.y + 1e-9 && Math.abs(p.z - c.centre.z) <= c.half.z + 1e-9);
      // A grid of points through the plate, corners included.
      for (let i = 0; i <= 12; i++) {
        for (let j = 0; j <= 12; j++) {
          for (const k of [-1, 1]) {
            const a = (i / 12) * 2 - 1;
            const b = (j / 12) * 2 - 1;
            const p = {
              x: plate.centre.x + plate.axes[0].x * a * plate.half.x + plate.axes[1].x * k * plate.half.y + plate.axes[2].x * b * plate.half.z,
              y: plate.centre.y + plate.axes[0].y * a * plate.half.x + plate.axes[1].y * k * plate.half.y + plate.axes[2].y * b * plate.half.z,
              z: plate.centre.z + plate.axes[0].z * a * plate.half.x + plate.axes[1].z * k * plate.half.y + plate.axes[2].z * b * plate.half.z,
            };
            expect(inside(p)).toBe(true);
          }
        }
      }
      // No cover corner is far from the plate.
      for (const c of cover) for (const corner of obbCorners(c)) expect(obbSeparation(plate, obbOf(corner, { x: 1e-6, y: 1e-6, z: 1e-6 }))).toBeLessThan(0.15);
    }
    // Standing square to the axes the cover is the plate itself.
    const flat = linkCubes(level, 0.6, 0.05, 0.6);
    expect(max(flat.map((c) => c.pos.y + c.size.y / 2))).toBeCloseTo(2.025, 9);
    expect(min(flat.map((c) => c.pos.z - c.size.z / 2))).toBeCloseTo(2.7, 9);
    expect(max(flat.map((c) => c.pos.x + c.size.x / 2))).toBeCloseTo(1.6, 9);
  });
});

describe('the link card', () => {
  it('"Bề rộng" sets how wide the drawn block is; left at 0, or absent on an older board, the link is as wide as it is thick', () => {
    expect(build({ crateKg: 1 }).entity('tray')!.size).toEqual({ x: 0.6, y: 0.05, z: 0.6 });
    expect(build({ crateKg: 1, tray: { width: 0 } }).entity('tray')!.size).toEqual({ x: 0.6, y: 0.05, z: 0.05 });
    expect(build({ crateKg: 1, noWidthParam: true }).entity('tray')!.size).toEqual({ x: 0.6, y: 0.05, z: 0.05 });
  });
});

describe('a 0.6 x 0.6 m tray on a chassis joint, "Vật lý thật" on', () => {
  for (const kg of [1, 5]) {
    it(`${kg} kg crate rests on it for 3 s: under 1 mm of drift, never inside the plate`, () => {
      const r = build({ crateKg: kg });
      const settle = watch(r, 1);
      const at = settle[settle.length - 1]!;
      const rows = watch(r, 3, 1);
      expect(rows.every((s) => s.on)).toBe(true);
      expect(max(rows.map((s) => Math.hypot(s.along - at.along, s.lateral - at.lateral)))).toBeLessThan(MM);
      expect(max(rows.map((s) => s.overlap))).toBeLessThan(MM);
      expect(max(rows.map((s) => s.tilt))).toBeLessThan(0.5);
      r.world.dispose?.();
    });

    it(`${kg} kg crate stays on it while the chassis drives off and brakes: it slides no more than a crate does on a stopping chassis`, () => {
      const r = build({ crateKg: kg });
      watch(r, 1);
      r.set('p', { value: 0.7 });
      const go = watch(r, 3, 1);
      const before = go[go.length - 1]!;
      r.set('p', { value: 0 });
      const stop = watch(r, 2, 4);
      expect([...go, ...stop].every((s) => s.on)).toBe(true);
      expect(r.entity('body')!.position.x).toBeGreaterThan(2);
      // 27.0 mm was measured for one stop from 0.99 m/s with the default motor ramp (it does not depend on the mass).
      expect(Math.abs(stop[stop.length - 1]!.along - before.along)).toBeLessThan(0.03);
      expect(max([...go, ...stop].map((s) => s.overlap))).toBeLessThan(MM);
      r.world.dispose?.();
    });

    for (const angle of [30, 45]) {
      it(`${kg} kg crate slides off when the joint tips the tray to ${angle} degrees at 60 degrees/s, without going through the plate or the chassis`, () => {
        const r = build({ crateKg: kg });
        watch(r, 1);
        r.set('ang', { value: angle });
        const rows = watch(r, 8, 1);
        // The joint got there (it had the torque), and the crate left the tray and lies on the floor behind the chassis.
        expect(Number(r.out('tilt', 'angleNow'))).toBeCloseTo(angle, 3);
        expect(rows[0]!.on).toBe(true);
        const last = rows[rows.length - 1]!;
        expect(last.on).toBe(false);
        expect(last.y).toBeLessThan(0.3);
        expect(r.entity('crate')!.position.x).toBeLessThan(PIVOT_X - CRATE / 2);
        // It left over the back edge, on the upper side of the plate all the way: never inside it by more than the engine's contact margin.
        expect(max(rows.map((s) => s.overlap))).toBeLessThan(5 * MM);
        expect(max(rows.map((s) => s.inChassis))).toBeLessThan(5 * MM);
        expect(min(rows.map((s) => s.y))).toBeGreaterThan(CRATE / 2 - 5 * MM);
        // No launch: it never moves faster than a fall from the tray's height allows (about 3.3 m/s from 0.56 m).
        let fastest = 0;
        for (let k = 1; k < rows.length; k++) fastest = Math.max(fastest, Math.abs(rows[k]!.y - rows[k - 1]!.y) / TICK_DT);
        expect(fastest).toBeLessThan(4.5);
        r.world.dispose?.();
      });
    }
  }

  it('the width is what carries the crate: 20 cm off the centre line it rests on the plate, and falls off a bar of the same length and thickness', () => {
    const plate = build({ crateKg: 1, lateral: 0.2 });
    const onPlate = watch(plate, 3);
    expect(onPlate.every((s) => s.on)).toBe(true);
    // The same crate over a bar 5 cm wide hangs 17.5 cm past its centre of mass: it tips off it and ends leaning on the chassis top.
    const bar = build({ crateKg: 1, lateral: 0.2, tray: { width: 0 } });
    const onBar = watch(bar, 3);
    expect(onBar[onBar.length - 1]!.tilt).toBeGreaterThan(5);
    expect(bar.entity('crate')!.position.y).toBeLessThan(TRAY_TOP + CRATE / 2 - 0.02);
    plate.world.dispose?.();
    bar.world.dispose?.();
  });

  it('a joint without the torque cannot tip the loaded tray: "Quá tải" lights and the crate stays where it is', () => {
    const weak = build({ crateKg: 5, maxTorque: 5 });
    watch(weak, 1);
    weak.set('ang', { value: 45 });
    const rows = watch(weak, 4, 1);
    expect(weak.out('tilt', 'overloaded')).toBe(true);
    expect(rows[rows.length - 1]!.on).toBe(true);
    weak.world.dispose?.();
  });
});

describe('with "Vật lý thật" off', () => {
  it('a loose item rests on a level plate (its cover is solid), and a link without a width is unchanged', () => {
    const r = build({ crateKg: 1, real: false });
    r.tick(Math.round(3 / TICK_DT));
    expect(r.entity('crate')!.position.y).toBeCloseTo(TRAY_TOP + CRATE / 2, 2);
    expect(Math.abs(r.entity('crate')!.position.x - (PIVOT_X + TRAY.length / 2))).toBeLessThan(0.01);
  });
});
