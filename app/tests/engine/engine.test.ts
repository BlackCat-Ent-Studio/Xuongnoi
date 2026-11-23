import { beforeEach, describe, expect, it } from 'vitest';
import { compileGraph } from '../../src/engine/compile';
import { clearRegistry, registerNode } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { CONNECT_FAIL_TEXT } from '../../src/engine/text-vi';
import {
  TICK_DT,
  type ConnectFailReason,
  type Graph,
  type GraphNode,
  type InputSnapshot,
  type WorldApi,
} from '../../src/engine/types';
import { addWire, canConnect, removeNode, removeWire } from '../../src/engine/wiring';

const world = { mode: '2d-side', ended: null } as unknown as WorldApi;
const noKeys: InputSnapshot = { keysDown: new Set() };

let log: string[] = [];

beforeEach(() => {
  clearRegistry();
  log = [];
  registerNode({
    kind: 'const',
    label: 'Hằng',
    category: 'math',
    description: '',
    inputs: [],
    outputs: [{ id: 'out', type: 'number', label: 'ra' }],
    params: [{ id: 'value', label: 'Giá trị', kind: 'number', default: 7 }],
    evaluate: (_c, _i, params) => ({ out: params.value as number }),
  });
  registerNode({
    kind: 'inc',
    label: 'Cộng 1',
    category: 'math',
    description: '',
    inputs: [{ id: 'in', type: 'number', label: 'vào', default: 5 }],
    outputs: [{ id: 'out', type: 'number', label: 'ra' }],
    params: [],
    evaluate: (ctx, inputs) => {
      log.push(`${ctx.nodeId}@${ctx.tick}`);
      return { out: (inputs.in as number) + 1 };
    },
  });
  registerNode({
    kind: 'flag',
    label: 'Cờ',
    category: 'logic',
    description: '',
    inputs: [{ id: 'in', type: 'bool', label: 'vào' }],
    outputs: [{ id: 'out', type: 'bool', label: 'ra' }],
    params: [],
    evaluate: (_c, inputs) => ({ out: inputs.in as boolean }),
  });
  registerNode({
    kind: 'lazy',
    label: 'Lười',
    category: 'logic',
    description: '',
    inputs: [{ id: 'in', type: 'object', label: 'vào' }],
    outputs: [{ id: 'out', type: 'number', label: 'ra' }],
    params: [],
    evaluate: () => ({}),
  });
  registerNode({
    kind: 'spawn',
    label: 'Sinh',
    category: 'object',
    description: '',
    inputs: [],
    outputs: [{ id: 'n', type: 'number', label: 'đếm' }],
    params: [],
    create: (ctx) => {
      log.push(`create@${ctx.tick}`);
      return { count: 0 };
    },
    evaluate: (_c, _i, _p, state: { count: number }) => ({ n: ++state.count }),
  });
});

const node = (id: string, kind: string, params: GraphNode['params'] = {}): GraphNode => ({
  id,
  kind,
  params,
  pos: { x: 0, y: 0 },
});
const wire = (id: string, fn: string, fp: string, tn: string, tp: string) => ({
  id,
  from: { node: fn, port: fp },
  to: { node: tn, port: tp },
});
const g = (nodes: GraphNode[], wires: Graph['wires'] = []): Graph => ({ nodes, wires });

