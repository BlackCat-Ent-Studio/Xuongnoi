import type { Board } from '../engine/types';
import { parseBoard, serializeBoard } from './save-format';
import { IO_TEXT } from './text-vi';

/** Index of the library: a JSON array of LibraryEntry. Absent until the library is first set up. */
export const LIBRARY_INDEX_KEY = 'xuong-noi:library-index';
/** One key per game, holding the board in the normal save format. */
export const LIBRARY_GAME_PREFIX = 'xuong-noi:library-game:';
/** Id of the library entry the editor is currently working on; absent while the board is not in the library yet. */
export const LIBRARY_CURRENT_KEY = 'xuong-noi:library-current';
export const LIBRARY_NAME_MAX = 80;

export interface LibraryEntry {
  id: string;
  name: string;
  /** Milliseconds since epoch of the last change. */
  updatedAt: number;
}

export type LibraryResult = { ok: true; id: string } | { ok: false; error: string };
export type LibraryLoad = { ok: true; board: Board } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** localStorage may be missing (node tests) or throw on access (privacy modes). */
function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function isEntry(v: unknown): v is LibraryEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === 'string' && typeof e.name === 'string' && typeof e.updatedAt === 'number' && Number.isFinite(e.updatedAt);
}

/** A board nobody has touched yet: empty and still carrying the default name. */
export function isUntouchedBoard(board: Board): boolean {
  return board.graph.nodes.length === 0 && (board.notes?.length ?? 0) === 0 && board.name === IO_TEXT.newBoardName;
}

/** Collects the games still stored under their own keys when the index itself is unreadable. */
function rebuildIndex(s: Storage): LibraryEntry[] {
  const entries: LibraryEntry[] = [];
  for (let i = 0; i < s.length; i++) {
    const key = s.key(i);
    if (!key || !key.startsWith(LIBRARY_GAME_PREFIX)) continue;
    const raw = s.getItem(key);
    const res = raw === null ? null : parseBoard(raw);
    if (res?.ok) entries.push({ id: key.slice(LIBRARY_GAME_PREFIX.length), name: res.board.name, updatedAt: 0 });
  }
  return entries;
}

