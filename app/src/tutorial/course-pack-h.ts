import { createPidControlLesson } from './lesson-pid-control';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Lessons for the robot control pieces (pack H). The menu order comes from COURSE in course.ts. */
export function createCoursePackH(kit: LessonKit): Lesson[] {
  return [createPidControlLesson(kit)];
}
