import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { runLevel } from '../../src/puzzle/run-level';
import type { PuzzleLevel } from '../../src/puzzle/types';
import {
  EMPTY_BOARD,
  connect,
  editableParamIds,
  findFreeSpot,
  graphOf,
  isSceneryNode,
  paramValue,
  placePiece,
  removePiece,
  removeWire,
  separateBoxes,
  setParam,
  toAnswer,
  trayLeft,
  type BoardState,
  type PortEnd,
} from '../../src/puzzle/ui/board-state';
import { doorFixture as level } from './fixtures/door-fixture';

const out = (node: string, port: string): PortEnd => ({ node, port, dir: 'out' });
const inn = (node: string, port: string): PortEnd => ({ node, port, dir: 'in' });
const at = { x: 10, y: 10 };

beforeAll(() => registerAllNodes());

function place(state: BoardState, slot: number): BoardState {
  const next = placePiece(level, state, slot, at);
  if (!next) throw new Error('no piece left');
  return next;
}
function join(state: BoardState, a: PortEnd, b: PortEnd): BoardState {
  const res = connect(level, state, a, b);
  if (!res.ok) throw new Error(res.message);
  return res.state;
}

describe('tray', () => {
  it('counts copies left and refuses a piece that ran out', () => {
    expect(trayLeft(level, EMPTY_BOARD)).toEqual([1, 1]);
    const s = place(EMPTY_BOARD, 0);
    expect(trayLeft(level, s)).toEqual([0, 1]);
    expect(placePiece(level, s, 0, at)).toBeNull();
    expect(placePiece(level, s, 9, at)).toBeNull();
  });

  it('gives each placed copy a unique id that never clashes with the locked nodes', () => {
    const two: PuzzleLevel = { ...level, tray: [{ kind: 'touch', count: 2 }] };
    let s = placePiece(two, EMPTY_BOARD, 0, at)!;
    s = placePiece(two, s, 0, at)!;
    const ids = s.placed.map((p) => p.node.id);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(level.base.nodes.some((n) => n.id === id)).toBe(false);
  });

  it('takes a piece back with its wires', () => {
    let s = place(EMPTY_BOARD, 0);
    const id = s.placed[0]!.node.id;
    s = join(s, out('bot', 'self'), inn(id, 'a'));
    const back = removePiece(s, id);
    expect(back.placed).toHaveLength(0);
    expect(back.wires).toHaveLength(0);
    expect(trayLeft(level, back)).toEqual([1, 1]);
  });
});

describe('wiring', () => {
  it('joins in either tap order and keeps one wire per input', () => {
    let s = place(EMPTY_BOARD, 0);
    const t = s.placed[0]!.node.id;
    s = join(s, inn(t, 'a'), out('bot', 'self'));
    expect(s.wires).toHaveLength(1);
    s = join(s, out('btn', 'self'), inn(t, 'a'));
    expect(s.wires).toHaveLength(1);
    expect(s.wires[0]!.from.node).toBe('btn');
  });

  it('refuses wrong types, same direction and hidden ports', () => {
    let s = place(EMPTY_BOARD, 0);
    s = place(s, 1);
    const [t, l] = s.placed.map((p) => p.node.id) as [string, string];
    expect(connect(level, s, out('bot', 'self'), inn(l, 'set')).ok).toBe(false); // object -> bool
    expect(connect(level, s, out('bot', 'self'), out('btn', 'self')).ok).toBe(false);
    expect(connect(level, s, out('go', 'value'), inn(t, 'a')).ok).toBe(false); // hidden source port
    expect(connect(level, s, out('bot', 'self'), inn('bot', 'moveX')).ok).toBe(false);
  });

  it('removes only the player wires', () => {
    let s = place(EMPTY_BOARD, 0);
    const t = s.placed[0]!.node.id;
    s = join(s, out('bot', 'self'), inn(t, 'a'));
    const id = s.wires[0]!.id;
    expect(level.base.wires.some((w) => w.id === id)).toBe(false);
    expect(removeWire(s, id).wires).toHaveLength(0);
    expect(removeWire(s, 'b1').wires).toHaveLength(1);
  });

  it('plays the reference solution built tap by tap', () => {
    let s = place(EMPTY_BOARD, 0);
    s = place(s, 1);
    const [t, l] = s.placed.map((p) => p.node.id) as [string, string];
    s = join(s, out('bot', 'self'), inn(t, 'a'));
    s = join(s, out('btn', 'self'), inn(t, 'b'));
    s = join(s, out(t, 'touching'), inn(l, 'set'));
    s = join(s, out(l, 'on'), inn('door', 'hide'));
    expect(runLevel(level, toAnswer(s)).outcome).toBe('win');
    expect(graphOf(level, s).nodes).toHaveLength(level.base.nodes.length + 2);
  });
});

