import type { GraphNode, Params } from '../engine/types';
import { numParam, paramOf, vecParam, type Endpoint, type NodeFilter } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import { FACTORY_TEXT as T } from './text-vi-course-d';
import type { Lesson, Snapshot, TargetList } from './types';

/**
 * "Dự án cuối: Xưởng đóng gói". The board arrives half built: a conveyor, a bot with its walking and sequence
 * bricks, two tagged crates and their zones. The learner wires the rest together (start screen, timer -> spawner on
 * the belt, the bot's pick-up/put-down signal, goods filters, counter, meter, win). The finished board is winnable
 * without any player input: the bot sorts the two crates, three boxes pile up at the end of the belt.
 */

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

// ---------- world layout (side view, floor top at y = 0.5) ----------

const BOT_HOME_X = -10;
const CRATE_RED_X = -8.5;
const ZONE_RED_X = -6;
const CRATE_BLUE_X = -3.5;
const ZONE_BLUE_X = -1;
const BELT_X = 6;
const BELT_LENGTH = 6;
const WALL_X = 9.5;
const BIN_X = 8;
const BOXES_NEEDED = 3;
const SORTED_NEEDED = 2;

const TAG_RED = 'đỏ';
const TAG_BLUE = 'xanh';

const at = (col: number, row: number): { x: number; y: number } => ({ x: 20 + col * 250, y: 20 + row * 200 });
const goParams = (x: number): Params => ({ targetPos: { x, y: 1, z: 0 }, stopDistance: 0.5 });
const zoneParams = (x: number, color: string, size: number): Params => ({
  center: { x, y: 1.5, z: 0 },
  size: { x: size, y: 3, z: 2 },
  filter: 'item',
  color,
});
const pad = (x: number, color: string): Params => ({
  type: 'pickup',
  position: { x, y: 0.6, z: 0 },
  size: { x: 2.4, y: 0.2, z: 1 },
  color,
});
const crate = (x: number, color: string, tag: string): Params => ({
  position: { x, y: 0.85, z: 0 },
  size: { x: 0.7, y: 0.7, z: 0.7 },
  color,
  shape: 'crate',
  tag,
});

/** The "Hoặc" bricks that gather signals are told apart by where they sit on the board. */
const OR_ARRIVED_POS = at(3, 1);
const OR_PACKED_POS = at(7, 2);
const AND_POS = at(3, 3);
const ZONE_RED_POS = at(4, 2);
const ZONE_BLUE_POS = at(5, 2);

const NODES: NodeSpec[] = [
  { alias: 'bot', kind: 'character', ...at(0, 0), params: { position: { x: BOT_HOME_X, y: 1, z: 0 }, color: '#f59e0b', look: 'robot', role: 'bot' } },
  { alias: 'go-crate-red', kind: 'go-to', ...at(1, 0), params: goParams(CRATE_RED_X) },
  { alias: 'go-zone-red', kind: 'go-to', ...at(2, 0), params: goParams(ZONE_RED_X) },
  { alias: 'go-crate-blue', kind: 'go-to', ...at(3, 0), params: goParams(CRATE_BLUE_X) },
  { alias: 'go-zone-blue', kind: 'go-to', ...at(4, 0), params: goParams(ZONE_BLUE_X) },
  { alias: 'add-1', kind: 'math', ...at(5, 0) },
  { alias: 'add-2', kind: 'math', ...at(6, 0) },
  { alias: 'add-3', kind: 'math', ...at(7, 0) },
  { alias: 'sequence', kind: 'sequence', ...at(0, 1), params: { stepCount: 4 } },
  { alias: 'or-1', kind: 'or', ...at(1, 1) },
  { alias: 'or-2', kind: 'or', ...at(2, 1) },
  { alias: 'or-arrived', kind: 'or', ...OR_ARRIVED_POS },
  { alias: 'carry', kind: 'carry', ...at(4, 1), params: { mode: 'toggle' } },
  { alias: 'timer', kind: 'timer', ...at(5, 1), params: { seconds: 2 } },
  {
    alias: 'spawner',
    kind: 'spawner',
    ...at(6, 1),
    params: {
      template: 'item',
      shape: 'crate',
      color: '#d97706',
      position: { x: -(BELT_LENGTH / 2) + 0.5, y: 3, z: 0 },
      maxAlive: BOXES_NEEDED,
      lifetime: 0,
    },
  },
  { alias: 'or-again', kind: 'or', ...at(7, 1) },
  { alias: 'crate-red', kind: 'item', ...at(0, 2), params: crate(CRATE_RED_X, '#dc2626', TAG_RED) },
  { alias: 'crate-blue', kind: 'item', ...at(1, 2), params: crate(CRATE_BLUE_X, '#2563eb', TAG_BLUE) },
  { alias: 'pad-red', kind: 'block', ...at(2, 2), params: pad(ZONE_RED_X, '#fca5a5') },
  { alias: 'pad-blue', kind: 'block', ...at(3, 2), params: pad(ZONE_BLUE_X, '#93c5fd') },
  { alias: 'zone-red', kind: 'zone', ...ZONE_RED_POS, params: zoneParams(ZONE_RED_X, '#ef4444', 2.4) },
  { alias: 'zone-blue', kind: 'zone', ...ZONE_BLUE_POS, params: zoneParams(ZONE_BLUE_X, '#3b82f6', 2.4) },
  { alias: 'zone-bin', kind: 'zone', ...at(6, 2), params: { ...zoneParams(BIN_X, '#22c55e', 3), minCount: BOXES_NEEDED } },
  { alias: 'or-packed', kind: 'or', ...OR_PACKED_POS },
  { alias: 'floor', kind: 'block', ...at(0, 3), params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'belt',
    kind: 'block',
    ...at(1, 3),
    params: { style: 'conveyor', position: { x: BELT_X, y: 0.7, z: 0 }, size: { x: BELT_LENGTH, y: 0.4, z: 1 }, color: '#475569' },
  },
  { alias: 'wall', kind: 'block', ...at(2, 3), params: { position: { x: WALL_X, y: 2, z: 0 }, size: { x: 1, y: 3, z: 1 }, color: '#78716c' } },
  { alias: 'and', kind: 'and', ...AND_POS },
];

