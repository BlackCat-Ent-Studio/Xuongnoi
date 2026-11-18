import { describe, expect, it } from 'vitest';
import { FIT_FLOOR, LEGACY_CARD_METRICS, estimateNodeSize, fitView, spreadOverlaps } from '../../src/editor/graph/graph-geometry';
import { formatPill } from '../../src/editor/graph/wire-energy';
import type { Graph, GraphNode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';

registerAllNodes();

const node = (id: string, x: number, y: number, kind = 'block'): GraphNode => ({ id, kind, params: {}, pos: { x, y } });
const STUDENT = { head: 50, row: 34, fontScale: 15 / 13 };
const TEACHER = { head: 34, row: 24, fontScale: 1 };

describe('card size estimate and the display modes', () => {
  it('without metrics it is the legacy estimate: saved boards and samples keep their spacing', () => {
    const n = node('a', 0, 0);
    expect(estimateNodeSize(n)).toEqual(estimateNodeSize(n, LEGACY_CARD_METRICS));
    expect(LEGACY_CARD_METRICS).toEqual({ head: 40, row: 26, fontScale: 1 });
  });

  it('a board that does not overlap by the legacy estimate is opened untouched (no silent re-layout)', () => {
    const g: Graph = { nodes: [node('a', 0, 0), node('b', 600, 0), node('c', 0, 400)], wires: [] };
    expect(spreadOverlaps(g)).toBe(g);
  });

  it('Học sinh cards are taller than the legacy estimate, Giáo viên cards a little shorter, per port row', () => {
    const n = node('a', 0, 0);
    const legacy = estimateNodeSize(n);
    const student = estimateNodeSize(n, STUDENT);
    const teacher = estimateNodeSize(n, TEACHER);
    expect(student.h).toBeGreaterThan(legacy.h);
    expect(teacher.h).toBeLessThan(legacy.h);
    expect(student.w).toBeGreaterThanOrEqual(legacy.w);
  });

  it('height is header + rows x row height + the 8 px body padding', () => {
    const n = node('a', 0, 0);
    const rows = (estimateNodeSize(n, { ...LEGACY_CARD_METRICS, row: 1, head: 0 }).h - 8) / 1;
    expect(estimateNodeSize(n, STUDENT).h).toBe(STUDENT.head + rows * STUDENT.row + 8);
    expect(estimateNodeSize(n, TEACHER).h).toBe(TEACHER.head + rows * TEACHER.row + 8);
  });
});

describe('fit to screen floor', () => {
  const content = { x: 0, y: 0, w: 4000, h: 3000 };
  const viewport = { w: 1000, h: 600 };
  it('without a floor it stops at the old minimum zoom', () => {
    expect(fitView(content, viewport).zoom).toBe(FIT_FLOOR);
  });
  it('a higher floor keeps the card text readable when the board is bigger than the screen', () => {
    expect(fitView(content, viewport, undefined, 11 / 13).zoom).toBeCloseTo(11 / 13);
  });
  it('a board that fits is not zoomed past 1 by the floor', () => {
    expect(fitView({ x: 0, y: 0, w: 200, h: 100 }, viewport, undefined, 0.9).zoom).toBe(1);
  });
});

describe('value pill text', () => {
  it('two decimals, one from 100 up, sign kept', () => {
    expect(formatPill(1)).toBe('1.00');
    expect(formatPill(-0.456)).toBe('-0.46');
    expect(formatPill(120)).toBe('120.0');
  });
});
