import type { NodeCategory, NodeDef } from '../engine/types';
import { normalizeText } from '../editor/panels/palette-search';
import { nodeSearchAliases } from '../nodes/node-names';
import { chapterOf } from '../tutorial/course';
import { LESSONS } from '../tutorial/lessons';
import type { HandbookEntry } from './types';

/** Course chapter ids that make up each handbook level. */
export const LEVEL_CHAPTERS: Readonly<Record<number, readonly string[]>> = {
  1: ['basics', 'items'],
  2: ['bots', 'fighting'],
  3: ['world', 'vehicles'],
  4: ['delivery', 'numbers-ui'],
  5: ['real-games'],
};
export const LEVELS = [1, 2, 3, 4, 5] as const;

/** Level used when a node has no page, or its lesson is not part of the course. */
export const FALLBACK_LEVEL = 3;

/**
 * Level of a node = course chapter of the lesson that teaches it (see LEVEL_CHAPTERS).
 * A node without a handbook page, or whose lesson is outside the course, lands in FALLBACK_LEVEL.
 */
export function levelOf(entry: Pick<HandbookEntry, 'lessonId'> | undefined): number {
  const chapter = entry ? chapterOf(entry.lessonId) : undefined;
  if (!chapter) return FALLBACK_LEVEL;
  return LEVELS.find((lv) => LEVEL_CHAPTERS[lv]?.includes(chapter.id)) ?? FALLBACK_LEVEL;
}

/** Position of the node's lesson in the course; nodes without a lesson sort last. */
export function lessonPosition(entry: Pick<HandbookEntry, 'lessonId'> | undefined): number {
  const i = entry ? LESSONS.findIndex((l) => l.id === entry.lessonId) : -1;
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

export interface HandbookRow {
  kind: string;
  label: string;
  labelEn?: string;
  /** English term and the name before the rename, for search. */
  aliases?: string[];
  category: NodeCategory;
  description: string;
  level: number;
  position: number;
}

export interface HandbookSection {
  id: string;
  /** Level number for level sections, category id for group sections. */
  key: number | NodeCategory;
  rows: HandbookRow[];
}

type DefLike = Pick<NodeDef, 'kind' | 'label' | 'category' | 'description'> & { labelEn?: string };

export function buildRows(defs: readonly DefLike[], entryOf: (kind: string) => HandbookEntry | undefined): HandbookRow[] {
  return defs.map((d) => {
    const e = entryOf(d.kind);
    return { kind: d.kind, label: d.label, labelEn: d.labelEn ?? '', aliases: nodeSearchAliases(d.kind), category: d.category, description: d.description, level: levelOf(e), position: lessonPosition(e) };
  });
}

/** Rows matching every word of the query (accent-insensitive) on label, kind or description; label matches first. */
export function filterRows(rows: readonly HandbookRow[], query: string): HandbookRow[] {
  const q = normalizeText(query);
  if (!q) return [...rows];
  const words = q.split(' ');
  const scored: { row: HandbookRow; score: number }[] = [];
  for (const row of rows) {
    const label = normalizeText(row.label);
    const all = `${label} ${normalizeText(row.description)} ${normalizeText((row.aliases ?? []).join(' '))} ${row.kind}`;
    if (!words.every((w) => all.includes(w))) continue;
    scored.push({ row, score: label.startsWith(q) ? 3 : label.includes(q) ? 2 : words.every((w) => label.includes(w)) ? 1.5 : 1 });
  }
  // Array.sort is stable, so equal scores keep their incoming order.
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.row);
}

const byLabel = (a: HandbookRow, b: HandbookRow): number => a.label.localeCompare(b.label, 'vi');

/** Sections by level; inside a level, by lesson position then label. Empty levels are dropped. */
export function sectionsByLevel(rows: readonly HandbookRow[]): HandbookSection[] {
  return LEVELS.map((lv) => ({
    id: `level-${lv}`,
    key: lv,
    rows: rows.filter((r) => r.level === lv).sort((a, b) => a.position - b.position || byLabel(a, b)),
  })).filter((s) => s.rows.length > 0);
}

/** Sections by node category in the given order; inside a group, by level then lesson position. */
export function sectionsByCategory(rows: readonly HandbookRow[], order: readonly NodeCategory[]): HandbookSection[] {
  return order
    .map((cat) => ({
      id: `cat-${cat}`,
      key: cat,
      rows: rows.filter((r) => r.category === cat).sort((a, b) => a.level - b.level || a.position - b.position || byLabel(a, b)),
    }))
    .filter((s) => s.rows.length > 0);
}
