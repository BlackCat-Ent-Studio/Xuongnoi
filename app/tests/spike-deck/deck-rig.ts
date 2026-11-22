import { TICK_DT, type EntityView } from '../../src/engine/types';
import type { RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { FLOOR } from '../helpers/nav-rig';

/**
 * SPIKE ONLY (never merged). Boards for measuring a raised deck with holes, made of existing pieces only:
 * "Vật thể" blocks for the deck, "Thân robot" + two "Động cơ" + "Đi tới điểm" + the side-dump tray recipe for a robot.
 */

export const CHASSIS = { length: 0.9, width: 0.7, height: 0.24 };
export const TRAY = { length: 0.62, thickness: 0.05, width: 0.74 };
export const CARTON = { x: 0.3, y: 0.22, z: 0.26 };
const GAP = 0.05;
const HINGE = 0.31;

export interface Bot {
  id: string;
  x: number;
  z: number;
  /** Height of the surface the robot starts on (top of the floor or deck). */
  floor: number;
  heading?: number;
  side?: 1 | -1;
  /** Marker number the controller drives to; absent = it stays where it is. */
  goal?: number;
  face?: number;
  crateKg?: number;
  tilt?: number;
  /** No tray, no crate: a bare chassis. */
  bare?: boolean;
  drive?: Record<string, number | string>;
  /** Tip at once (wired to "Khi bắt đầu") instead of on arrival. */
  tipNow?: boolean;
  chassis?: { length: number; width: number; height: number };
}

export function bot(b: Bot): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const id = b.id;
  const c = b.chassis ?? CHASSIS;
  const side = b.side ?? 1;
  const heading = b.heading ?? 0;
  const rad = (heading * Math.PI) / 180;
  const y0 = b.floor + c.height / 2;
  const up = c.height / 2 + GAP + TRAY.thickness / 2;
  const top = y0 + up + TRAY.thickness / 2;
  const across = side * (HINGE - TRAY.length / 2);
  const facing = b.face !== undefined;
  const nodes: NodeSpec[] = [
    [id, 'robot-body', { position: { x: b.x, y: y0, z: b.z }, heading, ...c, mass: 5, friction: 0.8, showPayload: 'yes', showPush: 'yes' }],
    [`${id}-ml`, 'motor', { side: -(c.width / 2 - 0.05), accel: 400 }],
    [`${id}-mr`, 'motor', { side: c.width / 2 - 0.05, accel: 400 }],
    [`${id}-go`, 'robot-goto', { ...(b.drive ?? {}), ...(facing ? { faceOnArrive: 'yes' } : {}) }],
    [`${id}-face`, 'const', { value: b.face ?? 0 }],
    [`${id}-on`, 'on-start', {}],
  ];
  const wires: WireSpec[] = [
    [id, 'self', `${id}-ml`, 'body'], [id, 'self', `${id}-mr`, 'body'], [id, 'self', `${id}-go`, 'robot'],
    [`${id}-go`, 'left', `${id}-ml`, 'power'], [`${id}-go`, 'right', `${id}-mr`, 'power'],
    [`${id}-on`, 'started', `${id}-go`, 'go'],
    ...(b.goal !== undefined ? ([[`m${b.goal}`, 'self', `${id}-go`, 'target']] as WireSpec[]) : []),
    ...(facing ? ([[`${id}-face`, 'value', `${id}-go`, 'face']] as WireSpec[]) : []),
  ];
  if (!b.bare) {
    nodes.push(
      [`${id}-turn`, 'joint', { axis: 'yaw', start: side * 90, min: -180, max: 180, mount: { x: 0, y: up, z: side * HINGE }, solid: 'no' }],
      [`${id}-tilt`, 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, maxSpeed: 60, solid: 'no' }],
      [`${id}-tray`, 'link', { length: TRAY.length, thickness: TRAY.thickness, width: TRAY.width, solid: 'yes', mass: 1 }],
      [`${id}-angle`, 'bool-to-number', { whenOn: b.tilt ?? 35, whenOff: 0 }],
      [`${id}-crate`, 'item', { shape: 'crate', position: { x: b.x - Math.sin(rad) * across, y: top + CARTON.y / 2 + 0.005, z: b.z + Math.cos(rad) * across }, size: CARTON, mass: b.crateKg ?? 2 }],
    );
    wires.push(
      [id, 'self', `${id}-turn`, 'base'], [`${id}-on`, 'started', `${id}-turn`, 'power'],
      [`${id}-turn`, 'tip', `${id}-tilt`, 'base'], [`${id}-on`, 'started', `${id}-tilt`, 'power'],
      [`${id}-tilt`, 'tip', `${id}-tray`, 'base'],
      b.tipNow ? [`${id}-on`, 'started', `${id}-angle`, 'on'] : [`${id}-go`, 'arrived', `${id}-angle`, 'on'],
      [`${id}-angle`, 'value', `${id}-tilt`, 'angle'],
    );
  }
  return { nodes, wires };
}