const WIRES: WireSpec[] = [
  ['bot', 'self', 'go-crate-red', 'self'],
  ['bot', 'self', 'go-zone-red', 'self'],
  ['bot', 'self', 'go-crate-blue', 'self'],
  ['bot', 'self', 'go-zone-blue', 'self'],
  ['go-crate-red', 'moveX', 'add-1', 'a'],
  ['go-zone-red', 'moveX', 'add-1', 'b'],
  ['add-1', 'out', 'add-2', 'a'],
  ['go-crate-blue', 'moveX', 'add-2', 'b'],
  ['add-2', 'out', 'add-3', 'a'],
  ['go-zone-blue', 'moveX', 'add-3', 'b'],
  ['add-3', 'out', 'bot', 'moveX'],
  ['sequence', 'step1', 'go-crate-red', 'go'],
  ['sequence', 'step2', 'go-zone-red', 'go'],
  ['sequence', 'step3', 'go-crate-blue', 'go'],
  ['sequence', 'step4', 'go-zone-blue', 'go'],
  ['go-crate-red', 'arrivedPulse', 'or-1', 'a'],
  ['go-zone-red', 'arrivedPulse', 'or-1', 'b'],
  ['or-1', 'out', 'or-2', 'a'],
  ['go-crate-blue', 'arrivedPulse', 'or-2', 'b'],
  ['or-2', 'out', 'or-arrived', 'a'],
  ['go-zone-blue', 'arrivedPulse', 'or-arrived', 'b'],
  ['bot', 'self', 'carry', 'character'],
  ['timer', 'done', 'or-again', 'a'],
  ['or-again', 'out', 'timer', 'reset'],
  ['zone-red', 'entered', 'or-packed', 'a'],
  ['zone-blue', 'entered', 'or-packed', 'b'],
  ['zone-bin', 'inside', 'and', 'b'],
];

// ---------- endpoints and checks ----------

const atPos =
  (p: { x: number; y: number }): NodeFilter =>
  (n) =>
    n.pos.x === p.x && n.pos.y === p.y;
const isBelt: NodeFilter = (n) => paramOf(n, 'style') === 'conveyor';
const centerAt =
  (x: number): NodeFilter =>
  (n) =>
    Math.abs((vecParam(n, 'center')?.x ?? Number.NaN) - x) < 0.01;

const START_STARTED: Endpoint = { kind: 'ui-start', port: 'started' };
const TIMER_RUN: Endpoint = { kind: 'timer', port: 'run' };
const TIMER_DONE: Endpoint = { kind: 'timer', port: 'done' };
const SPAWN_IN: Endpoint = { kind: 'spawner', port: 'spawn' };
const SPAWN_AT: Endpoint = { kind: 'spawner', port: 'at' };
const BELT_SELF: Endpoint = { kind: 'block', port: 'self', where: isBelt };
const ARRIVED_OUT: Endpoint = { kind: 'or', port: 'out', where: atPos(OR_ARRIVED_POS) };
const SEQ_NEXT: Endpoint = { kind: 'sequence', port: 'next' };
const CARRY_GRAB: Endpoint = { kind: 'carry', port: 'grab' };
const PACKED_OUT: Endpoint = { kind: 'or', port: 'out', where: atPos(OR_PACKED_POS) };
const COUNTER_UP: Endpoint = { kind: 'counter', port: 'up' };
const COUNTER_VALUE: Endpoint = { kind: 'counter', port: 'value' };
const COUNTER_REACHED: Endpoint = { kind: 'counter', port: 'reached' };
const METER_VALUE: Endpoint = { kind: 'ui-meter', port: 'value' };
const AND_A: Endpoint = { kind: 'and', port: 'a' };
const AND_OUT: Endpoint = { kind: 'and', port: 'out' };
const WIN_IN: Endpoint = { kind: 'win-lose', port: 'win' };