describe('canConnect', () => {
  const graph = g([node('a', 'const'), node('b', 'inc'), node('c', 'inc'), node('f', 'flag')], [
    wire('w1', 'a', 'out', 'b', 'in'),
  ]);
  const reason = (r: ReturnType<typeof canConnect>) => (r.ok ? 'ok' : r.reason);

  it('accepts a valid connection', () => {
    expect(canConnect(graph, { node: 'a', port: 'out' }, { node: 'c', port: 'in' })).toEqual({ ok: true });
  });
  it('unknown-node', () => {
    expect(reason(canConnect(graph, { node: 'zz', port: 'out' }, { node: 'c', port: 'in' }))).toBe('unknown-node');
    expect(reason(canConnect(graph, { node: 'a', port: 'out' }, { node: 'zz', port: 'in' }))).toBe('unknown-node');
  });
  it('unknown-port', () => {
    expect(reason(canConnect(graph, { node: 'a', port: 'nope' }, { node: 'c', port: 'in' }))).toBe('unknown-port');
    expect(reason(canConnect(graph, { node: 'a', port: 'out' }, { node: 'c', port: 'nope' }))).toBe('unknown-port');
  });
  it('wrong-direction', () => {
    expect(reason(canConnect(graph, { node: 'c', port: 'in' }, { node: 'a', port: 'out' }))).toBe('wrong-direction');
    expect(reason(canConnect(graph, { node: 'a', port: 'out' }, { node: 'c', port: 'out' }))).toBe('wrong-direction');
  });
  it('same-node', () => {
    expect(reason(canConnect(graph, { node: 'b', port: 'out' }, { node: 'b', port: 'in' }))).toBe('same-node');
  });
  it('type-mismatch', () => {
    expect(reason(canConnect(graph, { node: 'a', port: 'out' }, { node: 'f', port: 'in' }))).toBe('type-mismatch');
  });
  it('input-taken', () => {
    expect(reason(canConnect(graph, { node: 'c', port: 'out' }, { node: 'b', port: 'in' }))).toBe('input-taken');
  });
  it('every reason has Vietnamese text', () => {
    const reasons: ConnectFailReason[] = [
      'unknown-node', 'unknown-port', 'type-mismatch', 'input-taken', 'same-node', 'wrong-direction',
    ];
    for (const r of reasons) expect(CONNECT_FAIL_TEXT[r].length).toBeGreaterThan(0);
  });
});

describe('graph helpers', () => {
  const base = g([node('a', 'const'), node('b', 'inc')]);
  it('addWire is immutable and returns failures', () => {
    const next = addWire(base, { node: 'a', port: 'out' }, { node: 'b', port: 'in' }, 'x');
    expect('wires' in next && next.wires).toEqual([wire('x', 'a', 'out', 'b', 'in')]);
    expect(base.wires).toHaveLength(0);
    const bad = addWire(base, { node: 'b', port: 'in' }, { node: 'a', port: 'out' });
    expect(bad).toEqual({ ok: false, reason: 'wrong-direction' });
  });
  it('addWire generates unique ids', () => {
    const g1 = addWire(base, { node: 'a', port: 'out' }, { node: 'b', port: 'in' }) as Graph;
    expect(g1.wires[0]?.id).toBeTruthy();
  });
  it('removeWire / removeNode', () => {
    const withWire = g(base.nodes, [wire('x', 'a', 'out', 'b', 'in')]);
    expect(removeWire(withWire, 'x').wires).toHaveLength(0);
    expect(withWire.wires).toHaveLength(1);
    const r = removeNode(withWire, 'a');
    expect(r.nodes.map((n) => n.id)).toEqual(['b']);
    expect(r.wires).toHaveLength(0);
  });
});

describe('compileGraph', () => {
  it('orders by dependency, ties by id', () => {
    const graph = g(
      [node('c', 'inc'), node('b', 'inc'), node('a', 'const'), node('d', 'inc')],
      [wire('w1', 'a', 'out', 'c', 'in'), wire('w2', 'c', 'out', 'b', 'in')],
    );
    const { order, backEdges } = compileGraph(graph);
    expect(order).toEqual(['a', 'c', 'b', 'd']);
    expect(backEdges.size).toBe(0);
  });
  it('marks a back-edge in a cycle deterministically', () => {
    const graph = g(
      [node('b', 'inc'), node('a', 'inc')],
      [wire('w1', 'a', 'out', 'b', 'in'), wire('w2', 'b', 'out', 'a', 'in')],
    );
    const { order, backEdges } = compileGraph(graph);
    expect(order).toEqual(['a', 'b']);
    expect([...backEdges]).toEqual(['w2']);
  });
});

