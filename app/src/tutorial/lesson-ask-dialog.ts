import { type Endpoint, type NodeFilter, hasNode, nodesOfKind, paramOf, vecParam } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import { ASK_DIALOG_TEXT as T } from './text-vi-course-c';
import { type NodeSpec, type WireSpec, isBot, isPlayer, paletteSel, setParamStep, textChanged } from './course-c-shared';
import type { Lesson } from './types';

/**
 * "Hộp thoại": touching a bot opens a question; one answer opens the gate, the other loses.
 * Self-contained: shared builders arrive through `LessonKit`.
 */

export const ASK_DIALOG_LESSON_ID = 'ask-dialog';
const DEFAULT_QUESTION = 'Bạn muốn làm gì?';

const NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -9, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 34, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'npc',
    kind: 'character',
    x: 300,
    y: 540,
    params: { position: { x: -3, y: 1, z: 0 }, color: '#f97316', look: 'robot', role: 'bot' },
  },
  {
    alias: 'gate',
    kind: 'block',
    x: 300,
    y: 700,
    params: { position: { x: 3, y: 3, z: 0 }, size: { x: 1, y: 5, z: 1 }, color: '#92400e' },
  },
  {
    alias: 'star',
    kind: 'block',
    x: 300,
    y: 860,
    params: { type: 'pickup', position: { x: 9, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#facc15' },
  },
  { alias: 'goal', kind: 'touch', x: 560, y: 20, params: { mode: 'center' } },
  { alias: 'end', kind: 'win-lose', x: 820, y: 20, params: { winMessage: 'Bạn lấy được ngôi sao!', loseMessage: 'Bạn chọn sai rồi!' } },
];
const WIRES: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['hero', 'self', 'goal', 'a'],
  ['star', 'self', 'goal', 'b'],
  ['goal', 'touching', 'end', 'win'],
];

/** The tall brown block that stops the way. */
const isGate: NodeFilter = (n) => (vecParam(n, 'size')?.y ?? 0) >= 3 && paramOf(n, 'type') !== 'pickup';

const HERO_SELF: Endpoint = { kind: 'character', port: 'self', where: isPlayer };
const NPC_SELF: Endpoint = { kind: 'character', port: 'self', where: isBot };
/** The board's own Va chạm (hero vs star) uses "Tâm A vào trong B"; the one the learner adds keeps the default. */
const isAskTouch: NodeFilter = (n) => paramOf(n, 'mode') !== 'center';

const TOUCH_A: Endpoint = { kind: 'touch', port: 'a', where: isAskTouch };
const TOUCH_B: Endpoint = { kind: 'touch', port: 'b', where: isAskTouch };
const TOUCH_BEGAN: Endpoint = { kind: 'touch', port: 'began', where: isAskTouch };
const DIALOG_ASK: Endpoint = { kind: 'ui-dialog', port: 'ask' };
const DIALOG_A1: Endpoint = { kind: 'ui-dialog', port: 'a1' };
const DIALOG_A2: Endpoint = { kind: 'ui-dialog', port: 'a2' };
const GATE_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isGate };
const LOSE: Endpoint = { kind: 'win-lose', port: 'lose' };

export function createAskDialogLesson(kit: LessonKit): Lesson {
  return {
    id: ASK_DIALOG_LESSON_ID,
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      {
        id: 'add-touch',
        target: () => [paletteSel('touch')],
        check: (s) => nodesOfKind(s.graph, 'touch', isAskTouch).length > 0,
        title: T.addTouch.title,
        text: T.addTouch.text,
        explain: T.addTouch.explain,
      },
      { ...kit.wireStep('wire-hero', HERO_SELF, TOUCH_A), title: T.wireHero.title, text: T.wireHero.text },
      { ...kit.wireStep('wire-bot', NPC_SELF, TOUCH_B), title: T.wireBot.title, text: T.wireBot.text },
      { ...kit.addStep('add-dialog', 'ui-dialog'), title: T.addDialog.title, text: T.addDialog.text, explain: T.addDialog.explain },
      { ...kit.wireStep('wire-ask', TOUCH_BEGAN, DIALOG_ASK), title: T.wireAsk.title, text: T.wireAsk.text },
      {
        ...setParamStep('question', 'ui-dialog', 'question', (s) => textChanged(s, 'ui-dialog', 'question', DEFAULT_QUESTION)),
        title: T.question.title,
        text: T.question.text,
      },
      { ...kit.wireStep('wire-open', DIALOG_A1, GATE_HIDE), title: T.wireOpen.title, text: T.wireOpen.text, explain: T.wireOpen.explain },
      { ...kit.wireStep('wire-trap', DIALOG_A2, LOSE), title: T.wireTrap.title, text: T.wireTrap.text, explain: T.wireTrap.explain },
      {
        id: 'play',
        title: T.play.title,
        text: T.play.text,
        target: () => [kit.playButton],
        check: (s) => s.playing && hasNode(s.graph, 'ui-dialog'),
      },
      { id: 'win', title: T.win.title, text: T.win.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
