import { createCargoDeliveryLesson } from './lesson-cargo-delivery';
import { createGuideArrowLesson } from './lesson-guide-arrow';
import { createRouteTrafficLesson } from './lesson-route-traffic';
import { createTrainLesson } from './lesson-train';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * Lessons added for the course (pack B). The shared builders of `lessons.ts` arrive through `LessonKit`;
 * the menu order comes from COURSE in course.ts, so the order here does not matter.
 */
export function createCoursePackB(kit: LessonKit): Lesson[] {
  return [createRouteTrafficLesson(kit), createTrainLesson(kit), createCargoDeliveryLesson(kit), createGuideArrowLesson(kit)];
}
