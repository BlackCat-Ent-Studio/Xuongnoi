import { beforeAll, describe, expect, it } from 'vitest';
import { positionOnPlane } from '../../src/editor/entity-drag';
import {
  countUnavailable,
  createEditorState,
  nextNodeId,
  readPosition,
  snapHalf,
} from '../../src/editor/editor-state';
import { formatWireValue, keyLabel } from '../../src/editor/text-vi';
import type { Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';

const emptyBoard = (): Board => ({ name: 't', mode: '2d-side', graph: { nodes: [], wires: [] } });

beforeAll(() => registerAllNodes());

describe('editor state', () => {
  it('snaps to 0.5', () => {
    expect(snapHalf(1.26)).toBe(1.5);
    expect(snapHalf(-0.2)).toBe(-0);
    expect(snapHalf(2.74)).toBe(2.5);
  });

  it('adds nodes with unique ids and default params', () => {
    const s = createEditorState(emptyBoard());
    const a = s.addNode('character', { x: 10.4, y: 20 });
    const b = s.addNode('key', { x: 0, y: 0 });
    expect(a).not.toBe(b);
    expect(s.getGraph().nodes).toHaveLength(2);
    expect(s.getGraph().nodes[0]?.params.speed).toBe(5);
    expect(s.getSelection()).toEqual({ kind: 'node', id: b });
    expect(s.addNode('nope', { x: 0, y: 0 })).toBeNull();
  });

  it('does not reuse ids after deletion of a middle node', () => {
    const s = createEditorState(emptyBoard());
    s.addNode('key', { x: 0, y: 0 });
    const second = s.addNode('key', { x: 0, y: 0 });
    s.select({ kind: 'node', id: 'n1' });
    s.deleteSelection();
    expect(nextNodeId(s.getGraph())).toBe('n3');
    expect(second).toBe('n2');
  });

  it('connects and rejects with a reason, delete removes wires', () => {
    const s = createEditorState(emptyBoard());
    const k = s.addNode('key', { x: 0, y: 0 })!;
    const c = s.addNode('character', { x: 0, y: 0 })!;
    expect(s.connect({ node: k, port: 'held' }, { node: c, port: 'jump' }).ok).toBe(true);
    const dup = s.connect({ node: k, port: 'pressed' }, { node: c, port: 'jump' });
    expect(dup).toEqual({ ok: false, reason: 'input-taken' });
    const bad = s.connect({ node: k, port: 'held' }, { node: c, port: 'moveX' });
    expect(bad).toEqual({ ok: false, reason: 'type-mismatch' });
    s.select({ kind: 'node', id: k });
    s.deleteSelection();
    expect(s.getGraph().wires).toHaveLength(0);
  });

  it('blocks edits while playing and notifies subscribers', () => {
    const s = createEditorState(emptyBoard());
    const seen: string[] = [];
    s.subscribe((k) => seen.push(k));
    s.setPlaying(true);
    expect(s.addNode('key', { x: 0, y: 0 })).toBeNull();
    s.setPlaying(false);
    s.setMode('3d');
    s.setName('x');
    expect(seen).toEqual(['playing', 'playing', 'mode', 'name']);
  });

  it('reads position only for nodes with a position param', () => {
    const s = createEditorState(emptyBoard());
    const c = s.addNode('character', { x: 0, y: 0 })!;
    const k = s.addNode('key', { x: 0, y: 0 })!;
    expect(readPosition(s.getGraph(), c)).toEqual({ x: 0, y: 1, z: 0 });
    expect(readPosition(s.getGraph(), k)).toBeNull();
    expect(countUnavailable(s.getGraph(), '3d')).toBeGreaterThanOrEqual(0);
  });
});

describe('entity drag plane', () => {
  const cur = { x: 1, y: 2, z: 3 };
  const off = { x: 0, y: 0, z: 0 };
  it('side keeps z', () => {
    expect(positionOnPlane('2d-side', cur, { x: 4.3, y: 5.1, z: 0 }, off)).toEqual({ x: 4.5, y: 5, z: 3 });
  });
  it('an unmoved axis keeps an off-grid value', () => {
    const offGrid = { x: 4.5, y: 1.25, z: 0 };
    expect(positionOnPlane('2d-side', offGrid, { x: 10, y: 1.25, z: 0 }, { x: 0, y: 0, z: 0 })).toEqual({
      x: 10,
      y: 1.25,
      z: 0,
    });
  });
  it('top and 3d keep y', () => {
    expect(positionOnPlane('2d-top', cur, { x: 4.3, y: 2, z: 7.8 }, off)).toEqual({ x: 4.5, y: 2, z: 8 });
    expect(positionOnPlane('3d', cur, { x: 0, y: 2, z: 0.2 }, { x: 1, y: 0, z: 0 })).toEqual({ x: 1, y: 2, z: 0 });
  });
});

describe('text helpers', () => {
  it('labels keys', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit3')).toBe('3');
    expect(keyLabel('ArrowLeft')).toContain('Trái');
  });
  it('formats wire values', () => {
    expect(formatWireValue('bool', true, '')).toBe('Đúng');
    expect(formatWireValue('bool', false, '')).toBe('Sai');
    expect(formatWireValue('number', 1.234, '')).toBe('1.23');
    expect(formatWireValue('object', 'e1', 'Nhân vật')).toBe('Nhân vật');
    expect(formatWireValue('object', null, 'x')).toBe('—');
  });
});
