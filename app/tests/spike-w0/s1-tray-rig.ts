import { writeFileSync } from 'node:fs';
import { beforeAll } from 'vitest';
import { TICK_DT, type ParamValue } from '../../src/engine/types';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { OUT, crateOnTray, engineOnce, len, linkPose, sub } from './spike-lib';
import type { RapierModule } from '../../src/world/rapier-loader';

/**
 * Spike 1: a tilt tray made only from existing pieces (joint on a robot-body + link with "Chắn vật" = Có) carrying a rigid crate
 * under "Vật lý thật". Measures, per tick, where the crate sits on the tray, how deep it overlaps it and how fast it moves.
 * Nothing is asserted: numbers go to out/s1-results.md.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await engineOnce();
});

export type Variant = 'beam' | 'slab' | 'fork' | 'side-slab';

interface Build {
  variant: Variant;
  crateKg: number;
  /** Joint speed, degrees per second. */
  jointSpeed?: number;
  maxTorque?: number;
  motorN?: number;
  maxRpm?: number;
  crateSize?: number;
  /** Gap (m) between the chassis top and the tray's underside; 1 cm unless given. */
  clearance?: number;
  /** Motor ramp, rpm per second (the piece's default is 400). */
  accel?: number;
  /** No crate at all (to read what the chassis weighs with only its tray). */
  noCrate?: boolean;
  extraNodes?: NodeSpec[];
  extraWires?: WireSpec[];
}

export const CHASSIS = { length: 1.2, width: 1, height: 0.3, mass: 5 };
const TRAY_LEN = 1;
/** Pivot at the rear edge of the chassis collision square (side max(length, width) = 1.2). */
const PIVOT_BACK = -0.6;

function thicknessOf(v: Variant): number {
  return v === 'beam' ? 0.2 : v === 'fork' ? 0.1 : 0.6;
}

export function build(b: Build) {
  const t = thicknessOf(b.variant);
  const size = b.crateSize ?? 0.4;
  /** Joint height above the chassis centre: the tray's underside clears the chassis top by 1 cm. */
  const up = CHASSIS.height / 2 + (b.clearance ?? 0.01) + t / 2;
  const trayTop = CHASSIS.height / 2 + up + t / 2;
  const joint = (mount: { x: number; y: number; z: number }): Record<string, ParamValue> => ({
    axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: b.maxTorque ?? 50, maxSpeed: b.jointSpeed ?? 30, mount, solid: 'no',
  });
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 20 } }],
    ['body', 'robot-body', { position: { x: 0, y: CHASSIS.height / 2, z: 0 }, heading: 0, ...CHASSIS, friction: 0.8 }],
    ['ml', 'motor', { side: -0.45, maxRpm: b.maxRpm ?? 90, maxForce: b.motorN ?? 6, accel: b.accel ?? 400 }],
    ['mr', 'motor', { side: 0.45, maxRpm: b.maxRpm ?? 90, maxForce: b.motorN ?? 6, accel: b.accel ?? 400 }],
    ['pl', 'const', { value: 0 }],
    ['pr', 'const', { value: 0 }],
    ['go', 'on-start', {}],
    ['ang', 'const', { value: 0 }],
  ];
  const wires: WireSpec[] = [
    ['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'],
    ['pl', 'value', 'ml', 'power'], ['pr', 'value', 'mr', 'power'],
  ];
  /** Joints whose tip carries a tray link, and the crate's start place. */
  const trays: { joint: string; link: string }[] = [];
  let crateAt = { x: PIVOT_BACK + TRAY_LEN / 2, y: trayTop + size / 2 + 0.005, z: 0 };
  if (b.variant === 'fork') {
    for (const [k, z] of [['a', -0.12], ['b', 0.12]] as const) {
      nodes.push([`tilt-${k}`, 'joint', joint({ x: PIVOT_BACK, y: up, z })], [`tray-${k}`, 'link', { length: TRAY_LEN, thickness: t, solid: 'yes', mass: 0.5 }]);
      wires.push(['body', 'self', `tilt-${k}`, 'base'], ['go', 'started', `tilt-${k}`, 'power'], ['ang', 'value', `tilt-${k}`, 'angle'], [`tilt-${k}`, 'tip', `tray-${k}`, 'base']);
      trays.push({ joint: `tilt-${k}`, link: `tray-${k}` });
    }
  } else if (b.variant === 'side-slab') {
    // A yaw joint held at +90 degrees turns the frame so that the tray points to the chassis's left; the pivot sits at the right edge.
    nodes.push(
      ['turn', 'joint', { axis: 'yaw', start: 90, min: -180, max: 180, maxTorque: 50, maxSpeed: 90, mount: { x: 0, y: up, z: 0.5 }, solid: 'no' }],
      ['tilt', 'joint', joint({ x: 0, y: 0, z: 0 })],
      ['tray', 'link', { length: TRAY_LEN, thickness: t, solid: 'yes', mass: 1 }],
    );
    wires.push(['body', 'self', 'turn', 'base'], ['go', 'started', 'turn', 'power'], ['turn', 'tip', 'tilt', 'base'], ['go', 'started', 'tilt', 'power'], ['ang', 'value', 'tilt', 'angle'], ['tilt', 'tip', 'tray', 'base']);
    trays.push({ joint: 'tilt', link: 'tray' });
    crateAt = { x: 0, y: trayTop + size / 2 + 0.005, z: 0 };
  } else {
    nodes.push(['tilt', 'joint', joint({ x: PIVOT_BACK, y: up, z: 0 })], ['tray', 'link', { length: TRAY_LEN, thickness: t, solid: 'yes', mass: 1 }]);
    wires.push(['body', 'self', 'tilt', 'base'], ['go', 'started', 'tilt', 'power'], ['ang', 'value', 'tilt', 'angle'], ['tilt', 'tip', 'tray', 'base']);
    trays.push({ joint: 'tilt', link: 'tray' });
  }
  // A crate that is not wanted is parked far away on the floor, so the sampling code stays the same.
  if (b.noCrate) crateAt = { x: 20, y: size / 2 + 0.005, z: 5 };
  nodes.push(['crate', 'item', { shape: 'crate', position: crateAt, size: { x: size, y: size, z: size }, mass: b.crateKg }]);
  // A scale reading what lies on the tray link, to see whether "the tray is loaded" can be sensed with an existing piece.
  nodes.push(['scale', 'force-sensor', { mode: 'scale' }]);
  wires.push([trays[0]!.link, 'tip', 'scale', 'who']);
  nodes.push(...(b.extraNodes ?? []));
  wires.push(...(b.extraWires ?? []));
  const r = rig(nodes, wires, '3d', false, true, rapier);
  return { ...r, t, size, trays, trayTop };
}

