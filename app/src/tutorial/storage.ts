import type { Board } from '../engine/types';
import { parseBoard, serializeBoard } from '../io/save-format';

export const STASH_KEY = 'xuong-noi:tutorial-stash';
export const SEEN_KEY = 'xuong-noi:tutorial-seen';
export const PROGRESS_KEY = 'xuong-noi:tutorial-progress';

/** localStorage may be missing (node tests) or throw (privacy modes). */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    storage()?.setItem(key, value);
  } catch {
    // Quota or privacy mode: tutorial state is best effort.
  }
}

function remove(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Best effort.
  }
}

export function hasSeenInvite(): boolean {
  return read(SEEN_KEY) !== null;
}

export function markInviteSeen(): void {
  write(SEEN_KEY, '1');
}

/** Ids of the lessons the learner finished. Corrupt data reads as "none". */
export function loadProgress(): Set<string> {
  const raw = read(PROGRESS_KEY);
  if (raw === null) return new Set();
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return new Set();
    return new Set(data.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function saveProgress(done: ReadonlySet<string>): void {
  write(PROGRESS_KEY, JSON.stringify([...done]));
}

/** Keeps the learner's own board on disk while a lesson runs, so a reload cannot lose it. */
export function writeStash(board: Board): void {
  write(STASH_KEY, serializeBoard(board));
}

export function clearStash(): void {
  remove(STASH_KEY);
}

/** Returns the stashed board (and clears it) after an interrupted lesson, else null. */
export function takeStash(): Board | null {
  const raw = read(STASH_KEY);
  if (raw === null) return null;
  remove(STASH_KEY);
  const res = parseBoard(raw);
  return res.ok ? res.board : null;
}
