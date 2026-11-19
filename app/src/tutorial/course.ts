import { migrateBoardWireRule } from '../editor/graph/wire-rule-migration';
import { withStartWireSteps } from './start-wire-steps';
import type { Lesson } from './types';

/** One chapter of the course: a heading in the lesson menu and the lessons under it, easiest first. */
export interface Chapter {
  id: string;
  title: string;
  lessonIds: readonly string[];
  /** Kept registered (tests, coverage, saved progress) but hidden from the lesson menu and numbering. */
  archived?: boolean;
}

/**
 * The whole course, in teaching order. Lesson ids listed here but not registered yet are skipped, so a
 * chapter can name lessons before they are written. Registered lessons missing from this list go last.
 * Archived chapters stay at the end so the numbers of the shown lessons run 1, 2, 3... without gaps.
 */
export const COURSE: readonly Chapter[] = [
  { id: 'basics', title: 'Làm quen', lessonIds: ['walk-jump', 'collect-stars', 'win-lose', 'secret-door', 'step-run'] },
  { id: 'robots', title: 'Robot', lessonIds: ['two-motor-robot', 'line-eyes', 'pid-control', 'weight-force', 'robot-arm', 'arm-steps', 'piston-push', 'robot-to-marker', 'share-jobs'] },
  { id: 'items', title: 'Đồ vật', lessonIds: ['carry-use', 'hand-tools', 'ui-chest'] },
  { id: 'bots', title: 'Bot tự động', lessonIds: ['make-bot', 'chores', 'chores-place', 'bot-pickaxe', 'chase-game', 'bot-senses', 'tidy-bot', 'nearest-bot', 'two-goals-bot', 'sight-forecast'] },
  { id: 'world', title: 'Thế giới', lessonIds: ['chance-zones', 'camera-portals', 'collider-gravity', 'conveyor'] },
  { id: 'vehicles', title: 'Xe cộ', lessonIds: ['vehicles', 'bot-driver', 'route-traffic', 'train'] },
  { id: 'delivery', title: 'Giao hàng', lessonIds: ['cargo-delivery', 'guide-arrow'] },
  { id: 'numbers-ui', title: 'Số và giao diện', lessonIds: ['health-color', 'start-screen', 'ask-dialog'] },
  { id: 'real-games', title: 'Dự án tổng hợp', lessonIds: ['editor-tools', 'groups', 'capstone-factory'] },
  { id: 'fighting', title: 'Đánh nhau', lessonIds: ['combat', 'platforms-shooting'], archived: true },
];

/** True for a lesson of an archived chapter: registered and testable, but not offered in the menus. */
export function isArchivedLesson(lessonId: string): boolean {
  return chapterOf(lessonId)?.archived === true;
}

/** A lesson title without its leading number ("3. Thắng và thua" -> "Thắng và thua"). */
export function lessonName(title: string): string {
  return title.replace(/^\d+\.\s*/, '');
}

/** Orders lessons by the course and renumbers their titles 1, 2, 3... in that order. */
export function arrangeCourse(all: readonly Lesson[]): Lesson[] {
  const byId = new Map(all.map((l) => [l.id, l]));
  const listed = new Set(COURSE.flatMap((c) => c.lessonIds));
  const ordered = [
    ...COURSE.flatMap((c) => c.lessonIds.map((id) => byId.get(id)).filter((l): l is Lesson => l !== undefined)),
    ...all.filter((l) => !listed.has(l.id)),
  ];
  // A lesson's starting board follows the wire rule like any other board (see wire-rule-migration).
  return ordered.map((raw, i) => {
    const l = withStartWireSteps(raw);
    return { ...l, title: `${i + 1}. ${lessonName(l.title)}`, createBoard: () => migrateBoardWireRule(l.createBoard()) };
  });
}

/** The chapter a lesson belongs to, or undefined for a lesson outside the course list. */
export function chapterOf(lessonId: string): Chapter | undefined {
  return COURSE.find((c) => c.lessonIds.includes(lessonId));
}
