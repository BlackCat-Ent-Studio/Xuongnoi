import type { WorldApi } from '../../engine/types';
import { buildPlaneGrid, type PlaneBody, type PlaneGrid } from './plane-nav';
import { buildSideGraph, type SideBody, type SideGraph } from './side-nav';

/**
 * Per-world cache of the navigation structures. Blocks are static except when one is hidden (a door
 * opening), which bumps `world.solidRevision()`; a changed revision drops everything built before.
 */

interface WorldNav {
  revision: number;
  plane: Map<string, PlaneGrid | null>;
  side: Map<string, SideGraph | null>;
}

const MAX_ENTRIES = 8;
const caches = new WeakMap<object, WorldNav>();

function navFor(world: WorldApi): WorldNav {
  const revision = world.solidRevision();
  let nav = caches.get(world);
  if (!nav || nav.revision !== revision) {
    nav = { revision, plane: new Map(), side: new Map() };
    caches.set(world, nav);
  }
  return nav;
}

function remember<T>(map: Map<string, T>, key: string, build: () => T): T {
  if (map.has(key)) return map.get(key) as T;
  if (map.size >= MAX_ENTRIES) map.clear();
  const value = build();
  map.set(key, value);
  return value;
}

/** Quantized so sizes and heights that differ by float noise share one entry. */
function q(n: number, step: number): number {
  return Math.round(n / step);
}

/** Ground-plane grid for a body standing with its feet at `feetY` (top-down and 3D views). Null = nothing to path around. */
export function planeGridFor(world: WorldApi, body: PlaneBody, feetY: number): PlaneGrid | null {
  const key = `${q(body.halfWidth, 0.01)}|${q(body.height, 0.01)}|${q(feetY, 0.5)}`;
  return remember(navFor(world).plane, key, () => buildPlaneGrid(world.solidBoxes(), body, q(feetY, 0.5) * 0.5));
}

/** Platform graph for a body (side view). Null = no blocks. */
export function sideGraphFor(world: WorldApi, body: SideBody): SideGraph | null {
  const key = `${q(body.halfWidth, 0.01)}|${q(body.height, 0.01)}`;
  return remember(navFor(world).side, key, () => buildSideGraph(world.solidBoxes(), body));
}
