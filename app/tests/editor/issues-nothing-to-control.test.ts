import { beforeAll, describe, expect, it } from 'vitest';
import { boardIssues } from '../../src/editor/circuits/circuit-issues';
import { computeIssues } from '../../src/editor/console/issues';
import type { Board, GraphNode } from '../../src/engine/types';
import { HANDBOOK, handbookEntry } from '../../src/handbook';
import { registerAllNodes } from '../../src/nodes';
import { allBoards } from './solid-helpers';

beforeAll(() => registerAllNodes());

const node = (id: string, kind: string): GraphNode => ({ id, kind, params: {}, pos: { x: 0, y: 0 } });
const keysOf = (kinds: string[]): string[] => computeIssues({ nodes: kinds.map((k, i) => node(`n${i}`, k)), wires: [] }, '3d').map((i) => i.key);
const NOTHING = 'no-character';
const CONTROLS = ['key', 'stick'];
const PLAYABLE = ['character', 'robot-body', 'vehicle', 'joint', 'linear-actuator'];

/** Every board the app ships: samples, lesson start boards, handbook try-boards and the extra try-boards. */
function shipped(): { id: string; board: Board }[] {
  const out = allBoards().map((b) => ({ id: b.id, board: b.board }));
  for (const e of HANDBOOK) for (const [i, t] of (e.extraTries ?? []).entries()) out.push({ id: `extra:${e.kind}:${i}`, board: t.board() });
  return out;
}
const kindsOf = (board: Board): Set<string> => new Set([...board.graph.nodes, ...(board.circuits ?? []).flatMap((c) => c.graph.nodes)].map((n) => n.kind));

describe('"Chưa có mảnh ghép Nhân vật": only for a board with player controls and nothing to control', () => {
  it('a machine that runs by itself is not asked for a Nhân vật', () => {
    expect(keysOf(['on-start', 'timer', 'spawner', 'block', 'zone', 'show-number'])).not.toContain(NOTHING);
    expect(keysOf(['block', 'item'])).not.toContain(NOTHING);
    expect(keysOf(['ui-button', 'latch', 'show-text'])).not.toContain(NOTHING);
  });

  it('a board with a key or a stick and nothing they could drive still is', () => {
    for (const control of CONTROLS) {
      expect(keysOf([control]), control).toContain(NOTHING);
      expect(keysOf([control, 'block', 'spawner', 'show-text']), control).toContain(NOTHING);
      for (const thing of PLAYABLE) expect(keysOf([control, thing]), `${control} + ${thing}`).not.toContain(NOTHING);
    }
  });

  it('the "Đọc mã" try-board has nothing to fix', () => {
    const board = handbookEntry('code-reader')!.tryBoard();
    expect(boardIssues(board, board.mode)).toEqual([]);
  });

  it('on the shipped boards it shows exactly where a key or stick has nothing to control', () => {
    for (const b of shipped()) {
      const kinds = kindsOf(b.board);
      const expected = CONTROLS.some((k) => kinds.has(k)) && !PLAYABLE.some((k) => kinds.has(k));
      expect(boardIssues(b.board, b.board.mode).some((i) => i.key === NOTHING), b.id).toBe(expected);
    }
  });
});
