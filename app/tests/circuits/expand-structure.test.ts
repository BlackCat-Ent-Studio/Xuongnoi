import { beforeAll, describe, expect, it } from 'vitest';
import { CircuitError, expandBoard, expandCircuitAlone } from '../../src/circuits/expand';
import { MAX_CIRCUIT_DEPTH, canConnectIn, circuitLookup, instancePorts, readInstance } from '../../src/circuits/instance';
import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { compileGraph } from '../../src/engine/compile';
import type { Board, Circuit, Graph, GraphNode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { circuit, copyOf, node, sampleBoard, wire } from './circuit-helpers';

beforeAll(() => registerAllNodes());

const board = (graph: Graph, circuits: Circuit[]): Board => ({ name: 't', mode: '3d', graph, circuits });
const byId = (g: Graph, id: string): GraphNode => g.nodes.find((n) => n.id === id)!;
const wireKeys = (g: Graph): string[] => g.wires.map((w) => `${w.id}: ${w.from.node}.${w.from.port} > ${w.to.node}.${w.to.port}`);
const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (err) {
    return err instanceof CircuitError ? err.code : `other: ${String(err)}`;
  }
  return 'no error';
};

/** Counts pulses on pin "tick", shows the count on pin "count"; target is exposed. A bench key drives it when tried alone. */
const tally = (): Circuit =>
  circuit(
    'tally',
    { nodes: [node('count', 'counter', { start: 0, target: 5 }), node('try-key', 'key', { key: 'KeyT' })], wires: [wire('w1', 'try-key.pressed', 'count.up')] },
    {
      pins: [
        { id: 'tick', label: 'Nhịp', dir: 'in', type: 'bool', inner: { node: 'count', port: 'up' } },
        { id: 'count', label: 'Số đếm', dir: 'out', type: 'number', inner: { node: 'count', port: 'value' } },
        { id: 'done', label: 'Xong', dir: 'out', type: 'bool', inner: { node: 'count', port: 'reached' } },
      ],
      exposed: [{ id: 'goal', label: 'Mục tiêu', inner: { node: 'count', param: 'target' } }],
      benchIds: ['try-key'],
    },
  );

const tallyBoard = (): Board =>
  board(
    {
      nodes: [node('key', 'key', { key: 'KeyE' }), copyOf('a', 'tally', undefined, { goal: 9 }), copyOf('b', 'tally'), node('show', 'show-number')],
      wires: [wire('w1', 'key.pressed', 'a.tick'), wire('w2', 'a.count', 'show.value'), wire('w3', 'a.done', 'b.tick')],
    },
    [tally()],
  );

