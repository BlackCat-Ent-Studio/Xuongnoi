import { TICK_DT, type EntityView, type ParamValue } from '../../src/engine/types';
import type { RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from './arm-rig';

/**
 * Boards for the robot navigation tests: a chassis with two motors that only "Đi tới điểm" drives, numbered floor
 * markers, and measurements taken from the entity views alone (positions, the chassis heading), never from the controller.
 */

export const DEG = 180 / Math.PI;
export const FLOOR: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 120, y: 1, z: 120 } }];
/** Height of the chassis middle above the floor top (y = 0). */
export const CHASSIS_Y = 0.15;

export interface NavBot {
  id: string;
  x: number;
  z: number;
  /** Degrees. */
  heading?: number;
  length?: number;
  width?: number;
  kg?: number;
  /** Settings of the "Đi tới điểm" card. */
  drive?: Record<string, ParamValue>;
  /** Settings of both motors. */
  motor?: Record<string, ParamValue>;
  /** Leave the two wires from the controller to the motors out. */
  cutMotorWires?: boolean;
}

/** Chassis, two motors and the controller; `id` is the chassis, `${id}-go` the controller, `${id}-ml` / `-mr` the motors. */
export function navBot(b: NavBot): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const id = b.id;
  const width = b.width ?? 0.7;
  const half = width / 2 - 0.05;
  return {
    nodes: [
      [id, 'robot-body', { position: { x: b.x, y: CHASSIS_Y, z: b.z }, heading: b.heading ?? 0, length: b.length ?? 0.9, width, height: 0.3, mass: b.kg ?? 5, friction: 0.8 }],
      [`${id}-ml`, 'motor', { side: -half, ...(b.motor ?? {}) }],
      [`${id}-mr`, 'motor', { side: half, ...(b.motor ?? {}) }],
      [`${id}-go`, 'robot-goto', b.drive ?? {}],
    ],
    wires: [
      [id, 'self', `${id}-ml`, 'body'],
      [id, 'self', `${id}-mr`, 'body'],
      [id, 'self', `${id}-go`, 'robot'],
      ...(b.cutMotorWires ? [] : ([[`${id}-go`, 'left', `${id}-ml`, 'power'], [`${id}-go`, 'right', `${id}-mr`, 'power']] as WireSpec[])),
    ],
  };
}

export function marker(number: number, x: number, z: number, size = 1): NodeSpec {
  return [`m${number}`, 'floor-marker', { number, position: { x, y: 0, z }, size }];
}

export function navRig(nodes: NodeSpec[], wires: WireSpec[], rapier: RapierModule | undefined, real = true) {
  return rig([FLOOR, ...nodes], wires, '3d', false, real, real ? rapier : undefined);
}

export type NavRig = ReturnType<typeof navRig>;

export interface Pose {
  x: number;
  z: number;
  /** Degrees. */
  heading: number;
}

export function poseOf(view: EntityView): Pose {
  return { x: view.position.x, z: view.position.z, heading: (view.robot?.heading ?? 0) * DEG };
}

/** Smallest turn between two headings, degrees (always positive). */
export function turnBetween(a: number, b: number): number {
  const d = (((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/** Ground speed (m/s) and turn speed (degrees/s) between two poses one tick apart. */
export function motion(before: Pose, after: Pose): { speed: number; turn: number } {
  return { speed: Math.hypot(after.x - before.x, after.z - before.z) / TICK_DT, turn: turnBetween(after.heading, before.heading) / TICK_DT };
}

const fnv = (h: number, text: string): number => {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
};

/** Hash of every entity's place and turn, to compare two runs tick for tick. */
export function stateHash(h: number, views: readonly EntityView[]): number {
  for (const v of views) h = fnv(h, `${v.id}|${v.position.x}|${v.position.y}|${v.position.z}|${v.robot?.heading ?? ''}|${v.rotation ? `${v.rotation.x},${v.rotation.y},${v.rotation.z},${v.rotation.w}` : ''}`);
  return h;
}
