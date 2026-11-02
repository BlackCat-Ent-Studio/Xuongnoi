import type { Graph } from '../engine/types';
import type { WorldOptions } from './world-options';

/**
 * World rules a game asks for through its settings. Undefined (the plain rules) unless "Va chạm thật" is on.
 * The editor keeps each character's own size, so no collision box, hold point or scale from the puzzle game's stage
 * is applied here. Every character carries in front (low, just clear of its body): an item held overhead would land
 * on its carrier's head when let go.
 */
export function worldOptionsForGraph(graph: Graph): WorldOptions | undefined {
  return graph.settings?.solidBodies === true ? { solidBodies: true, frontCarryAll: true } : undefined;
}
