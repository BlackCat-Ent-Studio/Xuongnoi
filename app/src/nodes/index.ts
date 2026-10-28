import { getNodeDef, registerNode } from '../engine/registry';
import type { NodeCategory, NodeDef } from '../engine/types';
import { andNode, notNode, orNode } from './bool-gates';
import { blockNode } from './block';
import { characterNode } from './character';
import { compareNode } from './compare';
import { carryNode } from './carry';
import { constNode } from './const';
import { counterNode } from './counter';
import { handToolNode } from './hand-tool';
import { interactNode } from './interact';
import { itemNode } from './item';
import { keyNode } from './key';
import { mathNode } from './math';
import { onStartNode } from './on-start';
import { showNumberNode } from './show-number';
import { stickNode } from './stick';
import { timerNode } from './timer';
import { touchNode } from './touch';
import { winLoseNode } from './win-lose';

export const NODE_CATEGORY_LABELS: Record<NodeCategory, string> = {
  input: 'Đầu vào',
  logic: 'Logic',
  math: 'Tính toán',
  object: 'Vật thể',
  action: 'Hành động',
  output: 'Kết quả',
};

// Per-node state types differ; they are erased at the registry boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const STEP_1_NODES: NodeDef<any>[] = [
  keyNode,
  stickNode,
  onStartNode,
  andNode,
  orNode,
  notNode,
  constNode,
  mathNode,
  compareNode,
  counterNode,
  timerNode,
  characterNode,
  blockNode,
  touchNode,
  winLoseNode,
  showNumberNode,
  itemNode,
  carryNode,
  interactNode,
  handToolNode,
];

/** Registers all step-1 nodes. Safe to call repeatedly. */
export function registerAllNodes(): void {
  for (const def of STEP_1_NODES) {
    if (!getNodeDef(def.kind)) registerNode(def);
  }
}