describe('expanding a board that uses circuits', () => {
  it('replaces each copy by the inner nodes under "<copy>/<inner>" and moves pin wires onto the inner ports', () => {
    const { graph } = expandBoard(tallyBoard());
    expect(graph.nodes.map((n) => `${n.id}:${n.kind}`)).toEqual(['key:key', 'a/count:counter', 'b/count:counter', 'show:show-number']);
    expect(wireKeys(graph)).toEqual([
      'w1: key.pressed > a/count.up',
      'w2: a/count.value > show.value',
      'w3: a/count.reached > b/count.up',
    ]);
  });

  it('leaves a pin without a wire unwired, and drops bench nodes with their wires', () => {
    const { graph } = expandBoard(tallyBoard());
    expect(graph.nodes.some((n) => n.id.endsWith('try-key'))).toBe(false);
    expect(graph.wires.some((w) => w.to.node === 'b/count' && w.to.port !== 'up')).toBe(false);
    expect(graph.wires.filter((w) => w.from.node === 'b/count')).toEqual([]);
  });

  it('writes a copy\'s own value into the inner setting; a copy without one keeps the circuit\'s value', () => {
    const { graph } = expandBoard(tallyBoard());
    expect(byId(graph, 'a/count').params.target).toBe(9);
    expect(byId(graph, 'b/count').params.target).toBe(5);
  });

  it('ignores a value of the wrong shape and reports it at edit time', () => {
    const b = tallyBoard();
    b.graph.nodes[1] = copyOf('a', 'tally', undefined, { goal: 'nine' });
    expect(byId(expandBoard(b).graph, 'a/count').params.target).toBe(5);
    expect(validateCircuits(b)).toEqual([{ code: 'bad-value', node: 'a', exposed: 'goal' }]);
  });

  it('keeps the bench nodes when the circuit is run alone', () => {
    const { graph } = expandCircuitAlone(tallyBoard(), 'tally');
    expect(graph.nodes.map((n) => n.id)).toEqual(['count', 'try-key']);
    expect(wireKeys(graph)).toEqual(['w1: try-key.pressed > count.up']);
  });

  it('is pure and deterministic: the board is not changed and two runs give the same graph', () => {
    const b = tallyBoard();
    const before = JSON.stringify(b);
    const first = expandBoard(b).graph;
    expect(JSON.stringify(b)).toBe(before);
    expect(expandBoard(structuredClone(b)).graph).toEqual(first);
  });

  it('maps every flat id back to its copies and inner id, and the other way round', () => {
    const { idMap } = expandBoard(tallyBoard());
    expect(idMap.origins.get('a/count')).toEqual({ path: ['a'], inner: 'count' });
    expect(idMap.origins.get('key')).toEqual({ path: [], inner: 'key' });
    expect(idMap.expandedId(['b'], 'count')).toBe('b/count');
    expect(idMap.expandedId([], 'show')).toBe('show');
    expect(idMap.expandedId(['b'], 'try-key')).toBeUndefined();
    expect(idMap.expandedId(['nobody'], 'count')).toBeUndefined();
    expect(idMap.pinPort(['a'], 'count')).toEqual({ node: 'a/count', port: 'value' });
    expect(idMap.pinPort(['a'], 'tick')).toEqual({ node: 'a/count', port: 'up' });
    expect(idMap.pinPort(['a'], 'nope')).toBeUndefined();
  });

  it('a board without circuits runs its own graph object, untouched', () => {
    const b = sampleBoard('robot-square');
    expect(runnableGraph(b)).toBe(b.graph);
    expect(runnableGraph({ ...b, circuits: [] })).toBe(b.graph);
  });

  it('keeps the main board\'s own nodes, wires and settings as they are', () => {
    const b = tallyBoard();
    b.graph.settings = { realPhysics: true, wireRule: true };
    const { graph } = expandBoard(b);
    expect(byId(graph, 'key')).toBe(b.graph.nodes[0]);
    expect(graph.settings).toEqual({ realPhysics: true, wireRule: true });
  });
});

