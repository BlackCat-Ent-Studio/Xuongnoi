import type { LessonKit } from './lessons-vehicles';
import { STEP_RUN_TEXT as T } from './text-vi-step-run';
import type { Lesson } from './types';

/**
 * "Xem dây chạy từng bước": a bot patrols and a counter adds one at every end of the road. The learner presses Chơi, then
 * "Từng bước", sees the lit circuit at the first stop and goes on with "Tiếp". Nothing is wired by the learner.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const NODES: BuildArgs[1] = [
  { alias: 'guard', kind: 'character', x: 300, y: 20, params: { position: { x: -4, y: 1, z: 0 }, role: 'bot', color: '#ef4444', look: 'robot' } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  { alias: 'walk', kind: 'patrol', x: 560, y: 20, params: { pointA: { x: -4, y: 1, z: 0 }, pointB: { x: 4, y: 1, z: 0 }, wait: 1 } },
  { alias: 'count', kind: 'counter', x: 820, y: 20, params: { target: 99 } },
  { alias: 'show', kind: 'show-number', x: 1080, y: 20, params: { label: 'Số lần tới đầu đường' } },
];
const WIRES: BuildArgs[2] = [
  ['guard', 'self', 'walk', 'self'],
  ['walk', 'moveX', 'guard', 'moveX'],
  ['walk', 'atEnd', 'count', 'up'],
  ['count', 'value', 'show', 'value'],
];

const STEP_BUTTON = '[data-tut="step"]';

export function createStepRunLesson(kit: LessonKit): Lesson {
  return {
    id: 'step-run',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { id: 'play', title: T.play.title, text: T.play.text, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'step', title: T.step.title, text: T.step.text, explain: T.step.explain, target: () => [STEP_BUTTON], check: (s) => s.stepping === true },
      { id: 'wait', title: T.wait.title, text: T.wait.text, explain: T.wait.explain, check: (s) => s.stepWaiting === true },
      { id: 'next', title: T.next.title, text: T.next.text, explain: T.next.explain, target: () => [STEP_BUTTON], check: (s) => (s.stepBreaks ?? 0) >= 2 },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
