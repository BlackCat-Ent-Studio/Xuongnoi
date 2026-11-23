import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Kinds this pack is to teach. No lesson is written yet; the handbook pages and their "Thử ngay" boards explain the pieces. */
export const COVERS: readonly string[] = ['grid-route', 'cell-hold'];

/** Lessons about several robots sharing a floor of one-way lanes. The menu order comes from COURSE in course.ts. */
export function createCoursePackN(_kit: LessonKit): Lesson[] {
  return [];
}
