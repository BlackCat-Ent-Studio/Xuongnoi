import { beforeAll, describe, expect, it } from 'vitest';
import { expandBoard, expandCircuitAlone } from '../../src/circuits/expand';
import { instanceValueKey } from '../../src/circuits/instance';
import { validateCircuits } from '../../src/circuits/validate';
import type { Board, Circuit, CircuitPin } from '../../src/engine/types';
import { importCircuitFile, importClash, parseCircuitFile, serializeCircuitFile } from '../../src/io/circuit-file';
import { circuitsForFile } from '../../src/io/circuits-format';
import { parseBoard, serializeBoard } from '../../src/io/save-format';
import { registerAllNodes } from '../../src/nodes';
import { circuit, copyOf, node, wire } from './circuit-helpers';

beforeAll(() => registerAllNodes());

const pin = (id: string, dir: 'in' | 'out', type: CircuitPin['type'], inner: string, label = id): CircuitPin => {
  const [n, p] = inner.split('.') as [string, string];
  return { id, label, dir, type, inner: { node: n, port: p } };
};

/** "Trạm" holds two copies of "Bộ so" (which holds nothing) and passes one of its pins on; "Lẻ" is not used by "Trạm". */
function factory(): Board {
  const compare = circuit(
    'cmp',
    { nodes: [node('c', 'compare', { op: 'gt' }), node('five', 'const', { value: 5 })], wires: [wire('w1', 'five.value', 'c.b')] },
    {
      name: 'Bộ so',
      color: '#0ea5e9',
      pins: [pin('a', 'in', 'number', 'c.a', 'Số A'), pin('out', 'out', 'bool', 'c.out', 'Lớn hơn')],
      exposed: [{ id: 'e1', label: 'Mốc', inner: { node: 'five', param: 'value' } }],
    },
  );
  const station = circuit(
    'station',
    {
      nodes: [copyOf('k1', 'cmp', { x: 0, z: 0 }, { e1: 3 }), copyOf('k2', 'cmp'), node('both', 'and')],
      wires: [wire('w1', 'k1.out', 'both.a'), wire('w2', 'k2.out', 'both.b')],
      stacks: ['cmp'],
    },
    { name: 'Trạm', pins: [pin('p1', 'in', 'number', 'k1.a', 'Số 1'), pin('p2', 'in', 'number', 'k2.a', 'Số 2'), pin('ok', 'out', 'bool', 'both.out', 'Cả hai')] },
  );
  const loose = circuit('loose', { nodes: [node('n', 'not')], wires: [] }, { name: 'Lẻ' });
  return {
    name: 'Xưởng',
    mode: '3d',
    graph: {
      nodes: [node('src', 'const', { value: 9 }), copyOf('s1', 'station'), node('show', 'not')],
      wires: [wire('w1', 'src.value', 's1.p1'), wire('w2', 's1.ok', 'show.in')],
    },
    circuits: [compare, station, loose],
  };
}

/** A circuit written out with its id and the ids it refers to taken out, to compare circuits whose ids differ. */
const shapeOf = (c: Circuit, ids: ReadonlyMap<string, string>): string => {
  let text = JSON.stringify(circuitsForFile([{ ...c, id: 'X' }])[0]);
  for (const [from, to] of ids) text = text.split(`"circuit":"${from}"`).join(`"circuit":"${to}"`).split(`"${from}"]`).join(`"${to}"]`);
  return text;
};
const emptyBoard = (): Board => ({ name: 'Mới', mode: '3d', graph: { nodes: [], wires: [] } });
const parsed = (text: string) => {
  const res = parseCircuitFile(text);
  if (!res.ok) throw new Error(res.error);
  return res.file;
};

