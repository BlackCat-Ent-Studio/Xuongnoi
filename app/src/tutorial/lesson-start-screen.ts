import { type Endpoint, type NodeFilter, hasNode, nodesOfKind, numParam, paramOf, vecParam } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import { START_SCREEN_TEXT as T } from './text-vi-course-c';
import { type NodeSpec, type WireSpec, setParamStep, textChanged } from './course-c-shared';
import type { Lesson } from './types';

/**
 * "Màn hình mở đầu": a start screen and an on-screen button that opens a door, and a countdown that waits for the
 * start. Self-contained: shared builders arrive through `LessonKit`.
 */

export const START_SCREEN_LESSON_ID = 'start-screen';
const COUNTDOWN_SECONDS = 20;
const DEFAULT_TITLE = 'Trò chơi của tôi';
const DEFAULT_BUTTON = 'Bấm vào đây';

const NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -7, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'door',
    kind: 'block',
    x: 300,
    y: 540,
    params: { position: { x: 0, y: 3, z: 0 }, size: { x: 1, y: 5, z: 1 }, color: '#92400e' },
  },
  {
    alias: 'star',
    kind: 'block',
    x: 300,
    y: 700,
    params: { type: 'pickup', position: { x: 7, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#facc15' },
  },
  { alias: 'touch', kind: 'touch', x: 560, y: 20, params: { mode: 'center' } },
  { alias: 'end', kind: 'win-lose', x: 820, y: 20, params: { winMessage: 'Bạn lấy được ngôi sao!', loseMessage: 'Hết giờ mất rồi!' } },
];
const WIRES: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['hero', 'self', 'touch', 'a'],
  ['star', 'self', 'touch', 'b'],
  ['touch', 'touching', 'end', 'win'],
];

/** The tall brown block that stops the way. */
const isDoor: NodeFilter = (n) => (vecParam(n, 'size')?.y ?? 0) >= 3 && paramOf(n, 'type') !== 'pickup';

const BUTTON_PRESSED: Endpoint = { kind: 'ui-button', port: 'pressed' };
const DOOR_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isDoor };
const STARTED: Endpoint = { kind: 'ui-start', port: 'started' };
const TIMER_RUN: Endpoint = { kind: 'timer', port: 'run' };
const TIMER_DONE: Endpoint = { kind: 'timer', port: 'done' };
const LOSE: Endpoint = { kind: 'win-lose', port: 'lose' };

export function createStartScreenLesson(kit: LessonKit): Lesson {
  return {
    id: START_SCREEN_LESSON_ID,
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-start', 'ui-start'), title: T.addStart.title, text: T.addStart.text, explain: T.addStart.explain },
      {
        ...setParamStep('start-title', 'ui-start', 'title', (s) => textChanged(s, 'ui-start', 'title', DEFAULT_TITLE)),
        title: T.startTitle.title,
        text: T.startTitle.text,
      },
      { ...kit.addStep('add-button', 'ui-button'), title: T.addButton.title, text: T.addButton.text, explain: T.addButton.explain },
      {
        ...setParamStep('button-text', 'ui-button', 'text', (s) => textChanged(s, 'ui-button', 'text', DEFAULT_BUTTON)),
        title: T.buttonText.title,
        text: T.buttonText.text,
      },
      { ...kit.wireStep('wire-door', BUTTON_PRESSED, DOOR_HIDE), title: T.wireDoor.title, text: T.wireDoor.text },
      {
        ...setParamStep('add-timer', 'timer', 'seconds', (s) => nodesOfKind(s.graph, 'timer').some((n) => numParam(n, 'seconds') === COUNTDOWN_SECONDS)),
        title: T.addTimer.title,
        text: T.addTimer.text,
      },
      { ...kit.wireStep('wire-run', STARTED, TIMER_RUN), title: T.wireRun.title, text: T.wireRun.text, explain: T.wireRun.explain },
      { ...kit.wireStep('wire-lose', TIMER_DONE, LOSE), title: T.wireLose.title, text: T.wireLose.text },
      {
        id: 'play',
        title: T.play.title,
        text: T.play.text,
        explain: T.play.explain,
        target: () => [kit.playButton],
        check: (s) => s.playing && hasNode(s.graph, 'ui-start'),
      },
      { id: 'win', title: T.win.title, text: T.win.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
