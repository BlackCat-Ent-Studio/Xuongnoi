import type { ViewMode } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { isSolved, isUnlocked, starsOf, type ProgressMap } from './progress';

/** What a stop on the level map looks like: solved, the open level to play next, or still locked. */
export type StopState = 'done' | 'next' | 'locked';

export interface MapStop {
  index: number;
  id: string;
  order: number;
  title: string;
  mode: ViewMode;
  state: StopState;
  stars: 0 | 1 | 2 | 3;
}

/** One stop per level. The first open level that is not solved yet is the "next" one (at most one). */
export function buildStops(levels: readonly PuzzleLevel[], progress: ProgressMap): MapStop[] {
  let nextTaken = false;
  return levels.map((level, index) => {
    const open = isUnlocked(levels, index, progress);
    let state: StopState = 'locked';
    if (open && isSolved(progress, level.id)) state = 'done';
    else if (open && !nextTaken) {
      state = 'next';
      nextTaken = true;
    }
    return { index, id: level.id, order: level.order, title: level.title, mode: level.mode, state, stars: starsOf(progress, level.id) };
  });
}

/** How many levels are open (the open ones are always the first ones). */
export function unlockedCount(levels: readonly PuzzleLevel[], progress: ProgressMap): number {
  let n = 0;
  while (n < levels.length && isUnlocked(levels, n, progress)) n++;
  return n;
}

/** Indexes of levels that opened since the map last showed `seen` open levels. */
export function newlyUnlocked(levels: readonly PuzzleLevel[], progress: ProgressMap, seen: number): number[] {
  const out: number[] = [];
  for (let i = Math.max(0, seen); i < unlockedCount(levels, progress); i++) out.push(i);
  return out;
}

export function starTotals(levels: readonly PuzzleLevel[], progress: ProgressMap): { got: number; max: number } {
  let got = 0;
  for (const level of levels) got += starsOf(progress, level.id);
  return { got, max: levels.length * 3 };
}

export const allSolved = (levels: readonly PuzzleLevel[], progress: ProgressMap): boolean =>
  levels.length > 0 && levels.every((l) => isSolved(progress, l.id));

// ---------- layout of the winding path ----------

/** The map scene is 100 units wide and `MAP_HEIGHT` tall (the 844x390 screen). */
export const MAP_HEIGHT = 46.2;
const FIRST_X = 9.2;
const LAST_X = 90.8;
/** The path swings between a low and a high row; small offsets keep it from looking like a zig-zag ruler. */
const ROW_Y = [29.5, 22, 29, 21.5, 28.5, 21, 28, 20] as const;

export interface MapPoint {
  x: number;
  y: number;
}

/** Centre of every stop, left to right. */
export function stopPoints(count: number): MapPoint[] {
  if (count <= 0) return [];
  const step = count > 1 ? (LAST_X - FIRST_X) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: count > 1 ? FIRST_X + i * step : 50,
    y: ROW_Y[i % ROW_Y.length] ?? 25,
  }));
}

/** Smooth curve (Catmull-Rom as cubic Béziers) through the points, as an SVG path. */
export function trailPath(pts: readonly MapPoint[]): string {
  const first = pts[0];
  if (!first) return '';
  const f = (n: number): string => n.toFixed(2);
  let d = `M${f(first.x)} ${f(first.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p0 = pts[i - 1] ?? p1;
    const p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}
