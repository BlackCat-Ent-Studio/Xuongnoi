import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Kinds this pack is to teach. No lesson is written yet; the handbook page and its "Thử ngay" board explain the piece. */
export const COVERS: readonly string[] = ['container'];

/** Lessons about cages that collect and count goods. The menu order comes from COURSE in course.ts. */
export function createCoursePackP(_kit: LessonKit): Lesson[] {
  return [];
}