export interface Sample {
  t: number;
  along: number;
  lateral: number;
  gap: number;
  overlap: number;
  tiltToTray: number;
  tiltToWorld: number;
  speed: number;
  relSpeed: number;
  cx: number;
  cy: number;
  cz: number;
  bx: number;
  bz: number;
  bodySpeed: number;
  angle: number;
  overloaded: boolean;
  load: number;
}

type Rig = ReturnType<typeof build>;

/** Runs `seconds`, calling `drive(t)` before each tick; returns one sample per tick (overlap = the deepest over every tray link). */
export function watch(r: Rig, seconds: number, t0: number, drive?: (t: number) => void): Sample[] {
  const out: Sample[] = [];
  const first = r.trays[0]!;
  let prevC = r.entity('crate')!.position;
  let prevB = r.entity('body')!.position;
  const n = Math.round(seconds / TICK_DT);
  for (let k = 0; k < n; k++) {
    const t = t0 + k * TICK_DT;
    drive?.(t);
    r.tick();
    const crate = r.entity('crate')!;
    const body = r.entity('body')!;
    let overlap = -Infinity;
    let m0: ReturnType<typeof crateOnTray> | null = null;
    for (const tr of r.trays) {
      const pose = linkPose(r.world, r.entity(tr.joint)!, TRAY_LEN, r.t);
      if (!pose) continue;
      const m = crateOnTray(pose, r.t, crate);
      overlap = Math.max(overlap, m.overlap);
      if (tr === first) m0 = m;
    }
    const vC = sub(crate.position, prevC);
    const vB = sub(body.position, prevB);
    out.push({
      t: t + TICK_DT,
      along: m0?.along ?? NaN,
      lateral: (m0?.lateral ?? NaN) - (r.trays.length > 1 ? 0.12 : 0),
      gap: m0?.gap ?? NaN,
      overlap,
      tiltToTray: m0?.tiltToTray ?? NaN,
      tiltToWorld: m0?.tiltToWorld ?? NaN,
      speed: len(vC) / TICK_DT,
      relSpeed: len(sub(vC, vB)) / TICK_DT,
      cx: crate.position.x,
      cy: crate.position.y,
      cz: crate.position.z,
      bx: body.position.x,
      bz: body.position.z,
      bodySpeed: len(vB) / TICK_DT,
      angle: Number(r.out(first.joint, 'angleNow')),
      overloaded: r.out(first.joint, 'overloaded') === true,
      load: Number(r.out(first.joint, 'load')),
    });
    prevC = crate.position;
    prevB = body.position;
  }
  return out;
}

export const max = (xs: number[]): number => xs.reduce((a, c) => Math.max(a, c), -Infinity);
export const min = (xs: number[]): number => xs.reduce((a, c) => Math.min(a, c), Infinity);
/** The crate is still carried: within the tray's length and lying on its top (gap under 2 cm, tilt to the tray under 10 degrees). */
export const onTray = (s: Sample, size: number): boolean => s.along > 0 && s.along < TRAY_LEN && Math.abs(s.gap) < 0.02 && s.tiltToTray < 10 && Math.abs(s.lateral) < size;

export function series(name: string, rows: Sample[]): void {
  const head = 't,along,lateral,gap,overlap,tiltToTray,tiltToWorld,speed,relSpeed,cx,cy,cz,bx,bz,bodySpeed,angle,overloaded,load';
  const body = rows.map((s) => [s.t, s.along, s.lateral, s.gap, s.overlap, s.tiltToTray, s.tiltToWorld, s.speed, s.relSpeed, s.cx, s.cy, s.cz, s.bx, s.bz, s.bodySpeed, s.angle, s.overloaded ? 1 : 0, s.load].map((v) => (typeof v === 'number' ? v.toFixed(5) : v)).join(','));
  writeFileSync(new URL(`s1-series-${name}.csv`, OUT), [head, ...body].join('\n'));
}

export const VARIANTS: Variant[] = ['beam', 'slab', 'fork', 'side-slab'];
export const MASSES = [1, 5];

