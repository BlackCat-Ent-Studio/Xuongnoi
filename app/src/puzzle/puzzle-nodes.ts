import { getNodeDef, registerNode } from '../engine/registry';
import { fetchStoreNode } from './fetch-store';
import { slotPatrolNode } from './slot-patrol';

/** Nodes that only the puzzle game uses (the editor never registers them). Safe to call repeatedly. */
export function registerPuzzleNodes(): void {
  if (!getNodeDef(slotPatrolNode.kind)) registerNode(slotPatrolNode);
  if (!getNodeDef(fetchStoreNode.kind)) registerNode(fetchStoreNode);
}
