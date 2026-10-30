import type { GraphNode } from '../engine/types';
import { type Endpoint, paramOf, vecParam } from './graph-checks';
import { STOP_BUTTON, type Resolve, first, link, paramStep, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import { ROUTE_TRAFFIC_TEXT as T } from './text-vi-course-b';
import type { Lesson } from './types';

/**
 * "Xe chạy theo tuyến": a driverless car follows four points round a block of roads and halts at a stop line
 * while the traffic light is red. Self-contained: the shared step builders arrive through `LessonKit`.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const ROAD_COLOR = '#475569';
const road = (alias: string, x: number, z: number, sx: number, sz: number, cx: number): BuildArgs[1][number] => ({
  alias,
  kind: 'block',
  x: cx,
  y: 20,
  params: { type: 'solid', style: 'road', position: { x, y: -0.5, z }, size: { x: sx, y: 1, z: sz }, color: ROAD_COLOR },
});

const NODES: BuildArgs[1] = [
  {
    alias: 'ground',
    kind: 'block',
    x: 20,
    y: 20,
    params: { type: 'solid', position: { x: 0, y: -1.5, z: 0 }, size: { x: 34, y: 1, z: 34 }, color: '#bbf7d0' },
  },
  road('road-north', 0, -6, 15, 3, 270),
  road('road-south', 0, 6, 15, 3, 520),
  road('road-west', -6, 0, 3, 9, 770),
  road('road-east', 6, 0, 3, 9, 1020),
  {
    alias: 'car',
    kind: 'vehicle',
    x: 20,
    y: 300,
    params: { position: { x: -6, y: 0.5, z: -6 }, model: 'car', control: 'auto', color: '#3b82f6' },
  },
  {
    alias: 'light',
    kind: 'block',
    x: 270,
    y: 300,
    params: {
      type: 'solid',
      style: 'trafficlight',
      position: { x: -1.5, y: 1, z: -3.6 },
      size: { x: 0.8, y: 2, z: 0.8 },
      color: '#ef4444',
      color1: '#22c55e',
    },
  },
  { alias: 'timer', kind: 'timer', x: 520, y: 300, params: { seconds: 8 } },
  { alias: 'counter', kind: 'counter', x: 770, y: 300, params: { start: 0, target: 1 } },
  { alias: 'camera', kind: 'camera', x: 1020, y: 300, params: { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, zoom: 0.6 } },
];

const car: Resolve = (g) => first(g, 'vehicle');
const route: Resolve = (g) => first(g, 'route-follow');
const timer: Resolve = (g) => first(g, 'timer');
const counter: Resolve = (g) => first(g, 'counter');
const light: Resolve = (g) => first(g, 'block', (n) => paramOf(n, 'style') === 'trafficlight');
const zone: Resolve = (g) => first(g, 'zone');
const not: Resolve = (g) => first(g, 'not');
const and: Resolve = (g) => first(g, 'and');

const ZONE_ON_ROAD = (n: GraphNode): boolean => {
  const c = vecParam(n, 'center');
  return c !== null && Math.abs(c.x) <= 4 && Math.abs(c.z + 6) <= 1.5;
};

const COUNTER_REACHED: Endpoint = { kind: 'counter', port: 'reached' };

export function createRouteTrafficLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [on ? kit.playButton : STOP_BUTTON],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'route-traffic',
    title: T.title,
    summary: T.summary,
    createBoard: () => ({ ...kit.buildBoard(T.boardName, NODES, []), mode: '2d-top' }),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-route', 'route-follow'), title: T.route.title, text: T.route.text, explain: T.route.explain },
      { ...wiresStep('wire-route-who', [link(car, 'self', route, 'self')]), title: T.who.title, text: T.who.text },
      {
        ...wiresStep('wire-route-move', [link(route, 'moveX', car, 'moveX'), link(route, 'moveY', car, 'moveY')]),
        title: T.move.title,
        text: T.move.text,
        explain: T.move.explain,
      },
      play('watch', T.watch, true),
      play('back-to-edit', T.edit, false),
      {
        ...wiresStep('wire-timer', [link(timer, 'done', counter, 'up')]),
        title: T.timer.title,
        text: T.timer.text,
        explain: T.timer.explain,
      },
      {
        ...wiresStep('wire-color', [link(counter, 'value', light, 'pick')]),
        title: T.color.title,
        text: T.color.text,
        explain: T.color.explain,
      },
      { ...kit.addStep('add-zone', 'zone'), title: T.zone.title, text: T.zone.text, explain: T.zone.explain },
      {
        ...paramStep('zone-place', zone, 'center', ZONE_ON_ROAD),
        title: T.place.title,
        text: T.place.text,
        explain: T.place.explain,
      },
      {
        ...paramStep('zone-filter', zone, 'filter', (n) => paramOf(n, 'filter') === 'vehicle'),
        title: T.filter.title,
        text: T.filter.text,
        explain: T.filter.explain,
      },
      { ...kit.addStep('add-not', 'not'), title: T.not.title, text: T.not.text, explain: T.not.explain },
      {
        ...kit.wireStep('wire-red', COUNTER_REACHED, { kind: 'not', port: 'in' }),
        title: T.red.title,
        text: T.red.text,
        explain: T.red.explain,
      },
      { ...kit.addStep('add-and', 'and'), title: T.and.title, text: T.and.text, explain: T.and.explain },
      {
        ...wiresStep('wire-rule', [link(zone, 'inside', and, 'a'), link(not, 'out', and, 'b')]),
        title: T.rule.title,
        text: T.rule.text,
      },
      {
        ...wiresStep('wire-stop', [link(and, 'out', route, 'stop')]),
        title: T.stop.title,
        text: T.stop.text,
        explain: T.stop.explain,
      },
      play('play-stop', T.play, true),
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
