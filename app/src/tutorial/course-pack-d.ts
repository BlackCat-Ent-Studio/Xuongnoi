import { createCapstoneFactoryLesson } from './lesson-capstone-factory';
import { createGroupsLesson } from './lesson-groups';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * Lessons added for the course (pack D). The shared builders of `lessons.ts` arrive through `LessonKit`;
 * the menu order comes from COURSE in course.ts, so the order here does not matter.
 */
export function createCoursePackD(kit: LessonKit): Lesson[] {
  return [createGroupsLesson(kit), createCapstoneFactoryLesson(kit)];
}
