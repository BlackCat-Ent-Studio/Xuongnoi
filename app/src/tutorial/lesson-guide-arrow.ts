import type { Graph, GraphNode } from '../engine/types';
import { nodesOfKind, numParam, vecParam } from './graph-checks';
import { STOP_BUTTON, type Resolve, first, link, paramStep, wired, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import { GUIDE_TEXT as T } from './text-vi-course-b';
import type { Lesson } from './types';

/**
 * "Mũi tên dẫn đường": a walker, a near yellow flag and a far red flag. One guide arrow points at the yellow
 * flag; a counter and "Chọn theo số" then swap it for a second arrow once the yellow flag is touched.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const FLAG_A_X = 0;
const FLAG_B_X = 9;

const flag = (alias: string, x: number, color: string, cx: number): BuildArgs[1][number] => ({
  alias,
  kind: 'block',
  x: cx,
  y: 20,
  params: { type: 'pickup', position: { x, y: 2, z: 0 }, size: { x: 0.6, y: 3, z: 1 }, color },
});

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 270, y: 20, params: { position: { x: -9, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 520, y: 20, params: { size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  flag('flag-a', FLAG_A_X, '#facc15', 770),
  flag('flag-b', FLAG_B_X, '#ef4444', 1020),
  { alias: 'touch-a', kind: 'touch', x: 770, y: 300 },
  { alias: 'touch-b', kind: 'touch', x: 1020, y: 300 },
  { alias: 'end', kind: 'win-lose', x: 1270, y: 300 },
];
const WIRES: BuildArgs[2] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['hero', 'self', 'touch-a', 'a'],
  ['flag-a', 'self', 'touch-a', 'b'],
  ['hero', 'self', 'touch-b', 'a'],
  ['flag-b', 'self', 'touch-b', 'b'],
  ['touch-b', 'touching', 'end', 'win'],
];

const flagAt =
  (x: number): Resolve =>
  (g) =>
    first(g, 'block', (n) => Math.abs((vecParam(n, 'position')?.x ?? Number.NaN) - x) < 0.01 && n.params.type === 'pickup');
const flagA = flagAt(FLAG_A_X);
const flagB = flagAt(FLAG_B_X);
const hero: Resolve = (g) => first(g, 'character');
const touchA: Resolve = (g) => first(g, 'touch');
const counter: Resolve = (g) => first(g, 'counter');
const select: Resolve = (g) => first(g, 'select-number');

/** The arrow already pointed at the yellow flag, else the first one on the board. */
const arrow1: Resolve = (g) => {
  const arrows = nodesOfKind(g, 'guide-arrow');
  const a = flagA(g);
  return arrows.find((n) => wired(g, a, 'self', n, 'to')) ?? arrows[0];
};
/** The other arrow: the one that is not the first. */
const arrow2: Resolve = (g) => {
  const a1 = arrow1(g);
  return nodesOfKind(g, 'guide-arrow').find((n: GraphNode) => n !== a1);
};

const startsAtOne = (n: GraphNode, _g: Graph): boolean => numParam(n, 'start') === 1;

export function createGuideArrowLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'guide-arrow',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-arrow', 'guide-arrow'), title: T.arrow.title, text: T.arrow.text },
      { ...wiresStep('wire-from', [link(hero, 'self', arrow1, 'from')]), title: T.from.title, text: T.from.text },
      {
        ...wiresStep('wire-to', [link(flagA, 'self', arrow1, 'to')]),
        title: T.to.title,
        text: T.to.text,
        explain: T.to.explain,
      },
      play('watch', T.watch, true),
      play('back-to-edit', T.edit, false),
      { ...kit.addStep('add-arrow-2', 'guide-arrow', 2), title: T.arrow2.title, text: T.arrow2.text },
      { ...wiresStep('wire-from-2', [link(hero, 'self', arrow2, 'from')]), title: T.from2.title, text: T.from2.text },
      { ...wiresStep('wire-to-2', [link(flagB, 'self', arrow2, 'to')]), title: T.to2.title, text: T.to2.text },
      { ...kit.addStep('add-counter', 'counter'), title: T.counter.title, text: T.counter.text, explain: T.counter.explain },
      { ...paramStep('counter-start', counter, 'start', startsAtOne), title: T.start.title, text: T.start.text },
      {
        ...wiresStep('wire-touch', [link(touchA, 'touching', counter, 'up')]),
        title: T.touch.title,
        text: T.touch.text,
        explain: T.touch.explain,
      },
      { ...kit.addStep('add-select', 'select-number'), title: T.select.title, text: T.select.text, explain: T.select.explain },
      { ...wiresStep('wire-select', [link(counter, 'value', select, 'value')]), title: T.selectIn.title, text: T.selectIn.text },
      { ...wiresStep('wire-show-1', [link(select, 'is1', arrow1, 'show')]), title: T.show1.title, text: T.show1.text },
      {
        ...wiresStep('wire-show-2', [link(select, 'is2', arrow2, 'show')]),
        title: T.show2.title,
        text: T.show2.text,
        explain: T.show2.explain,
      },
      play('play-guide', T.play, true),
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
