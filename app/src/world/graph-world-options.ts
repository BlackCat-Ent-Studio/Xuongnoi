import { cleanGravity, type Graph } from '../engine/types';
import type { WorldOptions } from './world-options';

/**
 * World rules a game asks for through its settings. Undefined (the plain rules) unless "Va chạm thật" or "Vật lý thật" is on.
 * The editor keeps each character's own size, so no collision box, hold point or scale from the puzzle game's stage
 * is applied here. Every character carries in front (low, just clear of its body): an item held overhead would land
 * on its carrier's head when let go.
 * Gravity is only passed on when the maker set one; the world reads a missing value as 9.81.
 */
export function worldOptionsForGraph(graph: Graph): WorldOptions | undefined {
  const solid = graph.settings?.solidBodies === true;
  const real = graph.settings?.realPhysics === true;
  if (!solid && !real) return undefined;
  const gravity = real ? cleanGravity(graph.settings?.gravity) : undefined;
  return {
    ...(solid ? { solidBodies: true, frontCarryAll: true } : {}),
    ...(real ? { realPhysics: true } : {}),
    ...(gravity !== undefined ? { gravity } : {}),
  };
}
