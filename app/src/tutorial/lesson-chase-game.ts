import { numParam, paramOf, type Endpoint, type NodeFilter } from './graph-checks';
import { allOf, paramStep } from './lesson-param-step';
import type { LessonKit } from './lessons-vehicles';
import { CHASE_GAME_TEXT as T } from './text-vi-course-a';
import type { Lesson } from './types';

/**
 * "Trò đuổi bắt": a red bot chases the player (lose on touch) and a green bot flees from the player (win on touch).
 * Both brains are the same node in its two modes.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const RED = '#ef4444';
const GREEN = '#22c55e';
/** "Khoảng bắt được" the lesson asks for. */
export const CATCH_DISTANCE = 0.8;

const isChaserBot: NodeFilter = (n) => paramOf(n, 'color') === RED;
const isRunnerBot: NodeFilter = (n) => paramOf(n, 'color') === GREEN;
const isChaseMode: NodeFilter = (n) => paramOf(n, 'mode') === 'chase';
const isFleeMode: NodeFilter = (n) => paramOf(n, 'mode') === 'flee';

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: 0, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'chaser',
    kind: 'character',
    x: 300,
    y: 540,
    params: { position: { x: -5, y: 1, z: 0 }, color: RED, look: 'robot', role: 'bot', speed: 3 },
  },
  {
    alias: 'runner',
    kind: 'character',
    x: 300,
    y: 760,
    params: { position: { x: 4, y: 1, z: 0 }, color: GREEN, look: 'chick', role: 'bot', speed: 4 },
  },
  { alias: 'touch-lose', kind: 'touch', x: 820, y: 20 },
  { alias: 'touch-win', kind: 'touch', x: 820, y: 220 },
  { alias: 'end', kind: 'win-lose', x: 1080, y: 120 },
];
const WIRES: BuildArgs[2] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['hero', 'self', 'touch-lose', 'a'],
  ['chaser', 'self', 'touch-lose', 'b'],
  ['touch-lose', 'touching', 'end', 'lose'],
  ['hero', 'self', 'touch-win', 'a'],
  ['runner', 'self', 'touch-win', 'b'],
  ['touch-win', 'touching', 'end', 'win'],
];

const HERO_SELF: Endpoint = { kind: 'character', port: 'self', where: (n) => paramOf(n, 'role') !== 'bot' };
const CHASER_SELF: Endpoint = { kind: 'character', port: 'self', where: isChaserBot };
const RUNNER_SELF: Endpoint = { kind: 'character', port: 'self', where: isRunnerBot };
const CHASER_MOVE: Endpoint = { kind: 'character', port: 'moveX', where: isChaserBot };
const RUNNER_MOVE: Endpoint = { kind: 'character', port: 'moveX', where: isRunnerBot };
const chaseIn = (port: string, where: NodeFilter): Endpoint => ({ kind: 'chase', port, where });

export function createChaseGameLesson(kit: LessonKit): Lesson {
  const chaserWires = allOf([
    kit.wireStep('w', CHASER_SELF, chaseIn('self', isChaseMode)),
    kit.wireStep('w', HERO_SELF, chaseIn('target', isChaseMode)),
    kit.wireStep('w', chaseIn('moveX', isChaseMode), CHASER_MOVE),
  ]);
  const runnerWires = allOf([
    kit.wireStep('w', RUNNER_SELF, chaseIn('self', isFleeMode)),
    kit.wireStep('w', HERO_SELF, chaseIn('target', isFleeMode)),
    kit.wireStep('w', chaseIn('moveX', isFleeMode), RUNNER_MOVE),
  ]);
  return {
    id: 'chase-game',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-chase', 'chase'), title: T.chase.title, text: T.chase.text, explain: T.chase.explain },
      { id: 'wire-chaser', ...chaserWires, title: T.chaseWires.title, text: T.chaseWires.text, explain: T.chaseWires.explain },
      {
        ...paramStep({
          id: 'catch-distance',
          kind: 'chase',
          where: isChaseMode,
          param: 'catchDistance',
          advanced: true,
          done: (n) => Math.abs((numParam(n, 'catchDistance') ?? Number.NaN) - CATCH_DISTANCE) < 0.01,
        }),
        title: T.catchDistance.title,
        text: T.catchDistance.text,
        explain: T.catchDistance.explain,
      },
      { ...kit.addStep('add-chase-2', 'chase', 2), title: T.chase2.title, text: T.chase2.text },
      {
        ...paramStep({ id: 'set-flee', kind: 'chase', param: 'mode', done: (n) => paramOf(n, 'mode') === 'flee' }),
        title: T.flee.title,
        text: T.flee.text,
        explain: T.flee.explain,
      },
      { id: 'wire-runner', ...runnerWires, title: T.fleeWires.title, text: T.fleeWires.text },
      {
        id: 'play',
        title: T.play.title,
        text: T.play.text,
        target: () => [kit.playButton],
        check: (s) => s.playing,
      },
      { id: 'win', title: T.win.title, text: T.win.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