describe('runtime', () => {
  it('throws on unknown kind', () => {
    expect(() => createRuntime(g([node('a', 'ghost')]), world, '3d')).toThrow(/ghost/);
  });

  it('propagates values in topo order within one tick', () => {
    const graph = g(
      [node('a', 'const', { value: 10 }), node('b', 'inc'), node('c', 'inc')],
      [wire('w1', 'a', 'out', 'b', 'in'), wire('w2', 'b', 'out', 'c', 'in')],
    );
    const rt = createRuntime(graph, world, '2d-top');
    rt.tick(noKeys);
    expect(rt.getOutput('c', 'out')).toBe(12);
    expect(rt.getWireValue(graph.wires[1]!)).toBe(11);
    expect(rt.tickIndex).toBe(1);
  });

  it('uses defaults for unwired inputs and missing outputs', () => {
    const graph = g([node('b', 'inc'), node('f', 'flag'), node('l', 'lazy')]);
    const rt = createRuntime(graph, world, '3d');
    expect(rt.getOutput('b', 'out')).toBe(0); // before first tick
    rt.tick(noKeys);
    expect(rt.getOutput('b', 'out')).toBe(6); // port default 5 + 1
    expect(rt.getOutput('f', 'out')).toBe(false); // PORT_DEFAULTS bool
    expect(rt.getOutput('l', 'out')).toBe(0); // evaluate returned nothing
  });

  it('merges param defaults with graph params', () => {
    const rt = createRuntime(g([node('a', 'const'), node('b', 'const', { value: 3 })]), world, '3d');
    rt.tick(noKeys);
    expect(rt.getOutput('a', 'out')).toBe(7);
    expect(rt.getOutput('b', 'out')).toBe(3);
  });

  it('passes ctx fields to evaluate', () => {
    let seen: unknown;
    registerNode({
      kind: 'probe',
      label: 'p',
      category: 'logic',
      description: '',
      inputs: [],
      outputs: [],
      params: [],
      evaluate: (ctx) => {
        seen = ctx;
        return {};
      },
    });
    const rt = createRuntime(g([node('p1', 'probe')]), world, '2d-side');
    rt.tick(noKeys);
    rt.tick(noKeys);
    expect(seen).toMatchObject({ dt: TICK_DT, tick: 1, mode: '2d-side', nodeId: 'p1', world });
  });

  it('calls create once, before tick 0', () => {
    const rt = createRuntime(g([node('s', 'spawn')]), world, '3d');
    expect(log).toEqual(['create@0']);
    rt.tick(noKeys);
    rt.tick(noKeys);
    expect(log).toEqual(['create@0']);
    expect(rt.getOutput('s', 'n')).toBe(2);
  });

  const cycle = () =>
    g(
      [node('a', 'inc'), node('b', 'inc')],
      [wire('w1', 'a', 'out', 'b', 'in'), wire('w2', 'b', 'out', 'a', 'in')],
    );

  it('cycle reads previous tick for the back-edge', () => {
    const rt = createRuntime(cycle(), world, '3d');
    rt.tick(noKeys); // a = 0+1 (prev b default), b = a+1
    expect([rt.getOutput('a', 'out'), rt.getOutput('b', 'out')]).toEqual([1, 2]);
    rt.tick(noKeys); // a = prev b(2)+1
    expect([rt.getOutput('a', 'out'), rt.getOutput('b', 'out')]).toEqual([3, 4]);
  });

  it('10k ticks on a cycle finish', () => {
    const rt = createRuntime(cycle(), world, '3d');
    for (let i = 0; i < 10_000; i++) rt.tick(noKeys);
    expect(rt.tickIndex).toBe(10_000);
    expect(rt.getOutput('b', 'out')).toBe(20_000);
  });

  it('is deterministic across runtimes', () => {
    const graph = g(
      [node('a', 'inc'), node('b', 'inc'), node('k', 'const', { value: 2 }), node('s', 'spawn')],
      [wire('w1', 'a', 'out', 'b', 'in'), wire('w2', 'b', 'out', 'a', 'in')],
    );
    const r1 = createRuntime(graph, world, '3d');
    const r2 = createRuntime(graph, world, '3d');
    for (let i = 0; i < 600; i++) {
      const input: InputSnapshot = { keysDown: new Set(i % 2 ? ['KeyW'] : []) };
      r1.tick(input);
      r2.tick(input);
      for (const [n, p] of [['a', 'out'], ['b', 'out'], ['k', 'out'], ['s', 'n']] as const) {
        expect(r1.getOutput(n, p)).toBe(r2.getOutput(n, p));
      }
    }
  });
});