/** The stored index, or null when the library was never set up. A damaged index is rebuilt from the game keys. */
function readIndex(s: Storage): LibraryEntry[] | null {
  let raw: string | null;
  try {
    raw = s.getItem(LIBRARY_INDEX_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (Array.isArray(data)) return data.filter(isEntry);
  } catch {
    // Falls through to the rebuild below.
  }
  try {
    return rebuildIndex(s);
  } catch {
    return [];
  }
}

function newId(): string {
  return `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Writes the game then the index. A failure leaves no half-created entry behind. */
function putGame(s: Storage, entries: LibraryEntry[], id: string, board: Board): LibraryResult {
  const isNew = !entries.some((e) => e.id === id);
  const entry: LibraryEntry = { id, name: board.name, updatedAt: Date.now() };
  try {
    s.setItem(LIBRARY_GAME_PREFIX + id, serializeBoard(board));
    s.setItem(LIBRARY_INDEX_KEY, JSON.stringify([...entries.filter((e) => e.id !== id), entry]));
  } catch {
    if (isNew) {
      try {
        s.removeItem(LIBRARY_GAME_PREFIX + id);
      } catch {
        // Nothing more to do: the index does not list it.
      }
    }
    return fail(IO_TEXT.libraryFull);
  }
  return { ok: true, id };
}

function readCurrentId(s: Storage): string | null {
  try {
    return s.getItem(LIBRARY_CURRENT_KEY);
  } catch {
    return null;
  }
}

function writeCurrentId(s: Storage, id: string | null): void {
  try {
    if (id === null) s.removeItem(LIBRARY_CURRENT_KEY);
    else s.setItem(LIBRARY_CURRENT_KEY, id);
  } catch {
    // Best effort: without it the next edit simply starts a new entry.
  }
}

/** Entries, most recently changed first. */
export function listGames(): LibraryEntry[] {
  const s = getStorage();
  if (!s) return [];
  const entries = readIndex(s) ?? [];
  // Reverse first so that entries changed within the same millisecond list the newest write on top.
  return [...entries].reverse().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Id of the entry being edited, or null when the editor holds a game that is not in the library yet. */
export function getCurrentGameId(): string | null {
  const s = getStorage();
  if (!s) return null;
  const id = readCurrentId(s);
  if (id === null) return null;
  return (readIndex(s) ?? []).some((e) => e.id === id) ? id : null;
}

/** Points the editor at a library entry, or at none (null): the next edit then creates a new entry. */
export function setCurrentGameId(id: string | null): void {
  const s = getStorage();
  if (s) writeCurrentId(s, id);
}

/**
 * First-run setup. Moves the single pre-library autosave into the library as one entry.
 * Does nothing once the library exists.
 */
export function ensureLibrary(legacy: Board | null): void {
  const s = getStorage();
  if (!s || readIndex(s) !== null) return;
  try {
    s.setItem(LIBRARY_INDEX_KEY, '[]');
  } catch {
    return;
  }
  if (!legacy || isUntouchedBoard(legacy)) return;
  const res = putGame(s, [], newId(), legacy);
  if (res.ok) writeCurrentId(s, res.id);
}

/**
 * Stores the board the editor is working on: updates the current entry, or creates one when the board
 * is not in the library yet and has been touched. Returns null when there was nothing to store.
 */
export function saveCurrentGame(board: Board): LibraryResult | null {
  const s = getStorage();
  if (!s) return null;
  const entries = readIndex(s) ?? [];
  const stored = readCurrentId(s);
  let id = stored !== null && entries.some((e) => e.id === stored) ? stored : null;
  if (id === null) {
    if (isUntouchedBoard(board)) return null;
    id = newId();
  }
  const res = putGame(s, entries, id, board);
  if (res.ok && id !== stored) writeCurrentId(s, id);
  return res;
}

export function loadGame(id: string): LibraryLoad {
  const s = getStorage();
  if (!s) return fail(IO_TEXT.libraryUnavailable);
  let raw: string | null;
  try {
    raw = s.getItem(LIBRARY_GAME_PREFIX + id);
  } catch {
    return fail(IO_TEXT.libraryUnavailable);
  }
  if (raw === null) return fail(IO_TEXT.libraryMissing);
  const res = parseBoard(raw);
  return res.ok ? res : fail(IO_TEXT.libraryCorrupt(res.error));
}

export function renameGame(id: string, name: string): LibraryResult {
  const clean = name.trim().slice(0, LIBRARY_NAME_MAX);
  if (clean === '') return fail(IO_TEXT.libraryNameEmpty);
  const s = getStorage();
  if (!s) return fail(IO_TEXT.libraryUnavailable);
  const loaded = loadGame(id);
  if (!loaded.ok) return loaded;
  return putGame(s, readIndex(s) ?? [], id, { ...loaded.board, name: clean });
}

/** Copies a stored game into a new entry. The copy never becomes the current game. */
export function duplicateGame(id: string): LibraryResult {
  const s = getStorage();
  if (!s) return fail(IO_TEXT.libraryUnavailable);
  const loaded = loadGame(id);
  if (!loaded.ok) return loaded;
  const name = IO_TEXT.libraryCopyName(loaded.board.name).slice(0, LIBRARY_NAME_MAX);
  return putGame(s, readIndex(s) ?? [], newId(), { ...structuredClone(loaded.board), name });
}

export function deleteGame(id: string): LibraryResult {
  const s = getStorage();
  if (!s) return fail(IO_TEXT.libraryUnavailable);
  try {
    const entries = readIndex(s) ?? [];
    s.setItem(LIBRARY_INDEX_KEY, JSON.stringify(entries.filter((e) => e.id !== id)));
    s.removeItem(LIBRARY_GAME_PREFIX + id);
  } catch {
    return fail(IO_TEXT.libraryUnavailable);
  }
  if (readCurrentId(s) === id) writeCurrentId(s, null);
  return { ok: true, id };
}
