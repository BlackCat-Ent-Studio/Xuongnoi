import { createWeightForceLesson } from './lesson-weight-force';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Lessons on real quantities (kg, N). The menu order comes from COURSE in course.ts. */
export function createCoursePackI(kit: LessonKit): Lesson[] {
  return [createWeightForceLesson(kit)];
}
