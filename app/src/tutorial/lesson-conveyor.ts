import { numParam, paramOf, vecParam, type Endpoint, type NodeFilter } from './graph-checks';
import { paramStep } from './lesson-param-step';
import type { LessonKit } from './lessons-vehicles';
import { CONVEYOR_TEXT as T } from './text-vi-course-a';
import type { Lesson } from './types';

/**
 * "Băng chuyền": turn a plain platform into a conveyor belt that carries crates left to a collection zone,
 * reverse it with a key, and win when three green crates have arrived (the red one does not count).
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

/** Label that marks the crates worth counting. */
export const GOODS_TAG = 'xanh';
export const CRATES_NEEDED = 3;

/** The low, long block the crates stand on (the floor is a thicker one). */
const isBelt: NodeFilter = (n) => paramOf(n, 'type') !== 'pickup' && (vecParam(n, 'size')?.y ?? 1) < 0.5;

const crate = (alias: string, x: number, tag: string, color: string): BuildArgs[1][number] => ({
  alias,
  kind: 'item',
  x: 300,
  y: 560,
  params: { position: { x, y: 1.2, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', color, tag },
});

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: 10, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'belt',
    kind: 'block',
    x: 560,
    y: 20,
    params: { position: { x: 0.5, y: 0.7, z: 0 }, size: { x: 9, y: 0.4, z: 1 }, color: '#475569' },
  },
  crate('crate-1', 1, GOODS_TAG, '#22c55e'),
  crate('crate-2', 2.2, GOODS_TAG, '#22c55e'),
  crate('crate-junk', 3.4, 'do', '#ef4444'),
  crate('crate-3', 4.6, GOODS_TAG, '#22c55e'),
  {
    alias: 'bin',
    kind: 'zone',
    x: 560,
    y: 380,
    params: { center: { x: -7, y: 1.5, z: 0 }, size: { x: 6, y: 3, z: 4 }, color: '#38bdf8' },
  },
  { alias: 'end', kind: 'win-lose', x: 1080, y: 380 },
];
const WIRES: BuildArgs[2] = [['stick', 'x', 'hero', 'moveX']];

const KEY_HELD: Endpoint = { kind: 'key', port: 'held' };
const BELT_REVERSE: Endpoint = { kind: 'block', port: 'reverse', where: isBelt };
const BIN_INSIDE: Endpoint = { kind: 'zone', port: 'inside' };
const WIN: Endpoint = { kind: 'win-lose', port: 'win' };

export function createConveyorLesson(kit: LessonKit): Lesson {
  return {
    id: 'conveyor',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      {
        ...paramStep({
          id: 'belt-style',
          kind: 'block',
          where: isBelt,
          param: 'style',
          done: (n) => paramOf(n, 'style') === 'conveyor',
        }),
        title: T.style.title,
        text: T.style.text,
        explain: T.style.explain,
      },
      {
        ...paramStep({
          id: 'belt-direction',
          kind: 'block',
          where: isBelt,
          param: 'beltDir',
          advanced: true,
          done: (n) => paramOf(n, 'beltDir') === '-x',
        }),
        title: T.direction.title,
        text: T.direction.text,
        explain: T.direction.explain,
      },
      { ...kit.addStep('add-key', 'key'), title: T.key.title, text: T.key.text },
      { ...kit.wireStep('wire-reverse', KEY_HELD, BELT_REVERSE), title: T.reverse.title, text: T.reverse.text, explain: T.reverse.explain },
      {
        ...paramStep({ id: 'bin-filter', kind: 'zone', param: 'filter', done: (n) => paramOf(n, 'filter') === 'item' }),
        title: T.filter.title,
        text: T.filter.text,
        explain: T.filter.explain,
      },
      {
        ...paramStep({
          id: 'bin-goods',
          kind: 'zone',
          param: 'goods',
          done: (n) => String(paramOf(n, 'goods') ?? '').trim().toLowerCase() === GOODS_TAG,
        }),
        title: T.goods.title,
        text: T.goods.text,
        explain: T.goods.explain,
      },
      {
        ...paramStep({
          id: 'bin-count',
          kind: 'zone',
          param: 'minCount',
          done: (n) => numParam(n, 'minCount') === CRATES_NEEDED,
        }),
        title: T.min.title,
        text: T.min.text,
        explain: T.min.explain,
      },
      { ...kit.wireStep('wire-win', BIN_INSIDE, WIN), title: T.win.title, text: T.win.text },
      {
        id: 'play',
        title: T.play.title,
        text: T.play.text,
        target: () => [kit.playButton],
        check: (s) => s.playing,
      },
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
