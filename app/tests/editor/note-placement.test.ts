import { beforeAll, describe, expect, it } from 'vitest';
import { createNode } from '../../src/editor/editor-state';
import { findFreeNoteSpot } from '../../src/editor/note-placement';
import { createNote, NOTE_DEFAULT_SIZE } from '../../src/engine/notes';
import { registerAllNodes } from '../../src/nodes';
import type { Graph } from '../../src/engine/types';

beforeAll(() => registerAllNodes());

function boardWith(...at: [string, number, number][]): Graph {
  let graph: Graph = { nodes: [], wires: [] };
  for (const [kind, x, y] of at) {
    const node = createNode(graph, kind, { x, y });
    if (!node) throw new Error(kind);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  }
  return graph;
}

const intersects = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe('findFreeNoteSpot', () => {
  it('keeps the wanted spot on an empty board', () => {
    expect(findFreeNoteSpot({ x: 100, y: 80 }, { nodes: [], wires: [] }, [])).toEqual({ x: 100, y: 80 });
  });

  it('moves off a block that would hide the note', () => {
    const graph = boardWith(['character', 80, 60], ['key', 300, 60]);
    const spot = findFreeNoteSpot({ x: 100, y: 80 }, graph, []);
    expect(spot).not.toEqual({ x: 100, y: 80 });
    const note = { ...spot, w: NOTE_DEFAULT_SIZE.w, h: NOTE_DEFAULT_SIZE.h };
    for (const n of graph.nodes) expect(intersects(note, { x: n.pos.x, y: n.pos.y, w: 180, h: 100 })).toBe(false);
  });

  it('also avoids notes already on the board', () => {
    const existing = createNote([], { x: 100, y: 80 });
    const spot = findFreeNoteSpot({ x: 100, y: 80 }, { nodes: [], wires: [] }, [existing]);
    expect(spot).not.toEqual({ x: 100, y: 80 });
  });

  it('falls back to the wanted spot when nothing is free', () => {
    const nodes: [string, number, number][] = [];
    for (let x = -600; x <= 600; x += 150) for (let y = -600; y <= 600; y += 120) nodes.push(['character', x, y]);
    expect(findFreeNoteSpot({ x: 0, y: 0 }, boardWith(...nodes), [])).toEqual({ x: 0, y: 0 });
  });
});
