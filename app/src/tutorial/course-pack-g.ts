import { createLineEyesLesson } from './lesson-line-eyes';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Lessons of the robot pieces (pack G). The menu order comes from COURSE in course.ts. */
export function createCoursePackG(kit: LessonKit): Lesson[] {
  return [createLineEyesLesson(kit)];
}
