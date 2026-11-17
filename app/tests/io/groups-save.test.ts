import { describe, expect, it } from 'vitest';
import { createEditorState } from '../../src/editor/editor-state';
import { buildClip } from '../../src/editor/clipboard';
import { createGroup } from '../../src/editor/groups/group-model';
import type { Board } from '../../src/engine/types';
import { listAllSamples, parseBoard, serializeBoard } from '../../src/io';
import { fixture } from '../editor/groups-fixture';

function ok(text: string): Board {
  const res = parseBoard(text);
  if (!res.ok) throw new Error(res.error);
  return res.board;
}

const groupedBoard = (): Board => {
  const res = createGroup(fixture(), ['c1', 'c2'], { name: 'Bot', color: '#5aa9ff' });
  if (!res.ok) throw new Error(res.reason);
  return { name: 'g', mode: '3d', graph: res.graph };
};

describe('groups in save files', () => {
  it('round-trips a grouped board', () => {
    const b = groupedBoard();
    const loaded = ok(serializeBoard(b));
    expect(loaded.graph.groups).toEqual(b.graph.groups);
    expect(loaded.graph.wires).toEqual(b.graph.wires);
    expect(loaded.graph.nodes.map((n) => n.id)).toEqual(b.graph.nodes.map((n) => n.id));
    expect(ok(serializeBoard(loaded))).toEqual(loaded);
  });

  it('keeps the format version and writes no groups key for boards without groups', () => {
    const raw = JSON.parse(serializeBoard({ name: 'g', mode: '3d', graph: fixture() }));
    expect(raw.format_version).toBe(1);
    expect('groups' in raw.graph).toBe(false);
  });

  it('loads every sample unchanged: the old ones without groups, the 3D city and the AGV with their groups', () => {
    for (const s of listAllSamples()) {
      const loaded = ok(serializeBoard(s.board));
      if (s.id === 'city-delivery-3d') expect(loaded.graph.groups!.length).toBeGreaterThan(20);
      else if (s.id === 'agv-shuttle') expect(loaded.graph.groups!.length).toBe(5);
      else expect(loaded.graph.groups).toBeUndefined();
      expect(loaded).toEqual(s.board);
    }
  });

  it('repairs bad group data instead of failing the load', () => {
    const raw = JSON.parse(serializeBoard(groupedBoard()));
    raw.graph.groups = [
      { id: 'a', name: '  ', color: 'red', nodeIds: ['c1', 'ghost', 7], x: 'x', y: 5 },
      { id: 'a', name: 'dup id', nodeIds: ['c2'], x: 0, y: 0 },
      { id: 'b', name: 'overlap', nodeIds: ['c1'], x: 0, y: 0 },
      { id: 'c', name: 'empty', nodeIds: [], x: 0, y: 0 },
      'junk',
      { name: 'no id', nodeIds: ['c2'] },
    ];
    const board = ok(JSON.stringify(raw));
    expect(board.graph.groups).toEqual([{ id: 'a', name: 'Nhóm 1', nodeIds: ['c1'], x: 300, y: 5 }]);
    raw.graph.groups = 'nope';
    expect(ok(JSON.stringify(raw)).graph.groups).toBeUndefined();
  });

  it('survives copy through the stored clipboard format', () => {
    const b = groupedBoard();
    const clip = buildClip(b, new Set(['grp1']))!;
    expect(clip.graph.nodes.map((n) => n.id)).toEqual(['c1', 'c2']);
    expect(clip.graph.groups).toHaveLength(1);
    expect(ok(serializeBoard(clip)).graph.groups).toEqual(clip.graph.groups);
  });

  it('autosaved-style round trip keeps groups after undo and redo', () => {
    const s = createEditorState(groupedBoard());
    s.renameGroup('grp1', 'Xe');
    s.undo();
    s.redo();
    expect(ok(serializeBoard(s.getBoard())).graph.groups![0]!.name).toBe('Xe');
  });
});