const goodsIs = (n: GraphNode, tag: string): boolean => {
  const v = paramOf(n, 'goods');
  return typeof v === 'string' && v.normalize('NFC') === tag;
};

const hasZoneGoods =
  (x: number, tag: string) =>
  (s: Snapshot): boolean =>
    s.graph.nodes.some((n) => n.kind === 'zone' && centerAt(x)(n) && goodsIs(n, tag));

/** A property row (when its node is selected), else the node itself. */
function paramRowTarget(s: Snapshot, kind: string, where: NodeFilter, param: string): TargetList {
  const node = s.graph.nodes.find((n) => n.kind === kind && where(n));
  if (!node) return [];
  return [[`.prop-row[data-param="${param}"]`, `.wc-node[data-id="${node.id}"]`]];
}

const anyNode: NodeFilter = () => true;

export function createCapstoneFactoryLesson(kit: LessonKit): Lesson {
  const wire = (id: string, from: Endpoint, to: Endpoint, t: { title: string; text: string; explain?: string }) => ({
    ...kit.wireStep(id, from, to),
    title: t.title,
    text: t.text,
    ...(t.explain ? { explain: t.explain } : {}),
  });
  const add = (id: string, kind: string, t: { title: string; text: string; explain?: string }) => ({
    ...kit.addStep(id, kind),
    title: t.title,
    text: t.text,
    ...(t.explain ? { explain: t.explain } : {}),
  });
  return {
    id: 'capstone-factory',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      add('add-start', 'ui-start', T.start),
      wire('wire-start-timer', START_STARTED, TIMER_RUN, T.startTimer),
      wire('wire-timer-spawn', TIMER_DONE, SPAWN_IN, T.timerSpawn),
      wire('wire-belt-at', BELT_SELF, SPAWN_AT, T.beltAt),
      wire('wire-next', ARRIVED_OUT, SEQ_NEXT, T.next),
      wire('wire-grab', ARRIVED_OUT, CARRY_GRAB, T.grab),
      {
        id: 'goods-red',
        title: T.goodsRed.title,
        text: T.goodsRed.text,
        explain: T.goodsRed.explain,
        target: (s) => paramRowTarget(s, 'zone', centerAt(ZONE_RED_X), 'goods'),
        check: hasZoneGoods(ZONE_RED_X, TAG_RED),
      },
      {
        id: 'goods-blue',
        title: T.goodsBlue.title,
        text: T.goodsBlue.text,
        target: (s) => paramRowTarget(s, 'zone', centerAt(ZONE_BLUE_X), 'goods'),
        check: hasZoneGoods(ZONE_BLUE_X, TAG_BLUE),
      },
      add('add-counter', 'counter', T.counter),
      {
        id: 'counter-target',
        title: T.target.title,
        text: T.target.text,
        target: (s) => paramRowTarget(s, 'counter', anyNode, 'target'),
        check: (s) => s.graph.nodes.some((n) => n.kind === 'counter' && numParam(n, 'target') === SORTED_NEEDED),
      },
      wire('wire-packed', PACKED_OUT, COUNTER_UP, T.packed),
      add('add-meter', 'ui-meter', T.meter),
      {
        id: 'meter-setup',
        title: T.meterSetup.title,
        text: T.meterSetup.text,
        explain: T.meterSetup.explain,
        target: (s) => [...paramRowTarget(s, 'ui-meter', anyNode, 'label'), ...paramRowTarget(s, 'ui-meter', anyNode, 'max')],
        check: (s) =>
          s.graph.nodes.some((n) => {
            if (n.kind !== 'ui-meter') return false;
            const label = paramOf(n, 'label');
            return numParam(n, 'max') === SORTED_NEEDED && typeof label === 'string' && label.trim() !== '' && label.trim() !== 'Máu';
          }),
      },
      wire('wire-meter', COUNTER_VALUE, METER_VALUE, T.meterWire),
      wire('wire-reached', COUNTER_REACHED, AND_A, T.reached),
      add('add-end', 'win-lose', T.end),
      wire('wire-win', AND_OUT, WIN_IN, T.win),
      { id: 'play', title: T.play.title, text: T.play.text, explain: T.play.explain, target: () => [kit.playButton], check: (s) => s.playing },
      { id: 'win', title: T.won.title, text: T.won.text, check: (s) => s.ended === 'win' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