describe('one circuit as a file', () => {
  it('holds the circuit and the circuits it contains, and nothing else of the board', () => {
    const text = serializeCircuitFile(factory(), 'station')!;
    const file = parsed(text);
    expect(file.root).toBe('station');
    expect(file.circuits.map((c) => c.name)).toEqual(['Trạm', 'Bộ so']);
    expect(text).not.toContain('Lẻ');
    expect(text).not.toContain('Xưởng');
    expect(serializeCircuitFile(factory(), 'nope')).toBeNull();
  });

  it('round trip: exported and imported into an empty board, the circuits are the same and run the same', () => {
    const source = factory();
    const file = parsed(serializeCircuitFile(source, 'station')!);
    const res = importCircuitFile(emptyBoard(), file);
    if (!res.ok) throw new Error(res.reason);
    expect(res).toMatchObject({ name: 'Trạm', contained: 1, dropped: 0 });
    const got = res.board.circuits!;
    expect(got.map((c) => c.name)).toEqual(['Trạm', 'Bộ so']);
    const newIdOf = new Map([['station', res.circuitId], ['cmp', got[1]!.id]]);
    expect(shapeOf(got[0]!, new Map())).toBe(shapeOf(source.circuits![1]!, newIdOf));
    expect(shapeOf(got[1]!, new Map())).toBe(shapeOf(source.circuits![0]!, newIdOf));
    expect(validateCircuits(res.board)).toEqual([]);
    // The same flat graph when the circuit runs alone (ids inside a circuit are kept).
    expect(expandCircuitAlone(res.board, res.circuitId).graph).toEqual(expandCircuitAlone(source, 'station').graph);
    // And the board with the imported circuit saves and loads.
    const again = parseBoard(serializeBoard(res.board));
    expect(again.ok && again.board.circuits).toEqual(res.board.circuits);
    // Exporting what was imported gives the same file again, apart from the ids.
    const second = parsed(serializeCircuitFile(res.board, res.circuitId)!);
    expect(second.circuits.map((c) => shapeOf(c, new Map([[got[1]!.id, 'cmp']])))).toEqual(file.circuits.map((c) => shapeOf(c, new Map())));
  });

  it('name clash, both kept: the incoming circuits get new ids and a number behind the name; the board is otherwise untouched', () => {
    const board = factory();
    const file = parsed(serializeCircuitFile(board, 'station')!);
    expect(importClash(board, file)?.id).toBe('station');
    const res = importCircuitFile(board, file);
    if (!res.ok) throw new Error(res.reason);
    expect(res.name).toBe('Trạm 2');
    expect(res.board.circuits!.map((c) => c.name)).toEqual(['Bộ so', 'Trạm', 'Lẻ', 'Trạm 2', 'Bộ so 2']);
    expect(new Set(res.board.circuits!.map((c) => c.id)).size).toBe(5);
    expect(res.board.circuits!.slice(0, 3)).toEqual(board.circuits);
    expect(res.board.graph).toBe(board.graph);
    expect(expandBoard(res.board).graph).toEqual(expandBoard(board).graph);
    expect(validateCircuits(res.board)).toEqual([]);
  });

  it('name clash, old one replaced: every copy now is a copy of the imported circuit; wires on pins that are gone are removed', () => {
    const board = factory();
    // The file holds a later "Trạm": pin p1 is gone, pin p2 and the out pin stay.
    const later: Board = { ...board, circuits: board.circuits!.map((c) => (c.id === 'station' ? { ...c, pins: c.pins.filter((p) => p.id !== 'p1') } : c)) };
    const file = parsed(serializeCircuitFile({ circuits: later.circuits }, 'station')!);
    const res = importCircuitFile(board, file, { replace: 'station' });
    if (!res.ok) throw new Error(res.reason);
    expect(res).toMatchObject({ circuitId: 'station', name: 'Trạm', dropped: 1, contained: 1 });
    expect(res.board.graph.wires.map((w) => w.id)).toEqual(['w2']);
    expect(res.board.circuits!.find((c) => c.id === 'station')!.pins.map((p) => p.id)).toEqual(['p2', 'ok']);
    // The replaced circuit uses the "Bộ so" that came with the file, the board's own one is left alone.
    expect(res.board.circuits!.map((c) => c.name)).toEqual(['Bộ so', 'Trạm', 'Lẻ', 'Bộ so 2']);
    expect(validateCircuits(res.board)).toEqual([]);
    expect(expandBoard(res.board).graph.nodes.some((n) => n.id === 's1/k1/c')).toBe(true);
    const again = parseBoard(serializeBoard(res.board));
    expect(again.ok).toBe(true);
  });

  it('replacing lets go of what no longer fits elsewhere: a pin of another circuit that passed a lost pin on, a value of another shape', () => {
    const board = factory();
    // A later "Bộ so": pin "a" is gone and the opened setting e1 now is a text (the op of the comparison).
    const laterCmp: Circuit = {
      ...board.circuits![0]!,
      pins: board.circuits![0]!.pins.filter((p) => p.id !== 'a'),
      exposed: [{ id: 'e1', label: 'Kiểu', inner: { node: 'c', param: 'op' } }],
    };
    const file = parsed(serializeCircuitFile({ circuits: [laterCmp] }, 'cmp')!);
    const res = importCircuitFile(board, file, { replace: 'cmp' });
    if (!res.ok) throw new Error(res.reason);
    const station = res.board.circuits!.find((c) => c.id === 'station')!;
    expect(station.pins.filter((p) => p.dir === 'in').map((p) => p.inner.node)).toEqual(['', '']);
    expect(station.graph.nodes.find((n) => n.id === 'k1')!.params[instanceValueKey('e1')]).toBeUndefined();
    expect(validateCircuits(res.board).map((i) => i.code)).toEqual(['pin-unwired', 'pin-unwired']);
    expect(parseBoard(serializeBoard(res.board)).ok).toBe(true);
  });

  it('refuses a board that would nest too deep, and files that are not circuit files', () => {
    // a > b > c > d is four levels: allowed on its own, too deep once "a" replaces a circuit that sits inside another.
    const chain = ['a', 'b', 'c', 'd'].map((id, i, all) => circuit(id, { nodes: i + 1 < all.length ? [copyOf('k', all[i + 1]!)] : [node('n', 'not')], wires: [] }, { name: id === 'a' ? 'Lẻ' : id }));
    const file = parsed(serializeCircuitFile({ circuits: chain }, 'a')!);
    const host: Board = { ...factory(), circuits: [...factory().circuits!, circuit('outer', { nodes: [copyOf('k', 'loose')], wires: [] })] };
    expect(importCircuitFile(host, file, { replace: 'loose' })).toEqual({ ok: false, reason: 'too-deep' });
    expect(importCircuitFile(host, file).ok).toBe(true);

    expect(parseCircuitFile('nope')).toMatchObject({ ok: false });
    const asBoard = parseCircuitFile(serializeBoard(factory()));
    expect(asBoard.ok === false && asBoard.error).toContain('cả một mô phỏng');
    const text = serializeCircuitFile(factory(), 'station')!;
    expect(parseCircuitFile(text.replace('"root": "station"', '"root": "gone"')).ok).toBe(false);
    // A circuit file is held to the rules of a board: a copy of a circuit the file does not have is refused.
    const broken = JSON.parse(text) as { circuits: unknown[] };
    broken.circuits.pop();
    expect(parseCircuitFile(JSON.stringify(broken)).ok).toBe(false);
  });
});
