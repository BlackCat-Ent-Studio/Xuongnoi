import type { Graph, GraphNode } from '../engine/types';
import { paramOf, vecParam } from './graph-checks';
import { STOP_BUTTON, type Resolve, first, link, paramStep, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import { TRAIN_TEXT as T } from './text-vi-course-b';
import type { Lesson } from './types';

/**
 * "Tàu hỏa": three cars standing on a ring of rails become a locomotive and two wagons, coupled with
 * "Kéo theo bởi", running on the rail ("Bám ray") and resting a few seconds at every point like a station.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

/** Ring of rails round the default route square (points at +-6): sides are 1.6 wide and join at the corners. */
const RAIL_LONG = 13.6;
const RAIL_SHORT = 10.4;
const rail = (alias: string, x: number, z: number, long: 'x' | 'z', cx: number, style: string): BuildArgs[1][number] => ({
  alias,
  kind: 'block',
  x: cx,
  y: 20,
  params: {
    type: 'solid',
    style,
    position: { x, y: -0.5, z },
    size: long === 'x' ? { x: RAIL_LONG, y: 1, z: 1.6 } : { x: 1.6, y: 1, z: RAIL_SHORT },
    color: '#78716c',
  },
});

const LOCO_X = 2;
const WAGON1_X = -1;
const WAGON2_X = -4;
const car = (alias: string, x: number, color: string, cx: number): BuildArgs[1][number] => ({
  alias,
  kind: 'vehicle',
  x: cx,
  y: 300,
  params: { position: { x, y: 0.7, z: -6 }, model: 'car', control: 'auto', color },
});

const NODES: BuildArgs[1] = [
  {
    alias: 'ground',
    kind: 'block',
    x: 20,
    y: 20,
    params: { type: 'solid', position: { x: 0, y: -1.5, z: 0 }, size: { x: 34, y: 1, z: 34 }, color: '#d9f99d' },
  },
  rail('rail-north', 0, -6, 'x', 270, 'rail'),
  rail('rail-south', 0, 6, 'x', 520, 'rail'),
  rail('rail-west', -6, 0, 'z', 770, 'rail'),
  rail('rail-east', 6, 0, 'z', 1020, 'box'),
  car('loco', LOCO_X, '#b91c1c', 20),
  car('wagon1', WAGON1_X, '#1d4ed8', 270),
  car('wagon2', WAGON2_X, '#15803d', 520),
  { alias: 'camera', kind: 'camera', x: 1020, y: 300, params: { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, zoom: 0.6 } },
];

const xIs =
  (x: number) =>
  (n: GraphNode): boolean =>
    Math.abs((vecParam(n, 'position')?.x ?? Number.NaN) - x) < 0.01;

const loco: Resolve = (g) => first(g, 'vehicle', xIs(LOCO_X));
const wagon1: Resolve = (g) => first(g, 'vehicle', xIs(WAGON1_X));
const wagon2: Resolve = (g) => first(g, 'vehicle', xIs(WAGON2_X));
const eastRail: Resolve = (g) => first(g, 'block', (n) => Math.abs((vecParam(n, 'position')?.x ?? 0) - 6) < 0.01 && Math.abs(vecParam(n, 'position')?.z ?? 1) < 0.01);
const route: Resolve = (g) => first(g, 'route-follow');
const timer: Resolve = (g) => first(g, 'timer');
const not: Resolve = (g) => first(g, 'not');

const modelIs = (n: GraphNode, model: string): boolean => paramOf(n, 'model') === model;
/** The wagon still waiting to be converted, else the first one. */
const nextWagon: Resolve = (g) => [wagon1(g), wagon2(g)].find((n) => n && !modelIs(n, 'wagon')) ?? wagon1(g);
const bothWagons = (_n: GraphNode, g: Graph): boolean => [wagon1(g), wagon2(g)].every((n) => n !== undefined && modelIs(n, 'wagon'));

export function createTrainLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'train',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, NODES, []), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      {
        ...paramStep('fix-rail', eastRail, 'style', (n) => paramOf(n, 'style') === 'rail'),
        title: T.rail.title,
        text: T.rail.text,
        explain: T.rail.explain,
      },
      {
        ...paramStep('make-loco', loco, 'model', (n) => modelIs(n, 'locomotive')),
        title: T.loco.title,
        text: T.loco.text,
      },
      { ...paramStep('make-wagons', nextWagon, 'model', bothWagons), title: T.wagons.title, text: T.wagons.text },
      {
        ...wiresStep('wire-tow1', [link(loco, 'self', wagon1, 'leader')]),
        title: T.tow1.title,
        text: T.tow1.text,
        explain: T.tow1.explain,
      },
      {
        ...wiresStep('wire-tow2', [link(wagon1, 'self', wagon2, 'leader')]),
        title: T.tow2.title,
        text: T.tow2.text,
        explain: T.tow2.explain,
      },
      { ...kit.addStep('add-route', 'route-follow'), title: T.route.title, text: T.route.text },
      { ...wiresStep('wire-route-who', [link(loco, 'self', route, 'self')]), title: T.who.title, text: T.who.text },
      {
        ...paramStep('route-rail', route, 'follow', (n) => paramOf(n, 'follow') === 'rail'),
        title: T.follow.title,
        text: T.follow.text,
        explain: T.follow.explain,
      },
      play('watch', T.watch, true),
      play('back-to-edit', T.edit, false),
      { ...kit.addStep('add-timer', 'timer'), title: T.timer.title, text: T.timer.text, explain: T.timer.explain },
      {
        ...paramStep('timer-seconds', timer, 'seconds', (n) => paramOf(n, 'seconds') === 3),
        title: T.seconds.title,
        text: T.seconds.text,
      },
      {
        ...wiresStep('wire-reached', [link(route, 'reached', timer, 'reset')]),
        title: T.reached.title,
        text: T.reached.text,
        explain: T.reached.explain,
      },
      { ...kit.addStep('add-not', 'not'), title: T.not.title, text: T.not.text },
      {
        ...wiresStep('wire-waiting', [link(timer, 'done', not, 'in')]),
        title: T.waiting.title,
        text: T.waiting.text,
        explain: T.waiting.explain,
      },
      { ...wiresStep('wire-stop', [link(not, 'out', route, 'stop')]), title: T.stop.title, text: T.stop.text },
      play('play-station', T.play, true),
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
