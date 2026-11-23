import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUTOSAVE_BACKUP_KEY,
  AUTOSAVE_KEY,
  flushAutosave,
  loadAutosave,
  scheduleAutosave,
  takeAutosaveProblem,
} from '../../src/io/autosave';
import { createEmptyBoard, serializeBoard } from '../../src/io';

function fakeStorage(): Storage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('autosave', () => {
  let storage: ReturnType<typeof fakeStorage>;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    flushAutosave();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('debounces: only the last board is written, 1 s after the last change', () => {
    const a = { ...createEmptyBoard('3d'), name: 'A' };
    const b = { ...createEmptyBoard('3d'), name: 'B' };
    scheduleAutosave(a);
    vi.advanceTimersByTime(600);
    scheduleAutosave(b);
    vi.advanceTimersByTime(600);
    expect(storage.data.has(AUTOSAVE_KEY)).toBe(false);
    vi.advanceTimersByTime(400);
    expect(storage.data.get(AUTOSAVE_KEY)).toBe(serializeBoard(b));
    expect(loadAutosave()).toEqual(b);
  });

  it('flush writes immediately', () => {
    scheduleAutosave(createEmptyBoard('2d-top'));
    flushAutosave();
    expect(storage.data.has(AUTOSAVE_KEY)).toBe(true);
  });

  it('returns null when nothing is saved', () => {
    expect(loadAutosave()).toBeNull();
  });

  it('moves corrupt data to the backup key and returns null', () => {
    storage.setItem(AUTOSAVE_KEY, '{broken');
    expect(loadAutosave()).toBeNull();
    expect(storage.data.get(AUTOSAVE_BACKUP_KEY)).toBe('{broken');
    expect(storage.data.has(AUTOSAVE_KEY)).toBe(false);
    expect(takeAutosaveProblem()).toContain('hỏng');
    expect(takeAutosaveProblem()).toBeNull();
  });

  it('reports a problem instead of throwing when storage is full', () => {
    storage.setItem = () => {
      throw new Error('quota');
    };
    scheduleAutosave(createEmptyBoard('3d'));
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(takeAutosaveProblem()).toContain('tự động');
  });

  it('is a no-op without localStorage', () => {
    vi.unstubAllGlobals();
    expect(loadAutosave()).toBeNull();
    scheduleAutosave(createEmptyBoard('3d'));
    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
  });
});
