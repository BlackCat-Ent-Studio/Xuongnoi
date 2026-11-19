import { describe, expect, it } from 'vitest';
import { expandBoard } from '../../src/circuits/expand';
import { runnableGraph } from '../../src/circuits/runnable';
import { createEditorState } from '../../src/editor/editor-state';
import type { Board, Circuit } from '../../src/engine/types';
import { HANDBOOK } from '../../src/handbook';
import { listAllSamples, parseBoard, serializeBoard } from '../../src/io';
import { CURRENT_FORMAT_VERSION } from '../../src/io/migrations';
import { LESSONS } from '../../src/tutorial/lessons';
import { circuit, copyOf, node, wire } from './circuit-helpers';

function ok(text: string): Board {
  const res = parseBoard(text);
  if (!res.ok) throw new Error(res.error);
  return res.board;
}

function fail(text: string): string {
  const res = parseBoard(text);
  if (res.ok) throw new Error('expected parse failure');
  return res.error;
}

const tally = (): Circuit =>
  circuit(
    'tally',
    {
      nodes: [node('count', 'counter', { start: 0, target: 5 }), node('try-key', 'key', { key: 'KeyT' })],
      wires: [wire('w1', 'try-key.pressed', 'count.up')],
      knots: { pos: { k1: { x: 10, y: 20 } }, chain: { w1: ['k1'] } },
    },
    {
      name: 'Bộ đếm',
      color: '#22c55e',
      pins: [
        { id: 'tick', label: 'Nhịp', dir: 'in', type: 'bool', inner: { node: 'count', port: 'up' } },
        { id: 'count', label: 'Số đếm', dir: 'out', type: 'number', inner: { node: 'count', port: 'value' } },
      ],
      exposed: [{ id: 'goal', label: 'Mục tiêu', inner: { node: 'count', param: 'target' } }],
      benchIds: ['try-key'],
    },
  );

/** A pair of counters: a circuit that holds two copies of another circuit. */
const pair = (): Circuit =>
  circuit(
    'pair',
    { nodes: [copyOf('first', 'tally', { x: 1, z: 2, heading: 90 }, { goal: 2 }), copyOf('second', 'tally')], wires: [] },
    {
      name: 'Cặp đếm',
      pins: [{ id: 'tick', label: 'Nhịp', dir: 'in', type: 'bool', inner: { node: 'first', port: 'tick' } }],
      exposed: [{ id: 'goal', label: 'Mục tiêu sau', inner: { node: 'second', param: 'value:goal' } }],
    },
  );

const withCircuits = (): Board => ({
  name: 'Có bảng mạch',
  mode: '3d',
  graph: {
    nodes: [node('key', 'key', { key: 'KeyE' }), copyOf('a', 'tally', { x: 3, z: -2, heading: 45 }, { goal: 9 }), copyOf('p', 'pair', undefined, { goal: 4 }), node('show', 'show-number', { label: 'Điểm', corner: 'top-left' })],
    wires: [wire('w1', 'key.pressed', 'a.tick'), wire('w2', 'a.count', 'show.value'), wire('w3', 'key.held', 'p.tick')],
    settings: { wireRule: true },
  },
  circuits: [tally(), pair()],
});

const asJson = (patch: (o: any) => void): string => {
  const o = JSON.parse(serializeBoard(withCircuits()));
  patch(o);
  return JSON.stringify(o);
};