describe('scenery and editable params', () => {
  it('hides locked nodes that list no ports', () => {
    expect(isSceneryNode(level, 'floor')).toBe(true);
    expect(isSceneryNode(level, 'bot')).toBe(false);
  });

  const editable: PuzzleLevel = {
    ...level,
    tray: [{ kind: 'timer', count: 1 }],
    editable: [{ kind: 'touch', paramId: 'mode' }, { nodeId: 'bot', paramId: 'speed' }, { kind: 'timer', paramId: 'seconds' }],
  };

  it('lists params per node and clamps edits to the allowed range', () => {
    const bot = editable.base.nodes.find((n) => n.id === 'bot')!;
    expect(editableParamIds(editable, bot)).toEqual(['speed']);
    let s = setParam(editable, EMPTY_BOARD, 'bot', 'speed', -3);
    expect(paramValue(s, bot, 'speed')).toBe(0);
    s = setParam(editable, s, 'bot', 'speed', 7.5);
    expect(graphOf(editable, s).nodes.find((n) => n.id === 'bot')!.params.speed).toBe(7.5);
  });

  it('ignores params that are not editable', () => {
    expect(setParam(editable, EMPTY_BOARD, 'bot', 'jumpPower', 3)).toBe(EMPTY_BOARD);
    expect(setParam(editable, EMPTY_BOARD, 'nobody', 'speed', 3)).toBe(EMPTY_BOARD);
  });

  it('edits a placed copy only', () => {
    const s0 = placePiece(editable, EMPTY_BOARD, 0, at)!;
    const id = s0.placed[0]!.node.id;
    const s1 = setParam(editable, s0, id, 'seconds', 4);
    expect(s1.placed[0]!.node.params.seconds).toBe(4);
    expect(s1.overrides).toEqual({});
  });
});

describe('findFreeSpot', () => {
  it('skips taken boxes and stays inside the area', () => {
    const area = { w: 400, h: 200 };
    const taken = [{ x: 0, y: 0, w: 200, h: 200 }];
    const spot = findFreeSpot(taken, { w: 100, h: 60 }, area);
    expect(spot.x).toBeGreaterThanOrEqual(214);
    expect(spot.x + 100).toBeLessThanOrEqual(area.w);
  });

  it('falls back to a cascade when full', () => {
    const spot = findFreeSpot([{ x: 0, y: 0, w: 400, h: 200 }], { w: 100, h: 60 }, { w: 400, h: 200 });
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.y).toBeLessThanOrEqual(140);
  });
});

describe('separateBoxes', () => {
  const area = { w: 400, h: 300 };
  const overlap = (a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number) => a.x < b.x + w && b.x < a.x + w && a.y < b.y + h && b.y < a.y + h;

  it('pushes overlapping cards apart and keeps them inside the area', () => {
    const items = [
      { id: 'a', x: 10, y: 10, w: 120, h: 80 },
      { id: 'b', x: 20, y: 30, w: 120, h: 80 },
      { id: 'c', x: 390, y: 10, w: 120, h: 80 },
    ];
    const { pos, fits } = separateBoxes(items, area);
    expect(fits).toBe(true);
    const [a, b, c] = [pos.get('a')!, pos.get('b')!, pos.get('c')!];
    expect(overlap(a, b, 120, 80)).toBe(false);
    expect(c.x + 120).toBeLessThanOrEqual(area.w);
  });

  it('keeps cards that do not collide where they are, and reports when there is no room', () => {
    const { pos } = separateBoxes([{ id: 'a', x: 50, y: 40, w: 100, h: 60 }], area);
    expect(pos.get('a')).toEqual({ x: 50, y: 40 });
    const crowded = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, x: 0, y: 0, w: 200, h: 120 }));
    expect(separateBoxes(crowded, area).fits).toBe(false);
  });
});
