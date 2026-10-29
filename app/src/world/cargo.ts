import type { Vec3, ViewMode } from '../engine/types';
import type { Entity } from './entity';
import { overlapsSolid } from './physics';

/**
 * Crates per layer on a vehicle bed; more stack on top. Layout rule: 1 = a single spot in the middle,
 * 2 = one row of 2 columns, 4 = 2 rows x 2 columns (default), 6 = 3 rows x 2 columns.
 */
export const DEFAULT_CELLS_PER_LAYER = 4;
const ALLOWED_CELLS = [1, 2, 4, 6];
/** Rows sit this share of the footprint along the nose direction (rear row first), per row count. */
const ROW_OFFSETS: Readonly<Record<number, readonly number[]>> = {
  1: [-0.1],
  2: [-0.3, 0.1],
  3: [-0.4, -0.1, 0.2],
};
/** Columns sit this share of the footprint to either side. */
const COLUMN_OFFSET = 0.22;
/** Gap left between a vehicle and an unloaded item. */
export const DEFAULT_UNLOAD_GAP = 0.1;

/** Snaps any number to an allowed layer size (1, 2, 4 or 6); anything else falls back to the default 4. */
export function normalizeCells(n: number): number {
  const r = Math.round(n);
  return ALLOWED_CELLS.includes(r) ? r : DEFAULT_CELLS_PER_LAYER;
}

/** Items loaded on a vehicle, oldest first; only goods of type `tag` when it is non-empty. */
export function cargoOn(list: readonly Entity[], vehicleId: string, tag = ''): Entity[] {
  return list
    .filter((e) => e.kind === 'item' && e.visible && e.heldBy === vehicleId && e.cargoSeq !== undefined && (tag === '' || (e.tag ?? '') === tag))
    .sort((a, b) => a.cargoSeq! - b.cargoSeq!);
}

/** Where every loaded item rides, keyed by item id. Empty when nothing is loaded. */
export function cargoPositions(list: readonly Entity[], mode: ViewMode): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const byVehicle = new Map<string, Entity[]>();
  for (const e of list) {
    if (e.kind !== 'item' || !e.visible || e.heldBy === null || e.cargoSeq === undefined) continue;
    const group = byVehicle.get(e.heldBy);
    if (group) group.push(e);
    else byVehicle.set(e.heldBy, [e]);
  }
  for (const [vid, items] of byVehicle) {
    const veh = list.find((e) => e.id === vid);
    if (!veh) continue;
    items.sort((a, b) => a.cargoSeq! - b.cargoSeq!);
    const f = veh.facing;
    const side = { x: -f.z, z: f.x };
    const span = Math.max(veh.size.x, veh.size.z);
    const cells = normalizeCells(veh.vehicle?.cargoCells ?? DEFAULT_CELLS_PER_LAYER);
    const columns = cells === 1 ? 1 : 2;
    const rowOffsets = ROW_OFFSETS[cells / columns]!;
    const stackHeight = new Array<number>(cells).fill(0);
    items.forEach((item, i) => {
      const cell = i % cells;
      const fwd = rowOffsets[Math.floor(cell / columns)]! * span;
      const lat = columns === 1 ? 0 : (cell % 2 === 0 ? -1 : 1) * COLUMN_OFFSET * span;
      const base = veh.pos.y + veh.size.y / 2 + stackHeight[cell]!;
      stackHeight[cell]! += item.size.y;
      out.set(item.id, {
        x: veh.pos.x + f.x * fwd + side.x * lat,
        // Seen from above there is no height: the crate just sits on the vehicle's plane.
        y: mode === '2d-top' ? veh.pos.y : base + item.size.y / 2,
        z: mode === '2d-side' ? 0 : veh.pos.z + f.z * fwd + side.z * lat,
      });
    });
  }
  return out;
}

/** Nearest free carryable item (of goods type `tag` when non-empty) within `reach` of the vehicle's edge, else null. */
export function nearestLoadable(list: readonly Entity[], veh: Entity, reach: number, mode: ViewMode, tag = ''): Entity | null {
  const half = Math.max(veh.size.x, veh.size.z) / 2;
  let best: Entity | null = null;
  let bestDist = Infinity;
  for (const it of list) {
    if (it.kind !== 'item' || !it.visible || !it.carryable || it.heldBy !== null || it.bullet) continue;
    if (tag !== '' && (it.tag ?? '') !== tag) continue;
    const dx = it.pos.x - veh.pos.x;
    const dy = mode === '2d-top' ? 0 : it.pos.y - veh.pos.y;
    const dz = mode === '2d-side' ? 0 : it.pos.z - veh.pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist - half > reach || dist >= bestDist) continue;
    best = it;
    bestDist = dist;
  }
  return best;
}

/** A resting spot for an unloaded item beside the vehicle (behind first), clear of solid blocks and the vehicle. */
export function unloadSpot(list: readonly Entity[], veh: Entity, item: Entity, mode: ViewMode, gap = DEFAULT_UNLOAD_GAP): Vec3 | null {
  const solids = list.filter((e) => e.visible && e.solid && e.kind === 'block');
  const y = mode === '2d-top' ? veh.pos.y : veh.pos.y - veh.size.y / 2 + item.size.y / 2;
  const f = veh.facing;
  const dirs = [
    { x: -f.x, z: -f.z },
    { x: -f.z, z: f.x },
    { x: f.z, z: -f.x },
    { x: f.x, z: f.z },
  ];
  const base = Math.max(veh.size.x, veh.size.z) / 2 + Math.max(item.size.x, item.size.z) / 2 + (Number.isFinite(gap) ? Math.max(0, gap) : DEFAULT_UNLOAD_GAP);
  for (const extra of [0, 0.7]) {
    for (const d of dirs) {
      // Side view has no depth: the sideways spots would land on the vehicle itself.
      if (mode === '2d-side' && Math.abs(d.x) < 0.5) continue;
      const spot = { x: veh.pos.x + d.x * (base + extra), y, z: veh.pos.z + d.z * (base + extra) };
      if (mode === '2d-side') spot.z = 0;
      if (!overlapsSolid({ ...item, pos: spot }, solids)) return spot;
    }
  }
  return null;
}
