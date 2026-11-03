import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRunner } from '../../src/tutorial/runner';
import {
  PROGRESS_KEY,
  STASH_KEY,
  SEEN_KEY,
  clearStash,
  hasSeenInvite,
  loadProgress,
  markInviteSeen,
  saveProgress,
  takeStash,
  writeStash,
} from '../../src/tutorial/storage';
import type { Lesson, Snapshot } from '../../src/tutorial/types';

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  graph: { nodes: [], wires: [] },
  mode: '2d-side',
  playing: false,
  ended: null,
  ...over,
});

const lesson: Lesson = {
  id: 't',
  title: 'T',
  summary: '',
  createBoard: () => ({ name: 'x', mode: '2d-side', graph: { nodes: [], wires: [], settings: { wireRule: true } } }),
  steps: [
    { id: 'a', title: 'a', text: 'a' },
    { id: 'b', title: 'b', text: 'b', check: (s) => s.playing },
    { id: 'c', title: 'c', text: 'c', check: (s) => s.playing },
    { id: 'd', title: 'd', text: 'd' },
  ],
};

describe('runner', () => {
  it('waits on info steps and advances over passing checks', () => {
    const r = createRunner(lesson);
    expect(r.evaluate(snap({ playing: true }))).toBe(false); // info step never auto-advances
    r.next();
    expect(r.step().id).toBe('b');
    expect(r.evaluate(snap({ playing: false }))).toBe(false);
    expect(r.evaluate(snap({ playing: true }))).toBe(true);
    expect(r.step().id).toBe('d'); // b and c both satisfied
  });

  it('holds a step after going back until Tiếp', () => {
    const r = createRunner(lesson);
    r.next();
    r.evaluate(snap({ playing: true }));
    r.back();
    expect(r.step().id).toBe('c');
    expect(r.isHeld()).toBe(true);
    expect(r.evaluate(snap({ playing: true }))).toBe(false);
    r.next();
    expect(r.isHeld()).toBe(false);
    expect(r.step().id).toBe('d');
  });

  it('finishes after the last step and cannot go back from the first', () => {
    const r = createRunner(lesson);
    r.back();
    expect(r.index()).toBe(0);
    r.next();
    r.next();
    r.next();
    expect(r.isLast()).toBe(true);
    expect(r.isFinished()).toBe(false);
    r.next();
    expect(r.isFinished()).toBe(true);
  });

  it('rejects an empty lesson', () => {
    expect(() => createRunner({ ...lesson, steps: [] })).toThrow();
  });
});

describe('storage', () => {
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('remembers the invite was answered', () => {
    expect(hasSeenInvite()).toBe(false);
    markInviteSeen();
    expect(mem.has(SEEN_KEY)).toBe(true);
    expect(hasSeenInvite()).toBe(true);
  });

  it('round-trips progress and ignores corrupt data', () => {
    saveProgress(new Set(['a', 'b']));
    expect([...loadProgress()].sort()).toEqual(['a', 'b']);
    mem.set(PROGRESS_KEY, '{oops');
    expect(loadProgress().size).toBe(0);
    mem.set(PROGRESS_KEY, '{"a":1}');
    expect(loadProgress().size).toBe(0);
    mem.set(PROGRESS_KEY, '["a", 3, "b"]');
    expect([...loadProgress()]).toEqual(['a', 'b']);
  });

  it('stashes a board, hands it back once, and survives garbage', () => {
    const board = lesson.createBoard();
    writeStash(board);
    expect(mem.has(STASH_KEY)).toBe(true);
    expect(takeStash()).toEqual(board);
    expect(mem.has(STASH_KEY)).toBe(false);
    expect(takeStash()).toBeNull();
    mem.set(STASH_KEY, 'not json');
    expect(takeStash()).toBeNull();
    writeStash(board);
    clearStash();
    expect(takeStash()).toBeNull();
  });

  it('works without localStorage at all', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(hasSeenInvite()).toBe(false);
    expect(() => markInviteSeen()).not.toThrow();
    expect(takeStash()).toBeNull();
  });
});