describe('copies inside copies', () => {
  /** L1 holds the counter; L2 holds a copy of L1 and passes its pins straight on; L3 holds a copy of L2 the same way. */
  const passOn = (id: string, innerCircuit: string): Circuit =>
    circuit(
      id,
      { nodes: [copyOf('in', innerCircuit)], wires: [] },
      {
        pins: [
          { id: 'tick', label: 'Nhịp', dir: 'in', type: 'bool', inner: { node: 'in', port: 'tick' } },
          { id: 'count', label: 'Số đếm', dir: 'out', type: 'number', inner: { node: 'in', port: 'count' } },
        ],
        exposed: [{ id: 'goal', label: 'Mục tiêu', inner: { node: 'in', param: 'value:goal' } }],
      },
    );
  const nested = (): Board =>
    board(
      {
        nodes: [node('key', 'key'), copyOf('top', 'L3', undefined, { goal: 3 }), node('show', 'show-number')],
        wires: [wire('w1', 'key.pressed', 'top.tick'), wire('w2', 'top.count', 'show.value')],
      },
      [tally(), passOn('L2', 'tally'), passOn('L3', 'L2')],
    );

  it('expands three levels deep; pins pass through every level; an exposed value travels all the way down', () => {
    const b = nested();
    expect(validateCircuits(b)).toEqual([]);
    const { graph, idMap } = expandBoard(b);
    expect(graph.nodes.map((n) => n.id)).toEqual(['key', 'top/in/in/count', 'show']);
    expect(wireKeys(graph)).toEqual(['w1: key.pressed > top/in/in/count.up', 'w2: top/in/in/count.value > show.value']);
    expect(byId(graph, 'top/in/in/count').params.target).toBe(3);
    expect(idMap.origins.get('top/in/in/count')).toEqual({ path: ['top', 'in', 'in'], inner: 'count' });
    expect(idMap.pinPort(['top'], 'count')).toEqual({ node: 'top/in/in/count', port: 'value' });
  });

  it('lists the ports of a copy from the pins of its circuit, in pin order', () => {
    const b = nested();
    const circuits = circuitLookup(b.circuits);
    const ports = instancePorts(circuits.get('L3')!, circuits);
    expect(ports.inputs).toEqual([{ id: 'tick', type: 'bool', label: 'Nhịp' }]);
    expect(ports.outputs).toEqual([{ id: 'count', type: 'number', label: 'Số đếm' }]);
    expect(readInstance(b.graph.nodes[1]!)).toEqual({ circuit: 'L3', values: { goal: 3 }, place: { position: { x: 0, y: 0, z: 0 }, heading: 0 } });
    expect(canConnectIn(b.graph, { node: 'key', port: 'held' }, { node: 'top', port: 'tick' }, circuits)).toEqual({ ok: false, reason: 'input-taken' });
    expect(canConnectIn(b.graph, { node: 'top', port: 'count' }, { node: 'top', port: 'tick' }, circuits)).toEqual({ ok: false, reason: 'same-node' });
    expect(canConnectIn(b.graph, { node: 'top', port: 'tick' }, { node: 'show', port: 'value' }, circuits)).toEqual({ ok: false, reason: 'wrong-direction' });
    expect(canConnectIn({ ...b.graph, wires: [] }, { node: 'top', port: 'count' }, { node: 'show', port: 'value' }, circuits)).toEqual({ ok: true });
    const withGate = { nodes: [...b.graph.nodes, node('gate', 'or')], wires: [] };
    expect(canConnectIn(withGate, { node: 'top', port: 'count' }, { node: 'gate', port: 'a' }, circuits)).toEqual({ ok: false, reason: 'type-mismatch' });
    expect(canConnectIn(withGate, { node: 'gate', port: 'out' }, { node: 'top', port: 'nope' }, circuits)).toEqual({ ok: false, reason: 'unknown-port' });
  });

  it('rejects a circuit that contains itself, directly or through another one', () => {
    const self = board({ nodes: [copyOf('a', 'loop')], wires: [] }, [circuit('loop', { nodes: [copyOf('again', 'loop')], wires: [] })]);
    expect(codeOf(() => expandBoard(self))).toBe('cycle');
    expect(validateCircuits(self)).toEqual([{ code: 'cycle', circuit: 'loop', chain: ['loop', 'loop'] }]);

    const viaOther = board({ nodes: [copyOf('a', 'x')], wires: [] }, [
      circuit('x', { nodes: [copyOf('y1', 'y')], wires: [] }),
      circuit('y', { nodes: [copyOf('x1', 'x')], wires: [] }),
    ]);
    expect(codeOf(() => expandBoard(viaOther))).toBe('cycle');
    expect(codeOf(() => expandCircuitAlone(viaOther, 'y'))).toBe('cycle');
    expect(validateCircuits(viaOther)).toEqual([{ code: 'cycle', circuit: 'x', chain: ['x', 'y', 'x'] }]);
  });

  it(`allows ${MAX_CIRCUIT_DEPTH} levels of nesting and rejects one more`, () => {
    const chain = (levels: number): Board => {
      const circuits = [circuit('c1', { nodes: [node('n', 'const')], wires: [] })];
      for (let i = 2; i <= levels; i++) circuits.push(circuit(`c${i}`, { nodes: [copyOf('in', `c${i - 1}`)], wires: [] }));
      return board({ nodes: [copyOf('top', `c${levels}`)], wires: [] }, circuits);
    };
    const ok = chain(MAX_CIRCUIT_DEPTH);
    expect(validateCircuits(ok)).toEqual([]);
    expect(expandBoard(ok).graph.nodes.map((n) => n.id)).toEqual(['top/in/in/in/n']);

    const deep = chain(MAX_CIRCUIT_DEPTH + 1);
    expect(codeOf(() => expandBoard(deep))).toBe('too-deep');
    expect(validateCircuits(deep)).toEqual([{ code: 'too-deep', circuit: 'c5', chain: ['c5', 'c4', 'c3', 'c2', 'c1'] }]);
  });

  it('rejects a copy of a circuit the board does not have, and two nodes that would share an id', () => {
    const missing = board({ nodes: [copyOf('a', 'ghost')], wires: [] }, [tally()]);
    expect(codeOf(() => expandBoard(missing))).toBe('unknown-circuit');
    expect(validateCircuits(missing)).toEqual([{ code: 'unknown-circuit', node: 'a', wanted: 'ghost' }]);

    const clash = board({ nodes: [copyOf('a', 'tally'), node('a/count', 'const')], wires: [] }, [tally()]);
    expect(codeOf(() => expandBoard(clash))).toBe('duplicate-id');
  });
});

