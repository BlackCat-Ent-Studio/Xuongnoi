import { getNodeDef } from '../../engine/registry';
import type { Graph, ViewMode } from '../../engine/types';
import { listMissingWires } from '../graph/missing-wires';
import { CONSOLE_TEXT } from './console-text-vi';

/** Pieces that give the board something to play: a character, or a robot chassis / vehicle that wires drive. */
const PLAYABLE_KINDS: ReadonlySet<string> = new Set(['character', 'robot-body', 'vehicle', 'joint', 'linear-actuator']);
/** Pieces a player steers with. A board that has one and nothing to steer is unfinished; a machine that runs by itself (no such piece) is not. */
const CONTROL_KINDS: ReadonlySet<string> = new Set(['key', 'stick']);

export interface Issue {
  key: string;
  text: string;
  /** Node to jump to; absent for board-level issues. */
  nodeId?: string;
}

/** The pinned "Việc cần sửa" list: unconnected required inputs, then a missing Nhân vật when the mode has one and the board has player controls with nothing to control. */
export function computeIssues(graph: Graph, mode: ViewMode): Issue[] {
  const issues: Issue[] = [];
  for (const m of listMissingWires(graph)) {
    const node = graph.nodes.find((n) => n.id === m.nodeId);
    const label = (node && getNodeDef(node.kind)?.label) || m.nodeId;
    issues.push({ key: `w:${m.nodeId}:${m.portId}`, nodeId: m.nodeId, text: CONSOLE_TEXT.missingWire(label, m.label) });
  }
  const character = getNodeDef('character');
  const available = character !== undefined && (character.modes === undefined || character.modes.includes(mode));
  if (available && graph.nodes.some((n) => CONTROL_KINDS.has(n.kind)) && !graph.nodes.some((n) => PLAYABLE_KINDS.has(n.kind))) {
    issues.push({ key: 'no-character', text: CONSOLE_TEXT.noCharacter });
  }
  return issues;
}
