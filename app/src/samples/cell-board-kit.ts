import type { Board, GraphNode, Note, NoteColor, Params, ViewMode, Wire } from '../engine/types';

/**
 * Shared helpers for the machine samples built only from palette pieces: a card spec with a column, wires as
 * `[fromNode, fromPort, toNode, toPort]`, and an automatic top-to-bottom stacking of the cards inside each column so
 * that no two cards overlap. Plain data: no registry lookups, so a sample list can build the boards at any time.
 */

export interface CardSpec {
  id: string;
  kind: string;
  /** Column (0, 1, 2 ...): cards of one column are stacked downwards in the order given. */
  col: number;
  params?: Params;
}

export type Link = [fromNode: string, fromPort: string, toNode: string, toPort: string];

export interface NoteSpec {
  color: NoteColor;
  text: string;
  /** Height in px (width is fixed by the kit). */
  h?: number;
}

/** Inputs + outputs shown on a card of each kind: the card is about 40 px header + 26 px per row. */
const ROWS: Record<string, number> = {
  'on-start': 2,
  block: 8,
  item: 7,
  character: 8,
  patrol: 6,
  zone: 6,
  timer: 4,
  latch: 4,
  counter: 9,
  'map-range': 2,
  math: 3,
  compare: 3,
  and: 3,
  or: 3,
  not: 2,
  const: 1,
  joint: 8,
  link: 2,
  gripper: 10,
  sequence: 10,
  'show-number': 1,
  'show-text': 2,
  camera: 5,
  distance: 4,
  'force-sensor': 4,
  'linear-actuator': 9,
  'select-number': 8,
};

const COL_W = 330;
const GAP_Y = 24;
const MARGIN = 30;
const NOTE_W = 340;

function cardHeight(kind: string): number {
  return 48 + 26 * (ROWS[kind] ?? 8);
}

/** Builds a board: cards stacked per column, notes in a row under the lowest card. */
export function makeBoard(name: string, mode: ViewMode, specs: readonly CardSpec[], links: readonly Link[], notes: readonly NoteSpec[]): Board {
  const bottoms = new Map<number, number>();
  const nodes: GraphNode[] = specs.map((s) => {
    const y = bottoms.get(s.col) ?? MARGIN;
    bottoms.set(s.col, y + cardHeight(s.kind) + GAP_Y);
    return { id: s.id, kind: s.kind, params: structuredClone(s.params ?? {}), pos: { x: MARGIN + s.col * COL_W, y } };
  });
  const wires: Wire[] = links.map(([fn, fp, tn, tp], i) => ({ id: `w${i + 1}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } }));
  const lowest = Math.max(...bottoms.values());
  const noteList: Note[] = notes.map((n, i) => ({
    id: `note${i + 1}`,
    color: n.color,
    pos: { x: MARGIN + i * (NOTE_W + 20), y: lowest + 30 },
    size: { w: NOTE_W, h: n.h ?? 300 },
    text: n.text,
  }));
  return { name, mode, graph: { nodes, wires, settings: { wireRule: true } }, notes: noteList };
}
