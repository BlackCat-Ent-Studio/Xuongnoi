import { createRobotArmLesson } from './lesson-robot-arm';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Robot lessons that use the arm pieces. The menu order comes from COURSE in course.ts. */
export function createCoursePackJ(kit: LessonKit): Lesson[] {
  return [createRobotArmLesson(kit)];
}
