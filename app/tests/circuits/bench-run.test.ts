import { beforeAll, describe, expect, it } from 'vitest';
import { benchKey, benchPlan } from '../../src/circuits/bench';
import { expandBoard, expandCircuitAlone } from '../../src/circuits/expand';
import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { createRuntime } from '../../src/engine/runtime';
import type { Board, CircuitPin, InputSnapshot } from '../../src/engine/types';
import { serializeBoard } from '../../src/io/save-format';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';
import { circuit, copyOf, node, wire } from './circuit-helpers';

beforeAll(() => registerAllNodes());

const pin = (id: string, dir: 'in' | 'out', type: CircuitPin['type'], inner: string): CircuitPin => {
  const [n, p] = inner === '' ? ['', ''] : (inner.split('.') as [string, string]);
  return { id, label: id, dir, type, inner: { node: n, port: p } };
};

/**
 * A small machine: "Đảo ngược" fed by pin `on`, "So sánh (>)" fed by pin `a` and, on its B side, by pin `b`; a bench-only
 * "Số cố định" (5) is wired to B so the circuit can be tried alone. Pin `body` carries an object, pin `loose` is not wired.
 */
function machineBoard(): Board {
  const machine = circuit(
    'machine',
    {
      nodes: [node('inv', 'not'), node('cmp', 'compare', { op: 'gt' }), node('five', 'const', { value: 5 }), node('wheel', 'motor')],
      wires: [wire('w1', 'five.value', 'cmp.b')],
    },
    {
      pins: [
        pin('on', 'in', 'bool', 'inv.in'),
        pin('a', 'in', 'number', 'cmp.a'),
        pin('b', 'in', 'number', 'cmp.b'),
        pin('body', 'in', 'object', 'wheel.body'),
        pin('loose', 'in', 'bool', ''),
        pin('off', 'out', 'bool', 'inv.out'),
        pin('bigger', 'out', 'bool', 'cmp.out'),
      ],
      benchIds: ['five'],
    },
  );
  return { name: 'bench', mode: '3d', graph: { nodes: [copyOf('k', 'machine')], wires: [] }, circuits: [machine] };
}

const keys = (...down: string[]): InputSnapshot => ({ keysDown: new Set(down) });

describe('one circuit on the test bench', () => {
  it('has no blocking problem, and its bench card is allowed to feed a pinned input', () => {
    expect(validateCircuits(machineBoard()).map((i) => i.code)).toEqual(['pin-unwired']);
  });

  it('gives every pin of the circuit its real port, and none for a pin that leads nowhere', () => {
    const alone = expandCircuitAlone(machineBoard(), 'machine');
    expect(alone.idMap.pinPort([], 'on')).toEqual({ node: 'inv', port: 'in' });
    expect(alone.idMap.pinPort([], 'bigger')).toEqual({ node: 'cmp', port: 'out' });
    expect(alone.idMap.pinPort([], 'loose')).toBeUndefined();
    const whole = expandBoard(machineBoard());
    expect(whole.idMap.pinPort(['k'], 'on')).toEqual({ node: 'k/inv', port: 'in' });
    expect(whole.idMap.pinPort(['k'], 'loose')).toBeUndefined();
  });

  it('feeds a Đúng/Sai pin from a key card and a Số pin from a number card, and leaves the rest alone', () => {
    const plan = benchPlan(machineBoard(), 'machine');
    const drive = Object.fromEntries(plan.inputs.map((i) => [i.pin.id, i.drive]));
    expect(drive.on).toEqual({ by: 'switch', node: benchKey('on') });
    expect(drive.a).toEqual({ by: 'number', node: benchKey('a'), value: 0 });
    expect(drive.b).toEqual({ by: 'card', from: { node: 'five', port: 'value' } });
    expect(drive.body).toEqual({ by: 'nothing', why: 'object' });
    expect(drive.loose).toEqual({ by: 'nothing', why: 'unwired' });
    expect(plan.outputs.map((o) => [o.pin.id, o.port])).toEqual([
      ['off', { node: 'inv', port: 'out' }],
      ['bigger', { node: 'cmp', port: 'out' }],
    ]);
    // Only general pieces were added, and exactly one per hand-driven pin.
    const added = plan.graph.nodes.filter((n) => n.id.startsWith('@bench:'));
    expect(added.map((n) => n.kind).sort()).toEqual(['const', 'key']);
    expect(plan.graph.nodes.some((n) => n.id === 'five')).toBe(true);
  });

  it('runs alone: the switch and the number typed by hand reach the cards, and the out pins read back', () => {
    const board = machineBoard();
    const plan = benchPlan(board, 'machine', new Map([['a', 2]]));
    const world = createWorld(board.mode);
    const rt = createRuntime(plan.graph, world, board.mode);
    const out = (id: string): unknown => {
      const port = plan.outputs.find((o) => o.pin.id === id)!.port!;
      return rt.getOutput(port.node, port.port);
    };
    rt.tick(keys());
    expect(out('off')).toBe(true);
    expect(out('bigger')).toBe(false); // 2 > 5
    rt.tick(keys(benchKey('on')));
    expect(out('off')).toBe(false);
    // The number pin changes while the run goes on.
    expect(rt.applyNodeParams(benchKey('a'), { value: 9 })).toBe(true);
    rt.tick(keys(benchKey('on')));
    expect(out('bigger')).toBe(true);
    rt.tick(keys());
    expect(out('off')).toBe(true);
    world.dispose?.();
  });

  it('never puts a bench card or a bench source into the real board', () => {
    const board = machineBoard();
    const flat = runnableGraph(board);
    expect(flat.nodes.map((n) => n.id).sort()).toEqual(['k/cmp', 'k/inv', 'k/wheel']);
    expect(flat.wires).toEqual([]);
    const before = serializeBoard(board);
    benchPlan(board, 'machine', new Map([['a', 7]]));
    expect(serializeBoard(board)).toBe(before);
    expect(before).not.toContain('@bench:');
  });
});
