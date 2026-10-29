import type { Board } from '../engine/types';
import { saveCurrentGame } from './game-library';
import { parseBoard, serializeBoard } from './save-format';
import { IO_TEXT } from './text-vi';

export const AUTOSAVE_KEY = 'xuong-noi:autosave';
export const AUTOSAVE_BACKUP_KEY = 'xuong-noi:autosave-backup';
export const AUTOSAVE_DELAY_MS = 1000;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: { board: Board; library: boolean } | null = null;
let problem: string | null = null;

/** localStorage may be missing (node tests) or throw on access (privacy modes). */
function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function writeNow(board: Board, library: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTOSAVE_KEY, serializeBoard(board));
  } catch {
    problem = IO_TEXT.autosaveFailed;
  }
  if (!library) return;
  const res = saveCurrentGame(board);
  if (res && !res.ok) problem = res.error;
}

/**
 * Debounced write: only the latest board within the window is saved. The board always goes to the
 * autosave key; it also updates the current library entry unless `library` is false (a board that was
 * just loaded and not edited yet must not be re-stamped or turned into an entry).
 */
export function scheduleAutosave(board: Board, options: { library?: boolean } = {}): void {
  pending = { board, library: options.library ?? true };
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flushAutosave, AUTOSAVE_DELAY_MS);
}

/** Writes any pending board immediately (e.g. on page hide). */
export function flushAutosave(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending) {
    const { board, library } = pending;
    pending = null;
    writeNow(board, library);
  }
}

/** Forgets the autosave and any write waiting for the timer (the game it held was deleted). */
export function clearAutosave(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  pending = null;
  try {
    getStorage()?.removeItem(AUTOSAVE_KEY);
  } catch {
    // Best effort.
  }
}

/** Restores the last autosave. A corrupt save is moved to the backup key and null is returned. */
export function loadAutosave(): Board | null {
  const storage = getStorage();
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(AUTOSAVE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  const res = parseBoard(raw);
  if (res.ok) return res.board;
  try {
    storage.setItem(AUTOSAVE_BACKUP_KEY, raw);
    storage.removeItem(AUTOSAVE_KEY);
  } catch {
    // Backup is best effort; the corrupt data stays under the main key in that case.
  }
  problem = IO_TEXT.autosaveCorrupt;
  return null;
}

/** Returns (and clears) the latest autosave problem message for the UI to show, if any. */
export function takeAutosaveProblem(): string | null {
  const p = problem;
  problem = null;
  return p;
}
