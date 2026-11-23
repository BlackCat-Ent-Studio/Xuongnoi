import type { Board } from '../engine/types';
import { parseBoard, serializeBoard } from './save-format';
import { IO_TEXT } from './text-vi';

export const AUTOSAVE_KEY = 'xuong-noi:autosave';
export const AUTOSAVE_BACKUP_KEY = 'xuong-noi:autosave-backup';
export const AUTOSAVE_DELAY_MS = 1000;

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Board | null = null;
let problem: string | null = null;

/** localStorage may be missing (node tests) or throw on access (privacy modes). */
function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function writeNow(board: Board): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(AUTOSAVE_KEY, serializeBoard(board));
  } catch {
    problem = IO_TEXT.autosaveFailed;
  }
}

/** Debounced write: only the latest board within the window is saved. */
export function scheduleAutosave(board: Board): void {
  pending = board;
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
    const board = pending;
    pending = null;
    writeNow(board);
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
