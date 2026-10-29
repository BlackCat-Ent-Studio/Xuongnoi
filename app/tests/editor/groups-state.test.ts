import { beforeAll, describe, expect, it } from 'vitest';
import { createEditorState, type EditorState } from '../../src/editor/editor-state';
import { deriveGroupPorts } from '../../src/editor/groups/group-model';
import type { Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { fixture } from './groups-fixture';

beforeAll(() => registerAllNodes());

const board = (): Board => ({ name: 't', mode: '3d', graph: fixture() });
const grouped = (): { s: EditorState; id: string } => {
  const s = createEditorState(board());
  s.selectMany(['c1', 'c2']);
  const res = s.groupSelection();
  if (!res.ok) throw new Error(res.reason);
  return { s, id: res.groupId };
};

describe('groups in the editor state', () => {
  it('groups the selection, selects the new block and undoes cleanly', () => {
    const { s, id } = grouped();
    expect(s.getGraph().groups).toHaveLength(1);
    expect(s.getSelection()).toEqual({ kind: 'group', id });
    expect(s.getGraph().nodes).toHaveLength(6);
    expect(s.undo()).toBe(true);
    expect(s.getGraph()).toEqual(fixture());
    expect(s.getSelection()).toBeNull();
    expect(s.redo()).toBe(true);
    expect(s.getGraph().groups).toHaveLength(1);
  });

  it('explains why it cannot group', () => {
    const s = createEditorState(board());
    s.selectMany(['c1']);
    expect(s.groupSelection()).toEqual({ ok: false, reason: 'too-few' });
    s.selectMany(['c1', 'c2']);
    s.setPlaying(true);
    expect(s.groupSelection()).toEqual({ ok: false, reason: 'locked' });
    s.setPlaying(false);
    s.groupSelection();
    s.selectMany(['grp1', 'k1']);
    expect(s.groupSelection()).toEqual({ ok: false, reason: 'has-group' });
  });

  it('enters and leaves a group without touching undo history', () => {
    const { s, id } = grouped();
    const seen: string[] = [];
    s.subscribe((k) => seen.push(k));
    s.enterGroup(id);
    expect(s.getScope()).toBe(id);
    expect(s.getMulti().size).toBe(0);
    expect(seen).not.toContain('history');
    expect(s.groupSelection()).toEqual({ ok: false, reason: 'in-group' });
    s.exitGroup();
    expect(s.getScope()).toBeNull();
    s.enterGroup('nope');
    expect(s.getScope()).toBeNull();
  });

  it('selecting a hidden node opens its group, selecting a loose one leaves it', () => {
    const { s, id } = grouped();
    s.select({ kind: 'node', id: 'c2' });
    expect(s.getScope()).toBe(id);
    expect(s.getSelection()).toEqual({ kind: 'node', id: 'c2' });
    s.select({ kind: 'node', id: 'lone' });
    expect(s.getScope()).toBeNull();
  });

  it('renames with cleanup, recolours, and undoes', () => {
    const { s, id } = grouped();
    s.renameGroup(id, '   Bot   nông dân  ');
    expect(s.getGraph().groups![0]!.name).toBe('Bot nông dân');
    s.renameGroup(id, '   ');
    expect(s.getGraph().groups![0]!.name).toBe('Bot nông dân');
    s.setGroupColor(id, '#5aa9ff');
    expect(s.getGraph().groups![0]!.color).toBe('#5aa9ff');
    s.setGroupColor(id, null);
    expect(s.getGraph().groups![0]!.color).toBeUndefined();
    s.undo();
    expect(s.getGraph().groups![0]!.color).toBe('#5aa9ff');
  });

  it('drags the block without moving the members', () => {
    const { s, id } = grouped();
    s.moveItems([{ id, pos: { x: 10, y: 20 } }]);
    expect(s.getGraph().groups![0]).toMatchObject({ x: 10, y: 20 });
    expect(s.getGraph().nodes.find((n) => n.id === 'c1')!.pos).toEqual({ x: 300, y: 40 });
    s.undo();
    expect(s.getGraph().groups![0]).toMatchObject({ x: 300, y: 40 });
  });

  it('ungroups the selection or the entered group and keeps the members selected', () => {
    const { s, id } = grouped();
    expect(s.ungroupSelection()).toBe(1);
    expect(s.getGraph()).toEqual(fixture());
    expect(s.getMulti()).toEqual(new Set(['c1', 'c2']));
    s.undo();
    s.enterGroup(id);
    expect(s.ungroupSelection()).toBe(1);
    expect(s.getScope()).toBeNull();
    expect(s.getGraph().groups).toBeUndefined();
  });

  it('duplicates a whole group with fresh ids, internal wires and no outside wires', () => {
    const s = createEditorState(board());
    s.selectMany(['c1', 'c2']);
    const { groupId } = s.groupSelection() as { ok: true; groupId: string };
    s.select({ kind: 'group', id: groupId });
    expect(s.duplicate()).toBe(1);
    const g = s.getGraph();
    expect(g.groups).toHaveLength(2);
    const copy = g.groups![1]!;
    expect(copy.name).toBe('Nhóm 1 (bản sao)');
    expect(copy.nodeIds.every((i) => !['c1', 'c2'].includes(i))).toBe(true);
    expect(g.nodes).toHaveLength(8);
    expect(g.wires).toHaveLength(4); // outside wires are not duplicated
    expect(deriveGroupPorts(g, copy)).toEqual([]);
    expect(s.getSelection()).toEqual({ kind: 'group', id: copy.id });
    s.undo();
    expect(s.getGraph().groups).toHaveLength(1);
  });

  it('copies internal wires when a group contains them', () => {
    const s = createEditorState({
      name: 't',
      mode: '3d',
      graph: {
        nodes: [
          { id: 'a', kind: 'key', params: {}, pos: { x: 0, y: 0 } },
          { id: 'b', kind: 'character', params: {}, pos: { x: 200, y: 0 } },
        ],
        wires: [{ id: 'w1', from: { node: 'a', port: 'held' }, to: { node: 'b', port: 'jump' } }],
      },
    });
    s.selectMany(['a', 'b']);
    const res = s.groupSelection();
    expect(res.ok).toBe(true);
    expect(s.duplicate()).toBe(1);
    expect(s.getGraph().wires).toHaveLength(2);
    const copy = s.getGraph().groups![1]!;
    const w = s.getGraph().wires[1]!;
    expect(copy.nodeIds).toContain(w.from.node);
    expect(copy.nodeIds).toContain(w.to.node);
  });

  it('delete removes the group with its members and wires; deleting every member drops the group', () => {
    const { s } = grouped();
    s.deleteSelection();
    expect(s.getGraph().groups).toBeUndefined();
    expect(s.getGraph().nodes.map((n) => n.id)).toEqual(['k1', 'cr1', 'cr2', 'lone']);
    expect(s.getGraph().wires).toEqual([]);
    const t = grouped();
    t.s.enterGroup(t.id);
    t.s.selectMany(['c1', 'c2']);
    t.s.deleteSelection();
    expect(t.s.getGraph().groups).toBeUndefined();
    expect(t.s.getScope()).toBeNull();
  });

  it('new nodes and pastes land inside the entered group', () => {
    const { s, id } = grouped();
    s.enterGroup(id);
    const added = s.addNode('key', { x: 0, y: 0 })!;
    expect(s.getGraph().groups![0]!.nodeIds).toContain(added);
    s.select({ kind: 'node', id: 'c1' });
    expect(s.duplicate()).toBe(1);
    expect(s.getGraph().groups![0]!.nodeIds).toHaveLength(4);
    expect(s.getGraph().groups).toHaveLength(1);
  });

  it('leaving a group that undo removes falls back to the main board', () => {
    const { s, id } = grouped();
    s.enterGroup(id);
    s.undo();
    expect(s.getScope()).toBeNull();
  });
});
