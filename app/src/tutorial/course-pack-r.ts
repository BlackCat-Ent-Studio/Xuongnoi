import { createGridFindWayLesson } from './lesson-grid-find-way';
import { createTwoRobotsOneCellLesson } from './lesson-two-robots-one-cell';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Kinds these lessons teach. */
export const COVERS: readonly string[] = ['grid-route', 'cell-hold'];

/** Robot lessons about a floor of numbered cells with arrows. The menu order comes from COURSE in course.ts. */
export function createCoursePackR(kit: LessonKit): Lesson[] {
  return [createGridFindWayLesson(kit), createTwoRobotsOneCellLesson(kit)];
}
