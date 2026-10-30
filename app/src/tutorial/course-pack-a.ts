import { createChaseGameLesson } from './lesson-chase-game';
import { createColliderGravityLesson } from './lesson-collider-gravity';
import { createConveyorLesson } from './lesson-conveyor';
import { createSecretDoorLesson } from './lesson-secret-door';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * Lessons added for the course (pack A). The shared builders of `lessons.ts` arrive through `LessonKit`;
 * the menu order comes from COURSE in course.ts, so the order here does not matter.
 */
export function createCoursePackA(kit: LessonKit): Lesson[] {
  return [
    createSecretDoorLesson(kit),
    createChaseGameLesson(kit),
    createColliderGravityLesson(kit),
    createConveyorLesson(kit),
  ];
}
