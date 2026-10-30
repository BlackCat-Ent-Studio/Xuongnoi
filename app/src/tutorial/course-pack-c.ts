import { createAskDialogLesson } from './lesson-ask-dialog';
import { createHealthColorLesson } from './lesson-health-color';
import { createStartScreenLesson } from './lesson-start-screen';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * Lessons added for the course (pack C). The shared builders of `lessons.ts` arrive through `LessonKit`;
 * the menu order comes from COURSE in course.ts, so the order here does not matter.
 */
export function createCoursePackC(kit: LessonKit): Lesson[] {
  return [createHealthColorLesson(kit), createStartScreenLesson(kit), createAskDialogLesson(kit)];
}
