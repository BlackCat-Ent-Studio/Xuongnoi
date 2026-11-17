import type { EntityId, Vec3, ViewMode } from '../engine/types';
import { boxOverlap } from './collider';
import type { Entity } from './entity';
import { movable, standsOn } from './platforms';

/**
 * Conveyor belts and vehicles that carry what rides on top.
 *
 * - A belt is a block with a signed surface speed along one horizontal axis. Whatever rests on its top (or, in the top-down
 *   view, lies on its footprint; there the belt is a floor strip and need not be solid) is moved by that speed on top of its
 *   own movement.
 * - Side walls of a belt (3D view only) are ordinary thin solid blocks that follow it, so they block like any wall.
 * - A solid vehicle or robot chassis carries the characters and items resting on it with its translation and turn.
 * Every displacement goes through the caller's collision-aware move, so nobody is pushed into a solid.
 */

type Axis = 'x' | 'y' | 'z';

export interface BeltState {
  /** Horizontal axis the surface travels along (before any quarter turn of the block). */
  axis: 'x' | 'z';
  /** Signed surface speed in units/s along the axis. */
  speed: number;
  /** Signed distance the surface has travelled; the renderer scrolls the stripes with it. */
  phase: number;
  /** Side walls (entity ids); empty when the belt has none. */
  walls: EntityId[];
}

/** Moves a body along one axis by a delta against the given solids. */
export type MoveFn = (e: Entity, axis: Axis, delta: number, solids: readonly Entity[]) => void;

export const WALL_THICK = 0.1;
export const WALL_HEIGHT = 0.3;
const OVERLAP_MIN = 1e-6;

/** The travel axis now: a quarter-turned belt (width and depth swapped) travels along the other axis. */
export function beltAxis(e: Entity): 'x' | 'z' {
  if (!e.belt) return 'x';
  const swapped = e.turn !== undefined && e.turn.quarter % 2 === 1 && e.turn.plane === 'xz';
  return swapped ? (e.belt.axis === 'x' ? 'z' : 'x') : e.belt.axis;
}

export function beltVelocity(e: Entity): { x: number; z: number } {
  const speed = e.belt?.speed ?? 0;
  return beltAxis(e) === 'x' ? { x: speed, z: 0 } : { x: 0, z: speed };
}

/** Advances the scroll of every visible belt. */
export function advanceBelts(list: readonly Entity[], dt: number): void {
  for (const e of list) if (e.belt && e.visible) e.belt.phase += e.belt.speed * dt;
}

/** Puts the side walls of a belt where they belong. Returns true when a solid wall appeared, vanished or moved. */
export function syncBeltWalls(belt: Entity, byId: ReadonlyMap<EntityId, Entity>): boolean {
  if (!belt.belt) return false;
  const a = beltAxis(belt);
  const o = a === 'x' ? 'z' : 'x';
  const thick = Math.min(WALL_THICK, belt.size[o] / 4);
  const height = WALL_HEIGHT;
  let changed = false;
  belt.belt.walls.forEach((id, i) => {
    const w = byId.get(id);
    if (!w) return;
    const side = i === 0 ? 1 : -1;
    const pos: Vec3 = { ...belt.pos };
    pos[o] = belt.pos[o] + side * (belt.size[o] / 2 - thick / 2);
    pos.y = belt.pos.y + belt.size.y / 2 + height / 2;
    const size: Vec3 = { x: 0, y: height, z: 0 };
    size[a] = belt.size[a];
    size[o] = thick;
    if (
      w.visible !== belt.visible ||
      w.color !== belt.color ||
      w.pos.x !== pos.x || w.pos.y !== pos.y || w.pos.z !== pos.z ||
      w.size.x !== size.x || w.size.y !== size.y || w.size.z !== size.z
    ) {
      if (w.solid) changed = true;
      w.visible = belt.visible;
      w.color = belt.color;
      w.pos = pos;
      w.size = size;
    }
  });
  return changed;
}

/** True when `e` rests on the surface of `belt` (top-down view: lies within its footprint). */
function onBelt(e: Entity, belt: Entity, mode: ViewMode): boolean {
  if (mode === '2d-top') return boxOverlap(e, belt, 'x') > OVERLAP_MIN && boxOverlap(e, belt, 'z') > OVERLAP_MIN;
  return standsOn(e, belt, mode);
}

/** Moves everything resting on a running belt by the surface velocity. Each body is carried by one belt only. */
export function carryOnBelts(
  list: readonly Entity[],
  dt: number,
  mode: ViewMode,
  move: MoveFn,
  solidsFor: (e: Entity) => readonly Entity[],
): void {
  const belts = list.filter((e) => e.belt && e.belt.speed !== 0 && e.visible && (e.solid || mode === '2d-top') && e.kind === 'block');
  if (belts.length === 0) return;
  const bodies = list.filter(movable);
  const moved = new Set<Entity>();
  for (const belt of belts) {
    const v = beltVelocity(belt);
    const riders = bodies.filter((b) => !moved.has(b) && onBelt(b, belt, mode));
    for (const r of riders) {
      moved.add(r);
      const solids = solidsFor(r);
      move(r, 'x', v.x * dt, solids);
      if (mode !== '2d-side') move(r, 'z', v.z * dt, solids);
    }
  }
}

export interface VehicleRide {
  vehicle: Entity;
  riders: Entity[];
  from: Vec3;
  facing: Vec3;
}

/** Before vehicles and robot chassis move: who rides on which solid one. Empty in the top-down view (nobody stands on top there). */
export function vehicleRides(list: readonly Entity[], mode: ViewMode): VehicleRide[] {
  if (mode === '2d-top') return [];
  const out: VehicleRide[] = [];
  let bodies: Entity[] | null = null;
  for (const v of list) {
    if ((v.kind !== 'vehicle' && v.kind !== 'robot') || !v.visible || !v.solid) continue;
    bodies ??= list.filter((e) => (e.kind === 'character' || e.kind === 'item') && movable(e));
    const riders = bodies.filter((b) => standsOn(b, v, mode));
    if (riders.length > 0) out.push({ vehicle: v, riders, from: { ...v.pos }, facing: { ...v.facing } });
  }
  return out;
}

/** After vehicles moved: carry the riders along by the vehicle's translation and turn about the vertical axis. */
export function carryVehicleRiders(rides: readonly VehicleRide[], mode: ViewMode, move: MoveFn, solidsFor: (e: Entity) => readonly Entity[]): void {
  for (const { vehicle: v, riders, from, facing } of rides) {
    let cos = 1;
    let sin = 0;
    if (mode !== '2d-side') {
      const la = Math.hypot(facing.x, facing.z);
      const lb = Math.hypot(v.facing.x, v.facing.z);
      if (la > 1e-6 && lb > 1e-6) {
        cos = (facing.x * v.facing.x + facing.z * v.facing.z) / (la * lb);
        sin = (facing.x * v.facing.z - facing.z * v.facing.x) / (la * lb);
      }
    }
    for (const r of riders) {
      const rx = r.pos.x - from.x;
      const rz = r.pos.z - from.z;
      const dx = v.pos.x + rx * cos - rz * sin - r.pos.x;
      const dz = v.pos.z + rx * sin + rz * cos - r.pos.z;
      const solids = solidsFor(r);
      move(r, 'x', dx, solids);
      if (mode !== '2d-side') move(r, 'z', dz, solids);
      if (r.kind === 'character' && (sin !== 0 || cos !== 1)) {
        const fx = r.facing.x;
        const fz = r.facing.z;
        r.facing = { x: fx * cos - fz * sin, y: r.facing.y, z: fx * sin + fz * cos };
      }
    }
  }
}
