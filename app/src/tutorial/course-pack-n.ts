import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Kinds this pack is to teach. Their two lessons are in course-pack-r.ts; this pack itself has no lesson. */
export const COVERS: readonly string[] = ['grid-route', 'cell-hold'];

/** Lessons about several robots sharing a floor of one-way lanes. The menu order comes from COURSE in course.ts. */
export function createCoursePackN(_kit: LessonKit): Lesson[] {
  return [];
}
