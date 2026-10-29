import { paramOf, vecParam, type Endpoint, type NodeFilter } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import { BOT_TOOL_TEXT as T } from './text-vi-bot-tool';
import type { Lesson } from './types';

/**
 * Lesson 16, "Bot cầm cuốc": a bot walks to a pickaxe, takes it in hand, walks to a rock and breaks it.
 * Self-contained: the shared builders of `lessons.ts` arrive through `LessonKit`.
 */

const PICKAXE_X = -2;
const ROCK_X = 3;
const BOT_X = -6;

const goAt =
  (x: number): NodeFilter =>
  (n) =>
    Math.abs((vecParam(n, 'targetPos')?.x ?? Number.NaN) - x) < 0.01;
const isRock: NodeFilter = (n) => (vecParam(n, 'size')?.y ?? 0) >= 3 && paramOf(n, 'type') !== 'pickup';

const SEQ_STEP1: Endpoint = { kind: 'sequence', port: 'step1' };
const SEQ_STEP2: Endpoint = { kind: 'sequence', port: 'step2' };
const SEQ_NEXT: Endpoint = { kind: 'sequence', port: 'next' };
const GO_PICKAXE_GO: Endpoint = { kind: 'go-to', port: 'go', where: goAt(PICKAXE_X) };
const GO_ROCK_GO: Endpoint = { kind: 'go-to', port: 'go', where: goAt(ROCK_X) };
const GO_PICKAXE_ARRIVED: Endpoint = { kind: 'go-to', port: 'arrivedPulse', where: goAt(PICKAXE_X) };
const GO_ROCK_ARRIVED: Endpoint = { kind: 'go-to', port: 'arrivedPulse', where: goAt(ROCK_X) };
const OR_OUT: Endpoint = { kind: 'or', port: 'out' };
const BOT_SELF: Endpoint = { kind: 'character', port: 'self' };
const HAND_WHO: Endpoint = { kind: 'hand-tool', port: 'character' };
const HAND_TOGGLE: Endpoint = { kind: 'hand-tool', port: 'toggle' };
const HAND_USE: Endpoint = { kind: 'hand-tool', port: 'use' };
const ROCK_USED_ON: Endpoint = { kind: 'block', port: 'usedOn', where: isRock };
const ROCK_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isRock };
const AND_A: Endpoint = { kind: 'and', port: 'a' };
const AND_B: Endpoint = { kind: 'and', port: 'b' };
const AND_OUT: Endpoint = { kind: 'and', port: 'out' };
const TOOL_IN_HAND: Endpoint = { kind: 'item', port: 'inHand' };
const WIN_IN: Endpoint = { kind: 'win-lose', port: 'win' };

type BuildArgs = Parameters<LessonKit['buildBoard']>;

/** A bot, a pickaxe and a rock on a floor, plus the two walk bricks already wired to move the bot. */
const NODES: BuildArgs[1] = [
  { alias: 'floor', kind: 'block', x: 300, y: 370, params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'bot',
    kind: 'character',
    x: 300,
    y: 20,
    params: { position: { x: BOT_X, y: 1, z: 0 }, color: '#f59e0b', look: 'robot', role: 'bot' },
  },
  {
    alias: 'pickaxe',
    kind: 'item',
    x: 300,
    y: 520,
    params: {
      position: { x: PICKAXE_X, y: 0.85, z: 0 },
      size: { x: 0.7, y: 0.7, z: 0.7 },
      color: '#a16207',
      shape: 'pickaxe',
      holdStyle: 'hand',
    },
  },
  {
    alias: 'rock',
    kind: 'block',
    x: 300,
    y: 680,
    params: { position: { x: ROCK_X, y: 2, z: 0 }, size: { x: 1, y: 3, z: 1 }, color: '#78716c' },
  },
  {
    alias: 'go-pickaxe',
    kind: 'go-to',
    x: 560,
    y: 20,
    params: { targetPos: { x: PICKAXE_X, y: 1, z: 0 }, stopDistance: 0.5 },
  },
  {
    alias: 'go-rock',
    kind: 'go-to',
    x: 560,
    y: 250,
    params: { targetPos: { x: ROCK_X, y: 1, z: 0 }, stopDistance: 1.5 },
  },
  { alias: 'add', kind: 'math', x: 820, y: 20 },
  { alias: 'or', kind: 'or', x: 820, y: 250 },
];
const WIRES: BuildArgs[2] = [
  ['bot', 'self', 'go-pickaxe', 'self'],
  ['bot', 'self', 'go-rock', 'self'],
  ['pickaxe', 'self', 'go-pickaxe', 'target'],
  ['rock', 'self', 'go-rock', 'target'],
  ['go-pickaxe', 'moveX', 'add', 'a'],
  ['go-rock', 'moveX', 'add', 'b'],
  ['add', 'out', 'bot', 'moveX'],
  ['go-pickaxe', 'arrivedPulse', 'or', 'a'],
  ['go-rock', 'arrivedPulse', 'or', 'b'],
];

export function createBotToolLesson(kit: LessonKit): Lesson {
  const play = (id: string, t: { title: string; text: string }, on: boolean) => ({
    id,
    title: t.title,
    text: t.text,
    target: () => [kit.playButton],
    check: (s: { playing: boolean }) => s.playing === on,
  });
  return {
    id: 'bot-pickaxe',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      play('watch', T.watch, true),
      play('back-to-edit', T.edit, false),
      { ...kit.addStep('add-sequence', 'sequence'), title: T.sequence.title, text: T.sequence.text, explain: T.sequence.explain },
      { ...kit.wireStep('wire-step1', SEQ_STEP1, GO_PICKAXE_GO), title: T.step1.title, text: T.step1.text, explain: T.step1.explain },
      { ...kit.wireStep('wire-step2', SEQ_STEP2, GO_ROCK_GO), title: T.step2.title, text: T.step2.text },
      { ...kit.wireStep('wire-next', OR_OUT, SEQ_NEXT), title: T.next.title, text: T.next.text, explain: T.next.explain },
      { ...kit.addStep('add-hand', 'hand-tool'), title: T.hand.title, text: T.hand.text, explain: T.hand.explain },
      { ...kit.wireStep('wire-hand-who', BOT_SELF, HAND_WHO), title: T.handWho.title, text: T.handWho.text },
      {
        ...kit.wireStep('wire-take', GO_PICKAXE_ARRIVED, HAND_TOGGLE),
        title: T.handToggle.title,
        text: T.handToggle.text,
        explain: T.handToggle.explain,
      },
      {
        ...kit.wireStep('wire-swing', GO_ROCK_ARRIVED, HAND_USE),
        title: T.handUse.title,
        text: T.handUse.text,
        explain: T.handUse.explain,
      },
      { ...kit.addStep('add-and', 'and'), title: T.and.title, text: T.and.text, explain: T.and.explain },
      { ...kit.wireStep('wire-rock', ROCK_USED_ON, AND_A), title: T.rockUsed.title, text: T.rockUsed.text },
      { ...kit.wireStep('wire-in-hand', TOOL_IN_HAND, AND_B), title: T.inHand.title, text: T.inHand.text },
      {
        ...kit.wireStep('wire-break', AND_OUT, ROCK_HIDE),
        title: T.rockHide.title,
        text: T.rockHide.text,
        explain: T.rockHide.explain,
      },
      { ...kit.addStep('add-end', 'win-lose'), title: T.end.title, text: T.end.text },
      { ...kit.wireStep('wire-win', AND_OUT, WIN_IN), title: T.win.title, text: T.win.text },
      play('play-break', T.play, true),
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
