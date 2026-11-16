import { createPistonPushLesson } from './lesson-piston-push';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Robot lessons that use the linear actuator. The menu order comes from COURSE in course.ts. */
export function createCoursePackK(kit: LessonKit): Lesson[] {
  return [createPistonPushLesson(kit)];
}
