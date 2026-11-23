import { beforeAll, describe, expect, it } from 'vitest';
import { boardIssues } from '../../src/editor/circuits/circuit-issues';
import type { Board, Wire } from '../../src/engine/types';
import { HANDBOOK } from '../../src/handbook';
import { tryCellHold, tryGridFleet } from '../../src/handbook/boards-grid-floor';
import { registerAllNodes } from '../../src/nodes';
import { allBoards } from './solid-helpers';

beforeAll(() => registerAllNodes());

const HOLD = 'giu-o';
const holdTexts = (board: Board): string[] => boardIssues(board, board.mode).filter((i) => i.key.startsWith('hold')).map((i) => i.text);
/** The board without the wires `drop` picks. */
const cut = (board: Board, drop: (w: Wire) => boolean): Board => ({ ...board, graph: { ...board.graph, wires: board.graph.wires.filter((w) => !drop(w)) } });
const into = (port: string) => (w: Wire): boolean => w.to.node === HOLD && w.to.port === port;
const outOf = (port: string) => (w: Wire): boolean => w.from.node === HOLD && w.from.port === port;

describe('"Việc cần sửa": a robot half wired to "Bảng giữ ô"', () => {
  it('no shipped board, lesson or try-board gets such an item', () => {
    const boards = allBoards().map((b) => ({ id: b.id, board: b.board }));
    for (const e of HANDBOOK) for (const [i, t] of (e.extraTries ?? []).entries()) boards.push({ id: `extra:${e.kind}:${i}`, board: t.board() });
    expect(boards.filter((b) => b.board.graph.nodes.some((n) => n.kind === 'cell-hold')).length).toBeGreaterThanOrEqual(2);
    for (const b of boards) expect(holdTexts(b.board), b.id).toEqual([]);
  });

  it('a row with "Robot k" wired but not "Ô robot k muốn tới" (or the other way round) is listed, with the card to jump to', () => {
    const noWant = cut(tryCellHold(), into('want1'));
    expect(holdTexts(noWant)).toEqual(['Bảng giữ ô: hàng robot 1 mới nối một phần, chưa nối dây vào "Ô robot 1 muốn tới"']);
    expect(boardIssues(noWant, noWant.mode).find((i) => i.key.startsWith('hold'))).toMatchObject({ nodeId: HOLD });
    // The robot itself is then no longer on the card: both the row and the robot are named.
    expect(holdTexts(cut(tryCellHold(), into('robot2')))).toEqual([
      'Bảng giữ ô: hàng robot 2 mới nối một phần, chưa nối dây vào "Robot 2"',
      'Thân robot: chưa nối vào ô "Robot ..." nào của Bảng giữ ô, nên các robot khác không biết nó ở đâu để tránh',
    ]);
  });

  it('a row whose "Ô robot k được đi" leads nowhere is listed; "đang chờ ô" and "đứng giữa ô" may stay unused', () => {
    expect(holdTexts(cut(tryCellHold(), outOf('cell1')))).toEqual(['Bảng giữ ô: hàng robot 1 mới nối một phần, chưa có dây nối ra từ "Ô robot 1 được đi" (robot không biết ô nào được đi)']);
    expect(holdTexts(cut(tryCellHold(), outOf('wait1')))).toEqual([]);
    expect(holdTexts(cut(tryCellHold(), outOf('wait2')))).toEqual([]);
  });

  it('a row with no wire at all is not listed, nor a row beyond "Số robot"', () => {
    const board = tryCellHold();
    const spare: Board = { ...board, graph: { ...board.graph, nodes: board.graph.nodes.map((n) => (n.id === HOLD ? { ...n, params: { ...n.params, robots: 3 } } : n)) } };
    expect(holdTexts(spare)).toEqual([]);
    const fewer: Board = { ...board, graph: { ...board.graph, nodes: board.graph.nodes.map((n) => (n.id === HOLD ? { ...n, params: { ...n.params, robots: 1 } } : n)) } };
    // Row 2 is off the card now; its robot still drives on the floor without a row.
    expect(holdTexts(cut(fewer, into('want2')))).toEqual(['Thân robot: chưa nối vào ô "Robot ..." nào của Bảng giữ ô, nên các robot khác không biết nó ở đâu để tránh']);
  });

  it('a copy of a robot circuit that is not wired to the hold card of its board is listed by its name', () => {
    const fleet = tryGridFleet();
    const loose = cut(fleet, (w) => w.from.node === 'xe-3' || w.to.node === 'xe-3');
    expect(holdTexts(loose)).toEqual(['Xe 3: chưa nối vào ô "Robot ..." nào của Bảng giữ ô, nên các robot khác không biết nó ở đâu để tránh']);
    expect(boardIssues(loose, loose.mode).find((i) => i.key.startsWith('hold'))).toMatchObject({ nodeId: 'xe-3' });
    // Only its "Robot" wire cut: the row is half wired and the robot is loose.
    const half = cut(fleet, into('robot3'));
    expect(holdTexts(half)).toEqual([
      'Bảng giữ ô: hàng robot 3 mới nối một phần, chưa nối dây vào "Robot 3"',
      'Xe 3: chưa nối vào ô "Robot ..." nào của Bảng giữ ô, nên các robot khác không biết nó ở đâu để tránh',
    ]);
    // A copy without a robot inside (the floor of markers) is never asked for.
    expect(holdTexts(fleet)).toEqual([]);
  });

  it('a board without a hold card is never asked to wire its robots to one', () => {
    const fleet = tryGridFleet();
    const bare: Board = { ...fleet, graph: { ...fleet.graph, nodes: fleet.graph.nodes.filter((n) => n.id !== HOLD), wires: fleet.graph.wires.filter((w) => w.from.node !== HOLD && w.to.node !== HOLD) } };
    expect(holdTexts(bare)).toEqual([]);
  });
});
