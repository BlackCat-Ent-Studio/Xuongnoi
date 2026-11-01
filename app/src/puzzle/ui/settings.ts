/**
 * Player settings of the puzzle game (music and sound effects on/off), kept in localStorage.
 * Screens read `getSettings()` and change values with `setSettings()`; the sound module listens with `onSettingsChange()`.
 */

export const SETTINGS_KEY = 'xuongnoi.puzzle.settings';

export interface PuzzleSettings {
  /** Background music. */
  music: boolean;
  /** Short sound effects (taps, wires, win, lose). */
  sfx: boolean;
}

export const DEFAULT_SETTINGS: Readonly<PuzzleSettings> = { music: true, sfx: true };

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // storage blocked
  }
}

/** Reads saved settings; anything missing or malformed falls back to the default. */
export function loadSettings(storage: StorageLike | null = defaultStorage()): PuzzleSettings {
  const out: PuzzleSettings = { ...DEFAULT_SETTINGS };
  if (!storage) return out;
  try {
    const data: unknown = JSON.parse(storage.getItem(SETTINGS_KEY) ?? 'null');
    if (typeof data !== 'object' || data === null) return out;
    const d = data as Partial<Record<keyof PuzzleSettings, unknown>>;
    if (typeof d.music === 'boolean') out.music = d.music;
    if (typeof d.sfx === 'boolean') out.sfx = d.sfx;
  } catch {
    // ignore broken data
  }
  return out;
}

let current: PuzzleSettings | null = null;
const listeners = new Set<(s: Readonly<PuzzleSettings>) => void>();

export function getSettings(): Readonly<PuzzleSettings> {
  current ??= loadSettings();
  return current;
}

/** Changes some settings, saves them and tells the listeners. */
export function setSettings(patch: Partial<PuzzleSettings>, storage: StorageLike | null = defaultStorage()): void {
  current = { ...getSettings(), ...patch };
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(current));
  } catch {
    // full or blocked: the change still applies for this visit
  }
  for (const fn of listeners) fn(current);
}

/** Subscribes to changes; returns the unsubscribe function. */
export function onSettingsChange(fn: (s: Readonly<PuzzleSettings>) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
