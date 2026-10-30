import { describe, expect, it } from 'vitest';
import { formatDefault } from '../../src/handbook/handbook-dialog';
import {
  FALLBACK_LEVEL,
  buildRows,
  filterRows,
  levelOf,
  sectionsByCategory,
  sectionsByLevel,
  type HandbookRow,
} from '../../src/handbook/handbook-model';
import type { HandbookEntry } from '../../src/handbook/types';
import { LESSONS } from '../../src/tutorial/lessons';

const entry = (lessonId: string): HandbookEntry => ({
  kind: 'x', purpose: '', whenToUse: '', ports: {}, params: {}, example: '', tips: [], lessonId, tryBoard: () => { throw new Error('unused'); },
});

const lessonIndex = (id: string): number => LESSONS.findIndex((l) => l.id === id);

describe('levelOf', () => {
  it('maps lesson chapters to levels 1..5', () => {
    expect(levelOf(entry('walk-jump'))).toBe(1);
    expect(levelOf(entry('carry-use'))).toBe(1);
    expect(levelOf(entry('make-bot'))).toBe(2);
    expect(levelOf(entry('combat'))).toBe(2);
    expect(levelOf(entry('conveyor'))).toBe(3);
    expect(levelOf(entry('vehicles'))).toBe(3);
    expect(levelOf(entry('guide-arrow'))).toBe(4);
    expect(levelOf(entry('ask-dialog'))).toBe(4);
    expect(levelOf(entry('capstone-factory'))).toBe(5);
  });
  it('falls back to level 3 without a page or with an unknown lesson', () => {
    expect(levelOf(undefined)).toBe(FALLBACK_LEVEL);
    expect(levelOf(entry('no-such-lesson'))).toBe(FALLBACK_LEVEL);
  });
});

const defs = [
  { kind: 'a', label: 'Bộ đếm', category: 'math' as const, description: 'Đếm điểm' },
  { kind: 'b', label: 'Nhân vật', category: 'object' as const, description: 'Người chơi' },
  { kind: 'c', label: 'Xe', category: 'object' as const, description: 'Lái xe' },
  { kind: 'd', label: 'Chưa viết', category: 'logic' as const, description: 'Không có trang' },
];
const pages: Record<string, HandbookEntry> = {
  a: entry('collect-stars'),
  b: entry('walk-jump'),
  c: entry('vehicles'),
};
const rows = (): HandbookRow[] => buildRows(defs, (k) => pages[k]);

describe('buildRows / sections', () => {
  it('assigns level and lesson position, fallback for nodes without a page', () => {
    const r = rows();
    expect(r.find((x) => x.kind === 'b')?.level).toBe(1);
    expect(r.find((x) => x.kind === 'c')?.level).toBe(3);
    const d = r.find((x) => x.kind === 'd');
    expect(d?.level).toBe(FALLBACK_LEVEL);
    expect(d?.position).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('orders levels, and rows by lesson position inside a level', () => {
    const sections = sectionsByLevel(rows());
    expect(sections.map((s) => s.key)).toEqual([1, 3]);
    expect(lessonIndex('walk-jump')).toBeLessThan(lessonIndex('collect-stars'));
    expect(sections[0]?.rows.map((x) => x.kind)).toEqual(['b', 'a']);
    // level 3: Xe (lesson) before the page-less node
    expect(sections[1]?.rows.map((x) => x.kind)).toEqual(['c', 'd']);
  });

  it('groups by category in the given order and drops empty groups', () => {
    const sections = sectionsByCategory(rows(), ['logic', 'math', 'object', 'brain']);
    expect(sections.map((s) => s.key)).toEqual(['logic', 'math', 'object']);
    expect(sections[2]?.rows.map((x) => x.kind)).toEqual(['b', 'c']);
  });
});

describe('filterRows', () => {
  it('returns all for an empty query', () => {
    expect(filterRows(rows(), '  ')).toHaveLength(4);
  });
  it('matches without accents, label first', () => {
    expect(filterRows(rows(), 'nhan vat').map((r) => r.kind)).toEqual(['b']);
    expect(filterRows(rows(), 'bo dem').map((r) => r.kind)).toEqual(['a']);
    expect(filterRows(rows(), 'lai xe')[0]?.kind).toBe('c');
  });
  it('returns nothing when no word matches', () => {
    expect(filterRows(rows(), 'zzzz')).toEqual([]);
  });
});

describe('formatDefault', () => {
  it('shows labels for selects and plain text for numbers and vectors', () => {
    expect(formatDefault({ id: 's', label: 's', kind: 'select', default: 'on', options: [{ value: 'on', label: 'Bật' }] })).toBe('Bật');
    expect(formatDefault({ id: 'n', label: 'n', kind: 'number', default: 5 })).toBe('5');
    expect(formatDefault({ id: 'v', label: 'v', kind: 'vec3', default: { x: 1, y: 2, z: 3 } })).toBe('1, 2, 3');
  });
});
