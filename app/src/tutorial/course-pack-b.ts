import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * Lessons added for the course (pack B). The shared builders of `lessons.ts` arrive through `LessonKit`;
 * the menu order comes from COURSE in course.ts, so the order here does not matter.
 */
export function createCoursePackB(_kit: LessonKit): Lesson[] {
  return [];
}
