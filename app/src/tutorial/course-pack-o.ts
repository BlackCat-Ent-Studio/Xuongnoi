import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/**
 * Parcel codes. No lesson teaches these pieces yet: their handbook pages and "Thử ngay" boards do. The pieces are named
 * here so the course keeps track of them; a lesson is added to this pack (and the pack to lessons.ts) once it is written.
 */
export const PARCEL_CODE_PIECES = ['code-reader'] as const;

export function createCoursePackO(_kit: LessonKit): Lesson[] {
  return [];
}
