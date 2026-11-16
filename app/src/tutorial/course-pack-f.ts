import { createTwoMotorRobotLesson } from './lesson-two-motor-robot';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * Lessons added for the robot pieces (pack F). The shared builders of `lessons.ts` arrive through `LessonKit`;
 * the menu order comes from COURSE in course.ts, so the order here does not matter.
 */
export function createCoursePackF(kit: LessonKit): Lesson[] {
  return [createTwoMotorRobotLesson(kit)];
}