export function marker(number: number, x: number, z: number, y = 0, size = 1): NodeSpec {
  return [`m${number}`, 'floor-marker', { number, position: { x, y, z }, size }];
}

/** One solid slab: a deck without holes. `top` is the height of its upper face. */
export function slab(id: string, top: number, x0: number, x1: number, z0: number, z1: number, thick = 0.2, color = '#a3a3a3'): NodeSpec {
  return [id, 'block', { position: { x: (x0 + x1) / 2, y: top - thick / 2, z: (z0 + z1) / 2 }, size: { x: x1 - x0, y: thick, z: z1 - z0 }, color }];
}

/**
 * A deck from -half..half on x and z with square holes of side `hole` centred on every (xs[i], zs[j]), made of the fewest plain
 * blocks: full strips between the hole rows, and short pieces between the holes of a row.
 */
export function holeDeck(top: number, half: number, xs: readonly number[], zs: readonly number[], hole: number, thick = 0.2, prefix = 'deck'): NodeSpec[] {
  const out: NodeSpec[] = [];
  const cuts = (cs: readonly number[]): [number, number][] => {
    const spans: [number, number][] = [];
    let from = -half;
    for (const c of [...cs].sort((a, b) => a - b)) {
      spans.push([from, c - hole / 2]);
      from = c + hole / 2;
    }
    spans.push([from, half]);
    return spans.filter(([a, b]) => b - a > 1e-9);
  };
  let n = 0;
  for (const [z0, z1] of cuts(zs)) out.push(slab(`${prefix}${n++}`, top, -half, half, z0, z1, thick));
  for (const zc of zs) for (const [x0, x1] of cuts(xs)) out.push(slab(`${prefix}${n++}`, top, x0, x1, zc - hole / 2, zc + hole / 2, thick));
  return out;
}

export function deckRig(nodes: NodeSpec[], wires: WireSpec[], rapier: RapierModule, withGround = true) {
  return rig(withGround ? [FLOOR, ...nodes] : nodes, wires, '3d', false, true, rapier);
}

export const seconds = (s: number): number => Math.round(s / TICK_DT);

export function join(...parts: { nodes: NodeSpec[]; wires: WireSpec[] }[]): { nodes: NodeSpec[]; wires: WireSpec[] } {
  return { nodes: parts.flatMap((p) => p.nodes), wires: parts.flatMap((p) => p.wires) };
}

export const f = (n: number, d = 3): string => n.toFixed(d);

/** Lowest point of a (possibly turned) crate above y = 0, from its view. */
export function crateBottom(v: EntityView): number {
  const q = v.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  // Second row of the rotation matrix: how much each local axis points up.
  const ux = 2 * (q.x * q.y + q.w * q.z);
  const uy = 1 - 2 * (q.x * q.x + q.z * q.z);
  const uz = 2 * (q.y * q.z - q.w * q.x);
  return v.position.y - (Math.abs(ux) * v.size.x + Math.abs(uy) * v.size.y + Math.abs(uz) * v.size.z) / 2;
}
