import { TICK_DT, type EntityView, type ParamValue } from '../../src/engine/types';
import type { RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { FLOOR } from '../helpers/nav-rig';

/**
 * Boards with a raised deck made of plain "Vật thể" blocks (with or without holes) and bare robot chassis on two motors,
 * for the tests of what holds a chassis up and of two levels that must not disturb each other. "Vật lý thật" is on.
 */

export const CHASSIS = { length: 0.9, width: 0.7, height: 0.24 };

export interface Bot {
  id: string;
  x: number;
  z: number;
  /** Height of the surface the robot starts on (top of the floor or of the deck). */
  floor: number;
  /** Degrees. */
  heading?: number;
  /** Marker number "Đi tới điểm" drives to; absent = the motors take `power` instead. */
  goal?: number;
  /** Power (-1..1) wired straight to the left and right motor when there is no goal. */
  power?: [left: number, right: number];
  drive?: Record<string, number | string>;
  chassis?: { length: number; width: number; height: number };
  /** Extra settings of the chassis card. */
  body?: Record<string, ParamValue>;
}

/** A bare chassis with two motors; `id` is the chassis, `${id}-ml` / `-mr` the motors, `${id}-go` the controller when it has a goal. */
export function bot(b: Bot): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const id = b.id;
  const c = b.chassis ?? CHASSIS;
  const nodes: NodeSpec[] = [
    [id, 'robot-body', { position: { x: b.x, y: b.floor + c.height / 2, z: b.z }, heading: b.heading ?? 0, ...c, mass: 5, friction: 0.8, showPayload: 'yes', showPush: 'yes', ...(b.body ?? {}) }],
    [`${id}-ml`, 'motor', { side: -(c.width / 2 - 0.05), accel: 400 }],
    [`${id}-mr`, 'motor', { side: c.width / 2 - 0.05, accel: 400 }],
  ];
  const wires: WireSpec[] = [
    [id, 'self', `${id}-ml`, 'body'],
    [id, 'self', `${id}-mr`, 'body'],
  ];
  if (b.goal !== undefined) {
    nodes.push([`${id}-go`, 'robot-goto', b.drive ?? {}], [`${id}-on`, 'on-start', {}]);
    wires.push(
      [id, 'self', `${id}-go`, 'robot'],
      [`${id}-go`, 'left', `${id}-ml`, 'power'],
      [`${id}-go`, 'right', `${id}-mr`, 'power'],
      [`${id}-on`, 'started', `${id}-go`, 'go'],
      [`m${b.goal}`, 'self', `${id}-go`, 'target'],
    );
  } else if (b.power) {
    nodes.push([`${id}-pl`, 'const', { value: b.power[0] }], [`${id}-pr`, 'const', { value: b.power[1] }]);
    wires.push([`${id}-pl`, 'value', `${id}-ml`, 'power'], [`${id}-pr`, 'value', `${id}-mr`, 'power']);
  }
  return { nodes, wires };
}

export function marker(number: number, x: number, z: number, y = 0, size = 1): NodeSpec {
  return [`m${number}`, 'floor-marker', { number, position: { x, y, z }, size }];
}

/** One solid slab; `top` is the height of its upper face. */
export function slab(id: string, top: number, x0: number, x1: number, z0: number, z1: number, thick = 0.2): NodeSpec {
  return [id, 'block', { position: { x: (x0 + x1) / 2, y: top - thick / 2, z: (z0 + z1) / 2 }, size: { x: x1 - x0, y: thick, z: z1 - z0 } }];
}

/**
 * A deck from -half..half on x and z with square holes of side `hole` centred on every (xs[i], zs[j]): full strips between the
 * hole rows, and short pieces between the holes of a row.
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

/** The board in the 3D view with real physics on, over the usual ground floor (top at y = 0) unless `withGround` is false. */
export function deckRig(nodes: NodeSpec[], wires: WireSpec[], rapier: RapierModule, withGround = true) {
  return rig(withGround ? [FLOOR, ...nodes] : nodes, wires, '3d', false, true, rapier);
}

export const seconds = (s: number): number => Math.round(s / TICK_DT);

export function join(...parts: { nodes: NodeSpec[]; wires: WireSpec[] }[]): { nodes: NodeSpec[]; wires: WireSpec[] } {
  return { nodes: parts.flatMap((p) => p.nodes), wires: parts.flatMap((p) => p.wires) };
}

/** Height of the underside of a chassis, from its view. */
export const bottomOf = (v: EntityView): number => v.position.y - v.size.y / 2;
