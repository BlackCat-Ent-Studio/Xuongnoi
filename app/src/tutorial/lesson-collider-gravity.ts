import { numParam, paramOf, vecParam, type Endpoint, type NodeFilter } from './graph-checks';
import { allOf, paramStep } from './lesson-param-step';
import type { LessonKit } from './lessons-vehicles';
import { COLLIDER_GRAVITY_TEXT as T } from './text-vi-course-a';
import type { Lesson } from './types';

/**
 * "Va chạm và trọng lực": carry a big crate up to a floating pad. The learner lowers the hero's gravity to jump high,
 * makes the crate float (gravity 0), shrinks its collision box so it fits the pad, and counts only a crate that lies fully inside.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

/** Gravity scale asked of the hero: anything from just above 0 up to this jumps high enough. */
export const HERO_GRAVITY_MAX = 0.5;
/** Largest collision box edge that still fits the pad. */
export const COLLIDER_MAX = 1.2;

const isPad: NodeFilter = (n) => paramOf(n, 'type') === 'pickup';

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'jump-key', kind: 'key', x: 20, y: 190, params: { key: 'Space' } },
  { alias: 'grab-key', kind: 'key', x: 20, y: 340, params: { key: 'KeyG' } },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -8, y: 1, z: 0 } } },
  { alias: 'carry', kind: 'carry', x: 560, y: 20, params: { mode: 'toggle' } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'crate',
    kind: 'item',
    x: 300,
    y: 560,
    params: { position: { x: -4, y: 1.3, z: 0 }, size: { x: 1.6, y: 1.6, z: 1.6 }, shape: 'crate', color: '#b45309' },
  },
  {
    alias: 'pad',
    kind: 'block',
    x: 560,
    y: 380,
    params: { type: 'pickup', position: { x: 4, y: 6.8, z: 0 }, size: { x: 2, y: 3.6, z: 1 }, color: '#22c55e' },
  },
  { alias: 'end', kind: 'win-lose', x: 1080, y: 380 },
];
const WIRES: BuildArgs[2] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['jump-key', 'held', 'hero', 'jump'],
  ['grab-key', 'pressed', 'carry', 'grab'],
  ['hero', 'self', 'carry', 'character'],
];

const CRATE_SELF: Endpoint = { kind: 'item', port: 'self' };
const PAD_SELF: Endpoint = { kind: 'block', port: 'self', where: isPad };
const TOUCH_A: Endpoint = { kind: 'touch', port: 'a' };
const TOUCH_B: Endpoint = { kind: 'touch', port: 'b' };
const TOUCH_ON: Endpoint = { kind: 'touch', port: 'touching' };
const WIN: Endpoint = { kind: 'win-lose', port: 'win' };

export function createColliderGravityLesson(kit: LessonKit): Lesson {
  const touchWires = allOf([kit.wireStep('w', CRATE_SELF, TOUCH_A), kit.wireStep('w', PAD_SELF, TOUCH_B)]);
  return {
    id: 'collider-gravity',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-touch', 'touch'), title: T.touch.title, text: T.touch.text, explain: T.touch.explain },
      { id: 'wire-touch', ...touchWires, title: T.touchWires.title, text: T.touchWires.text },
      { ...kit.wireStep('wire-win', TOUCH_ON, WIN), title: T.win.title, text: T.win.text },
      {
        ...paramStep({ id: 'set-inside', kind: 'touch', param: 'mode', done: (n) => paramOf(n, 'mode') === 'inside' }),
        title: T.inside.title,
        text: T.inside.text,
        explain: T.inside.explain,
      },
      {
        ...paramStep({
          id: 'set-hold',
          kind: 'touch',
          param: 'hold',
          done: (n) => {
            const h = numParam(n, 'hold');
            return h !== null && h >= 0.3 && h <= 2;
          },
        }),
        title: T.hold.title,
        text: T.hold.text,
        explain: T.hold.explain,
      },
      {
        ...paramStep({
          id: 'hero-gravity',
          kind: 'character',
          param: 'gravityScale',
          advanced: true,
          done: (n) => {
            const g = numParam(n, 'gravityScale');
            return g !== null && g > 0 && g <= HERO_GRAVITY_MAX;
          },
        }),
        title: T.heroGravity.title,
        text: T.heroGravity.text,
        explain: T.heroGravity.explain,
      },
      {
        ...paramStep({
          id: 'crate-gravity',
          kind: 'item',
          param: 'gravityScale',
          advanced: true,
          done: (n) => numParam(n, 'gravityScale') === 0,
        }),
        title: T.crateGravity.title,
        text: T.crateGravity.text,
        explain: T.crateGravity.explain,
      },
      {
        ...paramStep({
          id: 'crate-collider',
          kind: 'item',
          param: 'colliderSize',
          advanced: true,
          done: (n) => {
            const c = vecParam(n, 'colliderSize');
            return c !== null && c.x > 0 && c.y > 0 && c.x <= COLLIDER_MAX && c.y <= COLLIDER_MAX;
          },
        }),
        title: T.collider.title,
        text: T.collider.text,
        explain: T.collider.explain,
      },
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
