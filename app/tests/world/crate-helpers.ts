import { TICK_DT, type EntityId, type EntitySpec, type EntityView, type ViewMode, type World } from '../../src/engine/types';
import { loadRapier } from '../../src/world/rapier-loader';
import type { WorldOptions } from '../../src/world/world-options';
import { createWorld } from '../../src/world/world';

/** A "Vật lý thật" world with the crate engine loaded. Gravity is the engine default (9.81) unless given. */
export async function crateWorld(mode: ViewMode = '3d', extra: Partial<WorldOptions> = {}): Promise<World> {
  const rapier = await loadRapier();
  return createWorld(mode, { realPhysics: true, rapier, ...extra });
}

/** Big flat floor, top face at y = 0. */
export function floor(w: World, mode: ViewMode = '3d'): EntityId {
  return w.spawn({
    kind: 'block',
    ownerNodeId: 'floor',
    position: { x: 0, y: -0.5, z: 0 },
    size: { x: 200, y: 1, z: mode === '2d-side' ? 1 : 200 },
    color: '#888',
    solid: true,
  });
}

export function block(w: World, x: number, y: number, z: number, sx: number, sy: number, sz: number, over: Partial<EntitySpec> = {}): EntityId {
  return w.spawn({ kind: 'block', ownerNodeId: 'blk', position: { x, y, z }, size: { x: sx, y: sy, z: sz }, color: '#aaa', solid: true, ...over });
}

/** A crate whose centre starts at (x, y, z). */
export function crate(w: World, x: number, y: number, z: number, size: { x: number; y: number; z: number } = { x: 0.4, y: 0.4, z: 0.4 }, over: Partial<EntitySpec> = {}): EntityId {
  return w.spawn({ kind: 'item', ownerNodeId: 'crate', position: { x, y, z }, size, color: '#c80', solid: false, shape: 'crate', ...over });
}

export const view = (w: World, id: EntityId): EntityView => {
  const v = w.entities().find((e) => e.id === id);
  if (!v) throw new Error(`no entity ${id}`);
  return v;
};

export function run(w: World, seconds: number): void {
  const n = Math.round(seconds / TICK_DT);
  for (let i = 0; i < n; i++) w.step(TICK_DT);
}

/** Tilt in degrees of an entity view's rotation away from upright (0 = upright or lying on a side face... see `tipDegrees`). */
export function tipDegrees(v: EntityView): number {
  const q = v.rotation ?? { x: 0, y: 0, z: 0, w: 1 };
  // Angle between the body's own up axis and world up: up' = q * (0,1,0); cos = up'.y.
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
  return (Math.acos(Math.max(-1, Math.min(1, upY))) * 180) / Math.PI;
}
