import { describe, expect, it } from 'vitest';
import { createUiPrefs, loadMode, loadTheme, MODE_KEY, parseMode, parseTheme, THEME_KEY, themeFromSystem } from '../../src/editor/theme/ui-prefs';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}
function fakeRoot() {
  const attrs: Record<string, string> = {};
  return { attrs, setAttribute: (n: string, v: string) => void (attrs[n] = v) };
}

describe('theme and mode defaults', () => {
  it('first open follows the system colour scheme and starts in the student mode', () => {
    expect(themeFromSystem(true)).toBe('dark');
    expect(themeFromSystem(false)).toBe('light');
    expect(loadTheme(memoryStorage(), true)).toBe('dark');
    expect(loadTheme(memoryStorage(), false)).toBe('light');
    expect(loadMode(memoryStorage())).toBe('student');
  });

  it('a saved choice beats the system setting', () => {
    expect(loadTheme(memoryStorage({ [THEME_KEY]: 'light' }), true)).toBe('light');
    expect(loadTheme(memoryStorage({ [THEME_KEY]: 'dark' }), false)).toBe('dark');
    expect(loadMode(memoryStorage({ [MODE_KEY]: 'teacher' }))).toBe('teacher');
  });

  it('ignores unknown stored values and unreadable storage', () => {
    expect(parseTheme('blue')).toBeNull();
    expect(parseMode('')).toBeNull();
    expect(loadTheme(memoryStorage({ [THEME_KEY]: 'blue' }), true)).toBe('dark');
    expect(loadMode(memoryStorage({ [MODE_KEY]: 'admin' }))).toBe('student');
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadTheme(broken, false)).toBe('light');
    expect(loadMode(broken)).toBe('student');
    expect(loadTheme(null, true)).toBe('dark');
  });
});

describe('createUiPrefs', () => {
  it('puts data-theme and data-mode on the root at creation', () => {
    const root = fakeRoot();
    createUiPrefs({ storage: memoryStorage(), prefersDark: true, root });
    expect(root.attrs).toEqual({ 'data-theme': 'dark', 'data-mode': 'student' });
  });

  it('the theme switch flips, saves per device, repaints and tells listeners', () => {
    const storage = memoryStorage();
    const root = fakeRoot();
    const prefs = createUiPrefs({ storage, prefersDark: false, root });
    let calls = 0;
    prefs.subscribe(() => calls++);
    prefs.toggleTheme();
    expect(prefs.theme()).toBe('dark');
    expect(root.attrs['data-theme']).toBe('dark');
    expect(storage.data.get(THEME_KEY)).toBe('dark');
    prefs.toggleTheme();
    expect(prefs.theme()).toBe('light');
    expect(storage.data.get(THEME_KEY)).toBe('light');
    expect(calls).toBe(2);
    // The system theme is not written until the user chooses: only the choice is remembered.
    expect(storage.data.has(MODE_KEY)).toBe(false);
  });

  it('the mode switch saves, repaints and does nothing when the mode is already set', () => {
    const storage = memoryStorage();
    const root = fakeRoot();
    const prefs = createUiPrefs({ storage, prefersDark: false, root });
    let calls = 0;
    const off = prefs.subscribe(() => calls++);
    prefs.setMode('student');
    expect(calls).toBe(0);
    expect(storage.data.has(MODE_KEY)).toBe(false);
    prefs.setMode('teacher');
    expect(prefs.mode()).toBe('teacher');
    expect(root.attrs['data-mode']).toBe('teacher');
    expect(storage.data.get(MODE_KEY)).toBe('teacher');
    expect(calls).toBe(1);
    off();
    prefs.setMode('student');
    expect(calls).toBe(1);
  });

  it('a new page load restores the saved choice', () => {
    const storage = memoryStorage();
    const first = createUiPrefs({ storage, prefersDark: false, root: fakeRoot() });
    first.setTheme('dark');
    first.setMode('teacher');
    const root = fakeRoot();
    const second = createUiPrefs({ storage, prefersDark: false, root });
    expect(second.theme()).toBe('dark');
    expect(second.mode()).toBe('teacher');
    expect(root.attrs).toEqual({ 'data-theme': 'dark', 'data-mode': 'teacher' });
  });

  it('keeps working when storage refuses writes', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    const prefs = createUiPrefs({ storage, prefersDark: false, root: null });
    expect(() => prefs.setTheme('dark')).not.toThrow();
    expect(prefs.theme()).toBe('dark');
  });
});
