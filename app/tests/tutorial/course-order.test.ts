import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COURSE, arrangeCourse, chapterOf, isArchivedLesson } from '../../src/tutorial/course';
import { LESSONS } from '../../src/tutorial/lessons';
import { loadProgress, saveProgress } from '../../src/tutorial/storage';

describe('course order for education', () => {
  it('puts Robot right after Làm quen and renames the education chapters', () => {
    const shown = COURSE.filter((c) => !c.archived);
    expect(shown.slice(0, 2).map((c) => c.id)).toEqual(['basics', 'robots']);
    expect(shown.map((c) => c.title)).toEqual([
      'Làm quen', 'Robot', 'Đồ vật', 'Bot tự động', 'Thế giới', 'Xe cộ', 'Giao hàng', 'Số và giao diện', 'Dự án tổng hợp',
    ]);
  });

  it('archives the pure-game chapter but keeps its lessons registered', () => {
    const fighting = COURSE.find((c) => c.id === 'fighting')!;
    expect(fighting.archived).toBe(true);
    expect(fighting.lessonIds).toEqual(['combat', 'platforms-shooting']);
    expect(isArchivedLesson('combat')).toBe(true);
    expect(isArchivedLesson('walk-jump')).toBe(false);
    expect(chapterOf('platforms-shooting')?.id).toBe('fighting');
    for (const id of fighting.lessonIds) expect(LESSONS.some((l) => l.id === id)).toBe(true);
  });

  it('numbers the shown lessons without gaps and puts archived ones last', () => {
    const nums = LESSONS.map((l) => Number(/^(\d+)\./.exec(l.title)![1]));
    expect(nums).toEqual(nums.map((_, i) => i + 1));
    const firstArchived = LESSONS.findIndex((l) => isArchivedLesson(l.id));
    expect(LESSONS.slice(firstArchived).every((l) => isArchivedLesson(l.id))).toBe(true);
    expect(arrangeCourse(LESSONS).length).toBe(LESSONS.length);
  });

  it('every lesson id of the old course is still a registered lesson (progress is stored by id)', () => {
    const oldIds = [
      'walk-jump', 'collect-stars', 'win-lose', 'secret-door', 'step-run', 'carry-use', 'hand-tools', 'ui-chest',
      'make-bot', 'chores', 'chores-place', 'bot-pickaxe', 'chase-game', 'bot-senses', 'tidy-bot', 'nearest-bot', 'two-goals-bot', 'sight-forecast',
      'combat', 'platforms-shooting', 'chance-zones', 'camera-portals', 'collider-gravity', 'conveyor', 'vehicles', 'bot-driver', 'route-traffic', 'train',
      'two-motor-robot', 'line-eyes', 'pid-control', 'weight-force', 'robot-arm', 'cargo-delivery', 'guide-arrow', 'health-color', 'start-screen', 'ask-dialog',
      'editor-tools', 'groups', 'capstone-factory',
    ];
    const registered = new Set(LESSONS.map((l) => l.id));
    for (const id of oldIds) expect(registered.has(id), id).toBe(true);
  });
});

describe('saved progress survives the reorganisation', () => {
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

  it('ticks saved before the move still match lessons in their new chapters, archived ones included', () => {
    saveProgress(new Set(['walk-jump', 'two-motor-robot', 'combat']));
    const done = loadProgress();
    const marked = LESSONS.filter((l) => done.has(l.id)).map((l) => [l.id, chapterOf(l.id)?.id]);
    expect(marked).toEqual([
      ['walk-jump', 'basics'],
      ['two-motor-robot', 'robots'],
      ['combat', 'fighting'],
    ]);
  });
});
