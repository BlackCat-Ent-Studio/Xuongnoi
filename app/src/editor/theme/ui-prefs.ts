/**
 * Look of the editor: a colour theme (light / dark) and a display mode (Học sinh / Giáo viên).
 * Both are remembered per device; until the user chooses, the theme follows the operating system and the mode is "student".
 * The choice is written to `data-theme` / `data-mode` on the root element, which is all the stylesheets key on
 * (the puzzle page never sets them, so it keeps its own look).
 */

export type UiTheme = 'light' | 'dark';
export type UiMode = 'student' | 'teacher';

export const UI_THEMES: readonly UiTheme[] = ['light', 'dark'];
export const UI_MODES: readonly UiMode[] = ['student', 'teacher'];
export const THEME_KEY = 'xuong-noi:theme';
export const MODE_KEY = 'xuong-noi:ui-mode';
export const DEFAULT_MODE: UiMode = 'student';

export const parseTheme = (raw: string | null | undefined): UiTheme | null => UI_THEMES.find((t) => t === raw) ?? null;
export const parseMode = (raw: string | null | undefined): UiMode | null => UI_MODES.find((m) => m === raw) ?? null;

/** What a device with no saved choice gets: the operating system's setting. */
export const themeFromSystem = (prefersDark: boolean): UiTheme => (prefersDark ? 'dark' : 'light');

type ReadStorage = Pick<Storage, 'getItem'>;
type WriteStorage = Pick<Storage, 'setItem'>;

function readKey(storage: ReadStorage | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Saved theme, else the system one. */
export function loadTheme(storage: ReadStorage | null, prefersDark: boolean): UiTheme {
  return parseTheme(readKey(storage, THEME_KEY)) ?? themeFromSystem(prefersDark);
}

/** Saved mode, else "student". */
export function loadMode(storage: ReadStorage | null): UiMode {
  return parseMode(readKey(storage, MODE_KEY)) ?? DEFAULT_MODE;
}

export interface UiPrefsDeps {
  storage: (ReadStorage & WriteStorage) | null;
  prefersDark: boolean;
  /** Receives `data-theme` / `data-mode`; the page's root element. */
  root: { setAttribute(name: string, value: string): void } | null;
}

export interface UiPrefs {
  theme(): UiTheme;
  mode(): UiMode;
  setTheme(theme: UiTheme): void;
  setMode(mode: UiMode): void;
  toggleTheme(): void;
  /** Called after every change (not on creation). Returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
}

export function createUiPrefs(deps: UiPrefsDeps): UiPrefs {
  let theme = loadTheme(deps.storage, deps.prefersDark);
  let mode = loadMode(deps.storage);
  const listeners = new Set<() => void>();
  const apply = (): void => {
    deps.root?.setAttribute('data-theme', theme);
    deps.root?.setAttribute('data-mode', mode);
  };
  const save = (key: string, value: string): void => {
    try {
      deps.storage?.setItem(key, value);
    } catch {
      // Storage can be blocked or full; the choice then only lasts for this session.
    }
  };
  apply();
  const prefs: UiPrefs = {
    theme: () => theme,
    mode: () => mode,
    setTheme(next) {
      if (next === theme) return;
      theme = next;
      save(THEME_KEY, next);
      apply();
      for (const fn of listeners) fn();
    },
    setMode(next) {
      if (next === mode) return;
      mode = next;
      save(MODE_KEY, next);
      apply();
      for (const fn of listeners) fn();
    },
    toggleTheme: () => prefs.setTheme(theme === 'dark' ? 'light' : 'dark'),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return prefs;
}

let shared: UiPrefs | null = null;

/** The page's preferences, created on first use from localStorage, the system colour scheme and `<html>`. */
export function uiPrefs(): UiPrefs {
  if (shared) return shared;
  let storage: Storage | null = null;
  try {
    storage = typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    storage = null;
  }
  let prefersDark = false;
  try {
    prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    prefersDark = false;
  }
  shared = createUiPrefs({ storage, prefersDark, root: typeof document === 'undefined' ? null : document.documentElement });
  return shared;
}
