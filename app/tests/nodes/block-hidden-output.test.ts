import { beforeAll, describe, expect, it } from 'vitest';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { activeOutputs, getNodeDef, knownOutputs } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type GraphNode, type Params } from '../../src/engine/types';
import { canConnect } from '../../src/engine/wiring';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const BLOCK = { position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } };

/** A block with two keys: H = "Ẩn đi", S = "Hiện lại"; a probe block reads the block's "Đang ẩn" into its own "Ẩn suốt lúc bật". */
function setup(blockParams: Params) {
  const graph: Graph = {
    nodes: [
      { id: 'b', kind: 'block', params: { ...BLOCK, ...blockParams }, pos: { x: 0, y: 0 } },
      { id: 'probe', kind: 'block', params: { ...BLOCK, position: { x: 5, y: 0.5, z: 0 } }, pos: { x: 0, y: 0 } },
      { id: 'h', kind: 'key', params: { key: 'KeyH' }, pos: { x: 0, y: 0 } },
      { id: 's', kind: 'key', params: { key: 'KeyS' }, pos: { x: 0, y: 0 } },
    ],
    wires: [
      { id: 'w1', from: { node: 'h', port: 'held' }, to: { node: 'b', port: 'hide' } },
      { id: 'w2', from: { node: 's', port: 'held' }, to: { node: 'b', port: 'show' } },
      { id: 'w3', from: { node: 'b', port: 'hidden' }, to: { node: 'probe', port: 'hiddenWhile' } },
    ],
  };
  const world = createWorld('3d');
  const rt = createRuntime(graph, world, '3d');
  const probe = () => world.entities().find((e) => e.ownerNodeId === 'probe')!;
  const step = (keys: string[] = []) => {
    rt.tick({ keysDown: new Set(keys) });
    world.step(TICK_DT);
  };
  return { rt, probe, step, graph };
}

describe('block: optional output "Đang ẩn"', () => {
  it('is false at the start, true after "Ẩn đi" and false again after "Hiện lại"', () => {
    const s = setup({ showHiddenOut: 'yes' });
    s.step();
    expect(s.rt.getOutput('b', 'hidden')).toBe(false);
    s.step(['KeyH']);
    s.step();
    expect(s.rt.getOutput('b', 'hidden')).toBe(true);
    s.step();
    expect(s.rt.getOutput('b', 'hidden')).toBe(true);
    s.step(['KeyS']);
    s.step();
    expect(s.rt.getOutput('b', 'hidden')).toBe(false);
  });

  it('drives another block: the probe hides while the first block is hidden', () => {
    const s = setup({ showHiddenOut: 'yes' });
    s.step();
    expect(s.probe().visible).toBe(true);
    s.step(['KeyH']);
    s.step();
    expect(s.probe().visible).toBe(false);
  });

  it('also reports a block hidden by "Ẩn suốt lúc bật"', () => {
    const graph: Graph = {
      nodes: [
        { id: 'b', kind: 'block', params: { ...BLOCK, showHiddenOut: 'yes' }, pos: { x: 0, y: 0 } },
        { id: 'k', kind: 'key', params: { key: 'KeyH' }, pos: { x: 0, y: 0 } },
      ],
      wires: [{ id: 'w', from: { node: 'k', port: 'held' }, to: { node: 'b', port: 'hiddenWhile' } }],
    };
    const world = createWorld('3d');
    const rt = createRuntime(graph, world, '3d');
    rt.tick({ keysDown: new Set(['KeyH']) });
    expect(rt.getOutput('b', 'hidden')).toBe(true);
    rt.tick({ keysDown: new Set() });
    expect(rt.getOutput('b', 'hidden')).toBe(false);
  });

  it('with the setting off the card, its size and its ports are the old ones; wires may still name the port', () => {
    const def = getNodeDef('block')!;
    const off: GraphNode = { id: 'x', kind: 'block', params: {}, pos: { x: 0, y: 0 } };
    const on: GraphNode = { id: 'y', kind: 'block', params: { showHiddenOut: 'yes' }, pos: { x: 0, y: 0 } };
    expect(activeOutputs(def, off.params).map((p) => p.id)).toEqual(['self', 'usedOn']);
    expect(activeOutputs(def, on.params).map((p) => p.id)).toEqual(['self', 'usedOn', 'hidden']);
    expect(knownOutputs(def).map((p) => p.id)).toEqual(['self', 'usedOn', 'hidden']);
    expect(estimateNodeSize(on).h - estimateNodeSize(off).h).toBe(26);
    const g: Graph = { nodes: [off, { id: 'z', kind: 'block', params: {}, pos: { x: 0, y: 0 } }], wires: [] };
    expect(canConnect(g, { node: 'x', port: 'hidden' }, { node: 'z', port: 'hiddenWhile' })).toEqual({ ok: true });
  });

  it('a board saved with the output on survives a save and load', () => {
    const s = setup({ showHiddenOut: 'yes' });
    const parsed = parseBoard(serializeBoard({ name: 't', mode: '3d', graph: s.graph }));
    if (!parsed.ok) throw new Error('board did not load');
    const back = parsed.board.graph;
    expect(back.wires.some((w) => w.from.port === 'hidden')).toBe(true);
    expect(back.nodes.find((n) => n.id === 'b')?.params.showHiddenOut).toBe('yes');
  });
});
