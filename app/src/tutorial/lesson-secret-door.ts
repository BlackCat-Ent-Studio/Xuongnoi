import { paramOf, vecParam, type Endpoint, type NodeFilter } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import { SECRET_DOOR_TEXT as T } from './text-vi-course-a';
import type { Lesson } from './types';

/**
 * "Cửa bí mật": a door opens when the game starts (Khi bắt đầu) and slams shut once the player has left the room
 * (Không of "Có ai trong vùng"). Reaching the flag wins.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const DOOR_X = -6;
const FLAG_X = 7;

/** The tall brown block that shuts the way out. */
const isDoor: NodeFilter = (n) => paramOf(n, 'type') !== 'pickup' && (vecParam(n, 'size')?.y ?? 0) >= 4;

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -9, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 30, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'door',
    kind: 'block',
    x: 560,
    y: 20,
    params: { position: { x: DOOR_X, y: 3, z: 0 }, size: { x: 1, y: 5, z: 1 }, color: '#92400e' },
  },
  {
    alias: 'flag',
    kind: 'block',
    x: 560,
    y: 380,
    params: { type: 'pickup', position: { x: FLAG_X, y: 1, z: 0 }, size: { x: 0.8, y: 1.2, z: 1 }, color: '#facc15' },
  },
  {
    alias: 'room',
    kind: 'zone',
    x: 300,
    y: 600,
    params: { center: { x: -6, y: 2, z: 0 }, size: { x: 12, y: 6, z: 4 }, filter: 'player', color: '#38bdf8' },
  },
  { alias: 'touch', kind: 'touch', x: 820, y: 20 },
  { alias: 'end', kind: 'win-lose', x: 1080, y: 20 },
];
const WIRES: BuildArgs[2] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['hero', 'self', 'touch', 'a'],
  ['flag', 'self', 'touch', 'b'],
  ['touch', 'touching', 'end', 'win'],
];

const START_FIRED: Endpoint = { kind: 'on-start', port: 'fired' };
const DOOR_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isDoor };
const DOOR_SHOW: Endpoint = { kind: 'block', port: 'show', where: isDoor };
const ROOM_INSIDE: Endpoint = { kind: 'zone', port: 'inside' };
const NOT_IN: Endpoint = { kind: 'not', port: 'in' };
const NOT_OUT: Endpoint = { kind: 'not', port: 'out' };

export function createSecretDoorLesson(kit: LessonKit): Lesson {
  return {
    id: 'secret-door',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-on-start', 'on-start'), title: T.onStart.title, text: T.onStart.text, explain: T.onStart.explain },
      { ...kit.wireStep('wire-open', START_FIRED, DOOR_HIDE), title: T.open.title, text: T.open.text, explain: T.open.explain },
      { ...kit.addStep('add-not', 'not'), title: T.not.title, text: T.not.text, explain: T.not.explain },
      { ...kit.wireStep('wire-not-in', ROOM_INSIDE, NOT_IN), title: T.notIn.title, text: T.notIn.text, explain: T.notIn.explain },
      { ...kit.wireStep('wire-close', NOT_OUT, DOOR_SHOW), title: T.close.title, text: T.close.text, explain: T.close.explain },
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
