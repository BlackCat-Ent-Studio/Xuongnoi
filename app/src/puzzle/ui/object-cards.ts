import { getNodeDef } from '../../engine/registry';
import type { GraphNode } from '../../engine/types';

/** Cards that stand for something on the stage: characters, blocks, items, vehicles, platforms (object cards) and zone sensors. */
export function isObjectKind(kind: string): boolean {
  return getNodeDef(kind)?.category === 'object' || kind === 'zone';
}

/** The name the level gave the object ("Cờ", "Cửa kho"), or '' when it has none. */
export function objectName(node: GraphNode): string {
  const v = node.params.name;
  return typeof v === 'string' ? v.trim() : '';
}

/** Object cards that show their own name as the title (plus a picture): the object kinds, not the zone sensor (it is a logic piece). */
export function hasNamedTitle(node: GraphNode): boolean {
  return getNodeDef(node.kind)?.category === 'object' && objectName(node) !== '';
}

const FLOOR_LENGTH = 12;
const FLOOR_THICKNESS = 1.5;

/**
 * A long, thin block is the floor or the wall of the room. Tapping it on the stage means "nothing in particular", so
 * it does not pick its card (the card itself can still be tapped to see it on the stage).
 */
export function isFloorLike(node: GraphNode): boolean {
  if (node.kind !== 'block') return false;
  const size = node.params.size;
  if (typeof size !== 'object' || size === null) return false;
  const { x, y } = size as { x?: unknown; y?: unknown };
  return typeof x === 'number' && typeof y === 'number' && x >= FLOOR_LENGTH && y <= FLOOR_THICKNESS;
}
