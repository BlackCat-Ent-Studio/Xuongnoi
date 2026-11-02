import { getNodeDef, registerNode } from '../engine/registry';
import { slotPatrolNode } from './slot-patrol';

/** Nodes that only the puzzle game uses (the editor never registers them). Safe to call repeatedly. */
export function registerPuzzleNodes(): void {
  if (!getNodeDef(slotPatrolNode.kind)) registerNode(slotPatrolNode);
}
