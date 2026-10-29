import type { Params } from '../engine/types';
import { type Endpoint, hasNode, nodesOfKind, numParam, paramOf } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import type { Lesson, Snapshot, TargetList } from './types';
import { UI_CHEST_TEXT as T } from './text-vi-ui';

/**
 * Lesson 17, "Rương bí mật": click an object to win, with a countdown bar that ends the game when it runs out.
 * Self-contained: the shared step builders arrive through `LessonKit`.
 */

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

const COUNTDOWN_SECONDS = 10;

const NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'chest',
    kind: 'block',
    x: 560,
    y: 20,
    params: { type: 'pickup', position: { x: 3, y: 1, z: 0 }, size: { x: 1.4, y: 1, z: 1 }, color: '#b45309' },
  },
];
const WIRES: WireSpec[] = [['stick', 'x', 'hero', 'moveX']];

const CHEST_SELF: Endpoint = { kind: 'block', port: 'self', where: (n) => paramOf(n, 'type') === 'pickup' };
const PICK_TARGET: Endpoint = { kind: 'ui-pick', port: 'target' };
const PICK_PRESSED: Endpoint = { kind: 'ui-pick', port: 'pressed' };
const WIN: Endpoint = { kind: 'win-lose', port: 'win' };
const LOSE: Endpoint = { kind: 'win-lose', port: 'lose' };
const TIMER_LEFT: Endpoint = { kind: 'timer', port: 'left' };
const TIMER_DONE: Endpoint = { kind: 'timer', port: 'done' };
const METER_VALUE: Endpoint = { kind: 'ui-meter', port: 'value' };

const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;
const paletteSel = (kind: string): string => `.palette-item[data-kind="${kind}"]`;

/** The property row of the first node of `kind` (when selected), else the node itself. */
function paramTarget(snap: Snapshot, kind: string, id: string): TargetList {
  const node = nodesOfKind(snap.graph, kind)[0];
  return [node ? [paramSel(id), `.wc-node[data-id="${node.id}"]`] : paramSel(id)];
}

const timerSet = (s: Snapshot): boolean =>
  nodesOfKind(s.graph, 'timer').some((n) => numParam(n, 'seconds') === COUNTDOWN_SECONDS);
const meterSet = (s: Snapshot): boolean =>
  nodesOfKind(s.graph, 'ui-meter').some((n) => numParam(n, 'max') === COUNTDOWN_SECONDS);

export function createUiChestLesson(kit: LessonKit): Lesson {
  return {
    id: 'ui-chest',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-pick', 'ui-pick'), title: T.pick.title, text: T.pick.text, explain: T.pick.explain },
      { ...kit.wireStep('wire-chest', CHEST_SELF, PICK_TARGET), title: T.wireChest.title, text: T.wireChest.text },
      { ...kit.addStep('add-win-lose', 'win-lose'), title: T.winLose.title, text: T.winLose.text },
      { ...kit.wireStep('wire-win', PICK_PRESSED, WIN), title: T.wireWin.title, text: T.wireWin.text },
      {
        ...kit.addStep('add-timer', 'timer'),
        title: T.timer.title,
        text: T.timer.text,
        explain: T.timer.explain,
        check: (s) => hasNode(s.graph, 'timer') && timerSet(s),
        target: (s) => (hasNode(s.graph, 'timer') ? paramTarget(s, 'timer', 'seconds') : [paletteSel('timer')]),
      },
      {
        ...kit.addStep('add-meter', 'ui-meter'),
        title: T.meter.title,
        text: T.meter.text,
        explain: T.meter.explain,
        check: (s) => hasNode(s.graph, 'ui-meter') && meterSet(s),
        target: (s) => (hasNode(s.graph, 'ui-meter') ? paramTarget(s, 'ui-meter', 'max') : [paletteSel('ui-meter')]),
      },
      { ...kit.wireStep('wire-meter', TIMER_LEFT, METER_VALUE), title: T.wireMeter.title, text: T.wireMeter.text },
      { ...kit.wireStep('wire-lose', TIMER_DONE, LOSE), title: T.wireLose.title, text: T.wireLose.text },
      {
        id: 'play',
        title: T.play.title,
        text: T.play.text,
        explain: T.play.explain,
        target: () => [kit.playButton],
        check: (s) => s.playing,
      },
      { id: 'win', title: T.win.title, text: T.win.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
