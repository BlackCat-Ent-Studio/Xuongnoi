import type { EntityId, WorldApi } from '../engine/types';

/** Bookkeeping for things a spawner node made: who is still around and how long each has left. */

export interface SpawnPool {
  alive: { id: EntityId; ttl: number }[];
}

export function createSpawnPool(): SpawnPool {
  return { alive: [] };
}

/** Ages every member, hides those whose time ran out, and forgets those that are gone. Returns how many remain. */
export function tickSpawnPool(pool: SpawnPool, dt: number, world: Pick<WorldApi, 'getEntity' | 'hide'>): number {
  const kept: SpawnPool['alive'] = [];
  for (const m of pool.alive) {
    if (!world.getEntity(m.id)?.visible) continue; // hidden by something else (or dropped): no longer alive
    m.ttl -= dt;
    if (m.ttl <= 0) {
      world.hide(m.id);
      continue;
    }
    kept.push(m);
  }
  pool.alive = kept;
  return kept.length;
}

/**
 * Takes back one member before its time: hides it (so whoever carries it lets go) and forgets it.
 * False, and nothing happens, when the pool did not make `id` or it is already gone.
 */
export function recallFromSpawnPool(pool: SpawnPool, id: EntityId, world: Pick<WorldApi, 'getEntity' | 'hide'>): boolean {
  const at = pool.alive.findIndex((m) => m.id === id);
  if (at < 0) return false;
  pool.alive.splice(at, 1);
  if (!world.getEntity(id)?.visible) return false;
  world.hide(id);
  return true;
}

/** `lifetime` <= 0 means the copy stays until something else removes it. */
export function addToSpawnPool(pool: SpawnPool, id: EntityId, lifetime: number): void {
  pool.alive.push({ id, ttl: lifetime > 0 ? lifetime : Infinity });
}
