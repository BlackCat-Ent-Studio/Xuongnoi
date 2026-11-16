import { beforeAll, describe, expect, it } from 'vitest';
import { computeIssues } from '../../src/editor/console/issues';
import { createEditorState } from '../../src/editor/editor-state';
import type { Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';

const emptyBoard = (): Board => ({ name: 't', mode: '2d-side', graph: { nodes: [], wires: [] } });

beforeAll(() => registerAllNodes());

describe('param edits while playing', () => {
  it('lets numbers and colours change but keeps structure locked', () => {
    const s = createEditorState(emptyBoard());
    const c = s.addNode('character', { x: 0, y: 0 })!;
    s.setPlaying(true);
    s.setParam(c, 'speed', 9);
    s.setParam(c, 'color', '#ff0000');
    const params = s.getGraph().nodes[0]!.params;
    expect(params.speed).toBe(9);
    expect(params.color).toBe('#ff0000');
    // structure stays blocked
    expect(s.addNode('key', { x: 0, y: 0 })).toBeNull();
    expect(s.deleteSelection()).toBe(false);
    expect(s.paste()).toBe(0);
    s.setPlaying(false);
    // edits are kept after stopping and are part of the document
    expect(s.getGraph().nodes[0]!.params.speed).toBe(9);
  });

  it('ignores non-live params and unknown ids during play', () => {
    const s = createEditorState(emptyBoard());
    const c = s.addNode('character', { x: 0, y: 0 })!;
    s.setPlaying(true);
    s.setParam(c, 'nope', 1);
    s.setParam('missing', 'speed', 1);
    expect(s.getGraph().nodes[0]!.params.speed).toBe(5);
  });
});

describe('single undo steps', () => {
  it('replacing an occupied input is one step', () => {
    const s = createEditorState(emptyBoard());
    const k = s.addNode('key', { x: 0, y: 0 })!;
    const c = s.addNode('character', { x: 0, y: 0 })!;
    s.connect({ node: k, port: 'held' }, { node: c, port: 'jump' });
    const before = s.getGraph();
    expect(s.connect({ node: k, port: 'pressed' }, { node: c, port: 'jump' }, { replace: true }).ok).toBe(true);
    expect(s.getGraph().wires).toHaveLength(1);
    expect(s.getGraph().wires[0]!.from.port).toBe('pressed');
    s.undo();
    expect(s.getGraph()).toEqual(before);
  });

  it('a failed replace changes nothing', () => {
    const s = createEditorState(emptyBoard());
    const k = s.addNode('key', { x: 0, y: 0 })!;
    const c = s.addNode('character', { x: 0, y: 0 })!;
    s.connect({ node: k, port: 'held' }, { node: c, port: 'jump' });
    const res = s.connect({ node: k, port: 'held' }, { node: c, port: 'moveX' }, { replace: true });
    expect(res.ok).toBe(false);
    expect(s.getGraph().wires).toHaveLength(1);
  });

  it('an amended move after add does not add an undo step', () => {
    const s = createEditorState(emptyBoard());
    const id = s.addNode('key', { x: 0, y: 0 })!;
    s.moveItems([{ id, pos: { x: 200, y: 120 } }], { amend: true });
    expect(s.getGraph().nodes[0]!.pos).toEqual({ x: 200, y: 120 });
    expect(s.undo()).toBe(true);
    expect(s.getGraph().nodes).toHaveLength(0);
    expect(s.canUndo()).toBe(false);
  });
});

describe('computeIssues', () => {
  it('is empty for an empty board', () => {
    expect(computeIssues(emptyBoard().graph, '2d-side')).toEqual([]);
  });

  it('flags a missing Nhân vật once the board has other nodes', () => {
    const s = createEditorState(emptyBoard());
    s.addNode('key', { x: 0, y: 0 });
    const issues = computeIssues(s.getGraph(), '2d-side');
    expect(issues.map((i) => i.key)).toContain('no-character');
    s.addNode('character', { x: 0, y: 0 });
    expect(computeIssues(s.getGraph(), '2d-side').map((i) => i.key)).not.toContain('no-character');
  });

  it('does not ask for a Nhân vật when a robot chassis is the thing to play', () => {
    const s = createEditorState(emptyBoard());
    s.addNode('key', { x: 0, y: 0 });
    expect(computeIssues(s.getGraph(), '2d-top').map((i) => i.key)).toContain('no-character');
    s.addNode('robot-body', { x: 0, y: 0 });
    expect(computeIssues(s.getGraph(), '2d-top').map((i) => i.key)).not.toContain('no-character');
  });

  it('lists unconnected required inputs with their node id', () => {
    const s = createEditorState(emptyBoard());
    s.addNode('character', { x: 0, y: 0 });
    const carry = s.addNode('carry', { x: 0, y: 0 })!;
    const issues = computeIssues(s.getGraph(), '2d-side');
    const mine = issues.filter((i) => i.nodeId === carry);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine[0]!.text).toContain('chưa nối');
  });
});