describe('circuits in the save format', () => {
  it('saves and loads circuits, copies, their placement and their own values', () => {
    const board = withCircuits();
    const text = serializeBoard(board);
    const loaded = ok(text);
    expect(loaded.circuits).toEqual(board.circuits);
    expect(loaded.graph.nodes.filter((n) => n.kind === 'circuit').map((n) => n.params)).toEqual([
      { circuit: 'tally', position: { x: 3, y: 0, z: -2 }, heading: 45, 'value:goal': 9 },
      { circuit: 'pair', position: { x: 0, y: 0, z: 0 }, heading: 0, 'value:goal': 4 },
    ]);
    expect(serializeBoard(loaded)).toBe(text);
    expect(expandBoard(loaded).graph).toEqual(expandBoard(board).graph);
    expect(expandBoard(loaded).graph.nodes.map((n) => `${n.id}=${n.params.target ?? ''}`)).toEqual(['key=', 'a/count=9', 'p/first/count=2', 'p/second/count=4', 'show=']);
  });

  it('keeps the format version: an older app refuses the file by its unknown card kind, a file without circuits is unchanged', () => {
    expect(CURRENT_FORMAT_VERSION).toBe(1);
    expect(JSON.parse(serializeBoard(withCircuits())).format_version).toBe(1);
  });

  it('a board without circuits is written exactly as before, and reads back to the same text', () => {
    const samples = listAllSamples().map((s) => s.board);
    const boards: Board[] = [...samples, ...LESSONS.map((l) => l.createBoard()), ...HANDBOOK.map((e) => e.tryBoard())];
    expect(boards.length).toBeGreaterThan(100);
    for (const board of boards) {
      const text = serializeBoard(board);
      expect(text).not.toContain('"circuits"');
      expect(Object.keys(JSON.parse(text))).toEqual(['format_version', 'name', 'mode', 'graph', ...(board.notes?.length ? ['notes'] : [])]);
      const loaded = ok(text);
      expect('circuits' in loaded).toBe(false);
      // A board built in code may hold what loading tidies away (extra keys, missing wire-rule wires); a loaded board is stable.
      const file = serializeBoard(loaded);
      expect(serializeBoard(ok(file))).toBe(file);
    }
    // The shipped samples are loaded boards already: file -> load -> save gives the very same text.
    for (const board of samples) expect(serializeBoard(ok(serializeBoard(board)))).toBe(serializeBoard(board));
    expect(serializeBoard({ ...boards[0]!, circuits: [] })).toBe(serializeBoard(boards[0]!));
  });

  it('rejects a broken circuits list with a Vietnamese message', () => {
    expect(fail(asJson((o) => (o.circuits = 'x')))).toBe('Danh sách bảng mạch trong tệp bị hỏng.');
    expect(fail(asJson((o) => delete o.circuits[0].name))).toBe('Bảng mạch số 1 trong tệp bị hỏng.');
    expect(fail(asJson((o) => (o.circuits[1].pins[0].dir = 'both')))).toBe('Bảng mạch số 2 trong tệp bị hỏng.');
    expect(fail(asJson((o) => (o.circuits[1].id = 'tally')))).toBe('Có hai bảng mạch trùng mã "tally".');
  });

  it('rejects a copy of a circuit the file does not have', () => {
    expect(fail(asJson((o) => (o.graph.nodes[1].params.circuit = 'ghost')))).toBe('Mảnh ghép "a" dùng bảng mạch "ghost" mà tệp không có.');
    expect(fail(asJson((o) => (o.circuits[1].graph.nodes[0].params.circuit = 'ghost')))).toBe('Bảng mạch "Cặp đếm": Mảnh ghép "first" dùng bảng mạch "ghost" mà tệp không có.');
    expect(fail(asJson((o) => delete o.circuits))).toBe('Mảnh ghép "a" dùng bảng mạch "tally" mà tệp không có.');
  });

  it('rejects pins, exposed settings and bench ids that lead nowhere', () => {
    expect(fail(asJson((o) => (o.circuits[0].pins[0].inner.port = 'ghost')))).toBe('Bảng mạch "Bộ đếm": Chân "tick" bị trùng mã, hoặc không trỏ tới một cổng đúng loại ở bên trong.');
    expect(
      fail(
        asJson((o) => {
          o.circuits[0].pins[1].type = 'bool';
          o.graph.wires.splice(1, 1);
        }),
      ),
    ).toContain('Chân "count"');
    expect(fail(asJson((o) => (o.circuits[0].exposed[0].inner.node = 'ghost')))).toBe('Bảng mạch "Bộ đếm": Thông số mở "goal" bị trùng mã, hoặc không trỏ tới một thông số có thật ở bên trong.');
    expect(fail(asJson((o) => o.circuits[0].benchIds.push('ghost')))).toBe('Bảng mạch "Bộ đếm": Mảnh ghép thử "ghost" không có trong bảng mạch.');
    expect(fail(asJson((o) => (o.circuits[0].benchIds = [])))).toBe('Bảng mạch "Bộ đếm": Chân vào "tick" trỏ tới một cổng đã có dây ở bên trong.');
  });

  it('rejects wires onto a pin that does not exist or has another type, in the usual wire wording', () => {
    expect(fail(asJson((o) => (o.graph.wires[0].to.port = 'ghost')))).toBe('Dây "w1" không nối được: Không tìm thấy cổng để nối.');
    expect(fail(asJson((o) => (o.graph.wires[1].from.port = 'tick')))).toContain('Dây "w2" không nối được: Hãy nối từ cổng ra');
    expect(fail(asJson((o) => (o.graph.wires[0].from.node = 'a') && (o.graph.wires[0].from.port = 'count') && (o.graph.wires[0].to.node = 'p')))).toContain('Khác loại dây');
    expect(fail(asJson((o) => o.graph.wires.push({ id: 'w9', from: { node: 'key', port: 'held' }, to: { node: 'a', port: 'tick' } })))).toContain('đã có dây');
  });

  it('rejects a bad placement or a bad own value of a copy', () => {
    expect(fail(asJson((o) => (o.graph.nodes[1].params.position = 5)))).toBe('Mảnh ghép "a": giá trị của "position" không hợp lệ.');
    expect(fail(asJson((o) => (o.graph.nodes[1].params.heading = 'north')))).toBe('Mảnh ghép "a": giá trị của "heading" không hợp lệ.');
    expect(fail(asJson((o) => (o.graph.nodes[1].params['value:goal'] = 'nine')))).toBe('Mảnh ghép "a": giá trị của thông số mở "goal" không hợp lệ.');
    expect(fail(asJson((o) => (o.graph.nodes[1].params['value:goal'] = null)))).toBe('Mảnh ghép "a": giá trị của "value:goal" không hợp lệ.');
  });

  it('rejects a circuit that contains itself and nesting that is too deep', () => {
    expect(
      fail(
        asJson((o) => {
          o.circuits[0].graph.nodes.push({ id: 'back', kind: 'circuit', params: { circuit: 'pair' }, pos: { x: 0, y: 0 } });
        }),
      ),
    ).toBe('Bảng mạch chứa chính nó (Bộ đếm › Cặp đếm › Bộ đếm).');
    const deep = asJson((o) => {
      for (let i = 1; i <= 4; i++) {
        o.circuits.push({ id: `box${i}`, name: `Hộp ${i}`, graph: { nodes: [{ id: 'in', kind: 'circuit', params: { circuit: i === 1 ? 'tally' : `box${i - 1}` }, pos: { x: 0, y: 0 } }], wires: [] } });
      }
    });
    expect(fail(deep)).toBe('Bảng mạch lồng nhau quá 4 tầng (Hộp 4 › Hộp 3 › Hộp 2 › Hộp 1 › Bộ đếm).');
  });

  it('fills in what a hand-written file leaves out, and drops values for settings the circuit no longer exposes', () => {
    const loaded = ok(
      asJson((o) => {
        o.graph.nodes[1].params = { circuit: 'tally', 'value:old': 3, junk: true };
        delete o.circuits[1].exposed;
        delete o.circuits[1].benchIds;
        o.circuits[0].color = 'red';
      }),
    );
    expect(loaded.graph.nodes[1]!.params).toEqual({ circuit: 'tally', position: { x: 0, y: 0, z: 0 }, heading: 0, 'value:old': 3 });
    expect(loaded.circuits![1]).toMatchObject({ exposed: [], benchIds: [] });
    expect(loaded.circuits![0]!.color).toBeUndefined();
    expect(expandBoard(loaded).graph.nodes.find((n) => n.id === 'a/count')!.params.target).toBe(5);
  });

  it('the editor state keeps the circuits through an edit and an undo, and what it runs is the flat graph', () => {
    const state = createEditorState({ name: 't', mode: '3d', graph: { nodes: [], wires: [] } });
    const board = ok(serializeBoard(withCircuits()));
    state.loadBoard(board);
    expect(state.getBoard().circuits).toEqual(board.circuits);
    state.setParam('key', 'key', 'KeyQ');
    state.setParam('a', 'value:goal', 7);
    expect(state.getBoard().circuits).toEqual(board.circuits);
    const flat = runnableGraph(state.getBoard());
    expect(flat.nodes.find((n) => n.id === 'a/count')!.params.target).toBe(7);
    expect(flat.nodes.find((n) => n.id === 'key')!.params.key).toBe('KeyQ');
    state.undo();
    expect(runnableGraph(state.getBoard()).nodes.find((n) => n.id === 'a/count')!.params.target).toBe(9);
    expect(ok(serializeBoard(state.getBoard())).circuits).toEqual(board.circuits);
  });
});
