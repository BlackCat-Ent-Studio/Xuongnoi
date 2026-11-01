import type { PuzzleLevel, PuzzleProgress } from '../types';

export const PROGRESS_KEY = 'xuongnoi.puzzle.progress';

export type ProgressMap = Record<string, PuzzleProgress>;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // storage blocked
  }
}

const asStars = (v: unknown): 0 | 1 | 2 | 3 | null => (v === 0 || v === 1 || v === 2 || v === 3 ? v : null);

/** Reads saved progress. Anything that is not the expected shape is ignored, never thrown. */
export function loadProgress(storage: StorageLike | null = defaultStorage()): ProgressMap {
  if (!storage) return {};
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
    const out: ProgressMap = {};
    for (const [id, v] of Object.entries(data)) {
      const stars = asStars((v as { stars?: unknown } | null)?.stars);
      if (stars !== null) out[id] = { stars };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveProgress(map: ProgressMap, storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false; // full or blocked: progress then only lasts for this visit
  }
}

/** New map with the better of the old and new stars for the level. */
export function withBest(map: ProgressMap, levelId: string, stars: 1 | 2 | 3): ProgressMap {
  const old = map[levelId]?.stars ?? 0;
  return { ...map, [levelId]: { stars: Math.max(old, stars) as 1 | 2 | 3 } };
}

export const starsOf = (map: ProgressMap, levelId: string): 0 | 1 | 2 | 3 => map[levelId]?.stars ?? 0;

export const isSolved = (map: ProgressMap, levelId: string): boolean => starsOf(map, levelId) > 0;

/** Level 1 is always open; every other level opens once the one before it is solved. */
export function isUnlocked(levels: readonly PuzzleLevel[], index: number, map: ProgressMap): boolean {
  if (index <= 0) return true;
  const prev = levels[index - 1];
  return prev !== undefined && isSolved(map, prev.id);
}