describe('what validateCircuits reports inside a circuit', () => {
  const withTally = (patch: (c: Circuit) => void): Board => {
    const c = tally();
    patch(c);
    return board({ nodes: [], wires: [] }, [c]);
  };

  it('a pin on a missing node or port, of the wrong direction or type, on a bench node, or with a repeated id', () => {
    const bad = (patch: (c: Circuit) => void) => validateCircuits(withTally(patch)).map((i) => `${i.code}:${'pin' in i ? i.pin : ''}`);
    expect(bad((c) => (c.pins[0]!.inner.node = 'ghost'))).toEqual(['bad-pin:tick']);
    expect(bad((c) => (c.pins[0]!.inner.port = 'ghost'))).toEqual(['bad-pin:tick']);
    expect(bad((c) => (c.pins[0]!.inner.port = 'value'))).toEqual(['bad-pin:tick']);
    expect(bad((c) => (c.pins[1]!.type = 'bool'))).toEqual(['bad-pin:count']);
    expect(bad((c) => (c.pins[1]!.inner = { node: 'try-key', port: 'held' }))).toEqual(['bad-pin:count']);
    expect(bad((c) => (c.pins[2]!.id = 'count'))).toEqual(['bad-pin:count']);
    expect(bad((c) => c.pins.push({ ...c.pins[0]!, id: 'tick2' }))).toEqual(['bad-pin:tick2']);
  });

  it('an in pin whose inner port already gets a wire from a card that is part of every copy', () => {
    const b = withTally((c) => (c.benchIds = []));
    expect(validateCircuits(b)).toEqual([{ code: 'pin-input-wired', circuit: 'tally', pin: 'tick' }]);
    // If it is used anyway, the wire drawn outside is the one that counts.
    b.graph = { nodes: [node('key', 'key'), copyOf('a', 'tally')], wires: [wire('w1', 'key.pressed', 'a.tick')] };
    expect(wireKeys(expandBoard(b).graph)).toEqual(['w1: key.pressed > a/count.up']);
  });

  it('an exposed setting that leads nowhere, and a bench id that is not a node', () => {
    expect(validateCircuits(withTally((c) => (c.exposed[0]!.inner.param = 'ghost')))).toEqual([{ code: 'bad-exposed', circuit: 'tally', exposed: 'goal' }]);
    expect(validateCircuits(withTally((c) => c.benchIds.push('ghost')))).toEqual([{ code: 'bad-bench', circuit: 'tally', node: 'ghost' }]);
    expect(validateCircuits(withTally(() => {}))).toEqual([]);
  });
});

describe('wires land on the real inner ports', () => {
  it('a loop closed through a pin onto a feedback input is cut at that input, as on a flat board', () => {
    // "Xong bước 1" of a sequence is a feedback input. Without that mark the loop would be cut at the card with the smallest id ("gate").
    const flat: Graph = {
      nodes: [node('m/seq', 'sequence'), node('gate', 'or')],
      wires: [wire('w1', 'gate.out', 'm/seq.done1'), wire('w2', 'm/seq.step1', 'gate.a')],
    };
    const seq = circuit(
      'seq',
      { nodes: [node('seq', 'sequence')], wires: [] },
      {
        pins: [
          { id: 'go', label: 'Tiếp', dir: 'in', type: 'bool', inner: { node: 'seq', port: 'done1' } },
          { id: 'one', label: 'Bước 1', dir: 'out', type: 'bool', inner: { node: 'seq', port: 'step1' } },
        ],
      },
    );
    const b = board({ nodes: [copyOf('m', 'seq'), node('gate', 'or')], wires: [wire('w1', 'gate.out', 'm.go'), wire('w2', 'm.one', 'gate.a')] }, [seq]);
    expect(validateCircuits(b)).toEqual([]);
    const expanded = expandBoard(b).graph;
    expect(wireKeys(expanded)).toEqual(wireKeys(flat));
    const compiled = compileGraph(expanded);
    expect([...compiled.backEdges]).toEqual(['w1']);
    expect(compiled).toEqual(compileGraph(flat));
    const circuits = circuitLookup(b.circuits);
    expect(instancePorts(seq, circuits).inputs[0]!.feedback).toBe(true);
  });
});
