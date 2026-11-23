import { getNodeDef } from '../../engine/registry';
import type { Graph, ViewMode } from '../../engine/types';
import { listMissingWires } from '../graph/missing-wires';
import { CONSOLE_TEXT } from './console-text-vi';

export interface Issue {
  key: string;
  text: string;
  /** Node to jump to; absent for board-level issues. */
  nodeId?: string;
}

/** The pinned "Việc cần sửa" list: unconnected required inputs, then a missing Nhân vật when the mode has one. */
export function computeIssues(graph: Graph, mode: ViewMode): Issue[] {
  const issues: Issue[] = [];
  for (const m of listMissingWires(graph)) {
    const node = graph.nodes.find((n) => n.id === m.nodeId);
    const label = (node && getNodeDef(node.kind)?.label) || m.nodeId;
    issues.push({ key: `w:${m.nodeId}:${m.portId}`, nodeId: m.nodeId, text: CONSOLE_TEXT.missingWire(label, m.label) });
  }
  const character = getNodeDef('character');
  const available = character !== undefined && (character.modes === undefined || character.modes.includes(mode));
  if (available && graph.nodes.length > 0 && !graph.nodes.some((n) => n.kind === 'character')) {
    issues.push({ key: 'no-character', text: CONSOLE_TEXT.noCharacter });
  }
  return issues;
}
