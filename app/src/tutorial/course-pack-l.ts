import { createShareJobsLesson } from './lesson-share-jobs';
import { createRobotToMarkerLesson } from './lesson-robot-to-marker';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson } from './types';

/** Robot lessons about several machines sharing work. The menu order comes from COURSE in course.ts. */
export function createCoursePackL(kit: LessonKit): Lesson[] {
  return [createShareJobsLesson(kit), createRobotToMarkerLesson(kit)];
}
