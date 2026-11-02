import { getNodeDef, registerNode } from '../engine/registry';
import { fetchStoreNode } from './fetch-store';
import { PAD_CARRY_KIND, makePadCarryNode } from './pad-carry';
import { padPatrolNode } from './pad-patrol';
import { slotPatrolNode } from './slot-patrol';

/** Nodes that only the puzzle game uses (the editor never registers them). Safe to call repeatedly. */
export function registerPuzzleNodes(): void {
  if (!getNodeDef(slotPatrolNode.kind)) registerNode(slotPatrolNode);
  if (!getNodeDef(fetchStoreNode.kind)) registerNode(fetchStoreNode);
  if (!getNodeDef(padPatrolNode.kind)) registerNode(padPatrolNode);
  if (!getNodeDef(PAD_CARRY_KIND)) registerNode(makePadCarryNode());
}
