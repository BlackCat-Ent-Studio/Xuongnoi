import { createNode } from '../editor/editor-state';
import type { Board, Graph, GraphNode, Params } from '../engine/types';
import { addWire } from '../engine/wiring';
import {
  type Endpoint,
  type NodeFilter,
  hasNode,
  hasWire,
  isFloor,
  isPickup,
  nodesOfKind,
  numParam,
  paramOf,
  vecParam,
} from './graph-checks';
import { LESSON_TEXT as T } from './text-vi';
import type { Lesson, Snapshot, Step, TargetList } from './types';

// ---------- target helpers ----------

const paletteSel = (kind: string): string => `.palette-item[data-kind="${kind}"]`;
const PLAY_BTN = '[data-tut="play"]';
const paramSel = (id: string): string => `.prop-row[data-param="${id}"]`;

function firstNode(graph: Graph, kind: string, where?: (n: GraphNode) => boolean): GraphNode | undefined {
  return nodesOfKind(graph, kind, where)[0];
}

function nodeSel(graph: Graph, kind: string, where?: (n: GraphNode) => boolean): string | null {
  const n = firstNode(graph, kind, where);
  return n ? `.wc-node[data-id="${n.id}"]` : null;
}

function portSel(graph: Graph, ep: Endpoint, dir: 'in' | 'out'): string | null {
  const n = firstNode(graph, ep.kind, ep.where);
  return n ? `.wc-port[data-node="${n.id}"][data-port="${ep.port}"][data-dir="${dir}"]` : null;
}

/** Both ends of a wire the user should draw. */
function wireTarget(snap: Snapshot, from: Endpoint, to: Endpoint): TargetList {
  return [portSel(snap.graph, from, 'out'), portSel(snap.graph, to, 'in')].filter((s): s is string => s !== null);
}

/** A property row (when the node is selected) or else the node itself. */
function paramTarget(snap: Snapshot, id: string, kind: string, where?: (n: GraphNode) => boolean): TargetList {
  const node = nodeSel(snap.graph, kind, where);
  return [node ? [paramSel(id), node] : paramSel(id)];
}

// ---------- step builders ----------

function addStep(id: string, kind: string, count = 1): Pick<Step, 'id' | 'target' | 'check'> {
  return {
    id,
    target: () => [paletteSel(kind)],
    check: (s) => nodesOfKind(s.graph, kind).length >= count,
  };
}

function wireStep(id: string, from: Endpoint, to: Endpoint): Pick<Step, 'id' | 'target' | 'check'> {
  return {
    id,
    target: (s) => wireTarget(s, from, to),
    check: (s) => hasWire(s.graph, from, to),
  };
}

// ---------- board builder ----------

type NodeSpec = { alias: string; kind: string; x: number; y: number; params?: Params };
type WireSpec = [fromAlias: string, fromPort: string, toAlias: string, toPort: string];

function buildBoard(name: string, nodes: NodeSpec[], wires: WireSpec[]): Board {
  let graph: Graph = { nodes: [], wires: [] };
  const ids = new Map<string, string>();
  for (const spec of nodes) {
    const node = createNode(graph, spec.kind, { x: spec.x, y: spec.y });
    if (!node) throw new Error(`Unknown node kind in lesson board: ${spec.kind}`);
    node.params = { ...node.params, ...spec.params };
    ids.set(spec.alias, node.id);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  }
  for (const [fa, fp, ta, tp] of wires) {
    const from = ids.get(fa);
    const to = ids.get(ta);
    if (!from || !to) throw new Error(`Unknown alias in lesson wire: ${fa} -> ${ta}`);
    const res = addWire(graph, { node: from, port: fp }, { node: to, port: tp });
    if (!('nodes' in res)) throw new Error(`Cannot wire ${fa}.${fp} -> ${ta}.${tp}: ${res.reason}`);
    graph = res;
  }
  return { name, mode: '2d-side', graph };
}

/** Result of lesson 1: a character that walks on a floor and jumps. */
const MOVER_NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'key', kind: 'key', x: 20, y: 190 },
  { alias: 'hero', kind: 'character', x: 300, y: 20 },
  {
    alias: 'floor',
    kind: 'block',
    x: 300,
    y: 370,
    params: { size: { x: 20, y: 1, z: 1 }, color: '#65a30d' },
  },
];
const MOVER_WIRES: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['key', 'held', 'hero', 'jump'],
];

/** Result of lesson 2: the mover plus a star, a touch sensor, a counter and a score display. */
const COLLECTOR_NODES: NodeSpec[] = [
  ...MOVER_NODES,
  {
    alias: 'star',
    kind: 'block',
    x: 560,
    y: 20,
    params: { type: 'pickup', position: { x: 4, y: 1, z: 0 }, color: '#facc15' },
  },
  { alias: 'touch', kind: 'touch', x: 560, y: 190 },
  { alias: 'counter', kind: 'counter', x: 560, y: 340 },
  { alias: 'show', kind: 'show-number', x: 560, y: 520 },
];
const COLLECTOR_WIRES: WireSpec[] = [
  ...MOVER_WIRES,
  ['hero', 'self', 'touch', 'a'],
  ['star', 'self', 'touch', 'b'],
  ['touch', 'touching', 'star', 'hide'],
  ['touch', 'began', 'counter', 'up'],
  ['counter', 'value', 'show', 'value'],
];

// ---------- endpoints used by several lessons ----------

const STICK_X: Endpoint = { kind: 'stick', port: 'x' };
const HERO_MOVE_X: Endpoint = { kind: 'character', port: 'moveX' };
const KEY_HELD: Endpoint = { kind: 'key', port: 'held' };
const HERO_JUMP: Endpoint = { kind: 'character', port: 'jump' };
const HERO_SELF: Endpoint = { kind: 'character', port: 'self' };
const TOUCH_A: Endpoint = { kind: 'touch', port: 'a' };
const STAR_SELF: Endpoint = { kind: 'block', port: 'self', where: isPickup };
const TOUCH_B: Endpoint = { kind: 'touch', port: 'b' };
const TOUCHING: Endpoint = { kind: 'touch', port: 'touching' };
const STAR_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isPickup };
const TOUCH_BEGAN: Endpoint = { kind: 'touch', port: 'began' };
const COUNTER_UP: Endpoint = { kind: 'counter', port: 'up' };
const COUNTER_VALUE: Endpoint = { kind: 'counter', port: 'value' };
const SHOW_VALUE: Endpoint = { kind: 'show-number', port: 'value' };
const COUNTER_REACHED: Endpoint = { kind: 'counter', port: 'reached' };
const WIN_IN: Endpoint = { kind: 'win-lose', port: 'win' };
const LOSE_IN: Endpoint = { kind: 'win-lose', port: 'lose' };
const HERO_Y: Endpoint = { kind: 'character', port: 'y' };
const COMPARE_A: Endpoint = { kind: 'compare', port: 'a' };
const COMPARE_B: Endpoint = { kind: 'compare', port: 'b' };
const COMPARE_OUT: Endpoint = { kind: 'compare', port: 'out' };
const CONST_VALUE: Endpoint = { kind: 'const', port: 'value' };

// ---------- lesson 1 ----------

const lesson1: Lesson = {
  id: 'walk-jump',
  title: T.l1.title,
  summary: T.l1.summary,
  createBoard: () => buildBoard(T.l1.boardName, [], []),
  steps: [
    { id: 'intro', title: T.l1.intro.title, text: T.l1.intro.text, explain: T.l1.intro.explain },
    {
      ...addStep('add-floor', 'block'),
      title: T.l1.floor.title,
      text: T.l1.floor.text,
      explain: T.l1.floor.explain,
    },
    {
      id: 'floor-size',
      title: T.l1.size.title,
      text: T.l1.size.text,
      explain: T.l1.size.explain,
      target: (s) => paramTarget(s, 'size', 'block'),
      check: (s) => hasNode(s.graph, 'block', isFloor),
    },
    {
      ...addStep('add-hero', 'character'),
      title: T.l1.hero.title,
      text: T.l1.hero.text,
      explain: T.l1.hero.explain,
    },
    {
      id: 'first-play',
      title: T.l1.play.title,
      text: T.l1.play.text,
      explain: T.l1.play.explain,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    {
      id: 'back-to-edit',
      title: T.l1.edit.title,
      text: T.l1.edit.text,
      target: () => [PLAY_BTN],
      check: (s) => !s.playing,
    },
    {
      ...addStep('add-stick', 'stick'),
      title: T.l1.stick.title,
      text: T.l1.stick.text,
      explain: T.l1.stick.explain,
    },
    {
      ...wireStep('wire-stick', STICK_X, HERO_MOVE_X),
      title: T.l1.wireStick.title,
      text: T.l1.wireStick.text,
      explain: T.l1.wireStick.explain,
    },
    {
      ...addStep('add-key', 'key'),
      title: T.l1.key.title,
      text: T.l1.key.text,
      explain: T.l1.key.explain,
    },
    {
      ...wireStep('wire-key', KEY_HELD, HERO_JUMP),
      title: T.l1.wireKey.title,
      text: T.l1.wireKey.text,
      explain: T.l1.wireKey.explain,
    },
    {
      id: 'play-move',
      title: T.l1.playMove.title,
      text: T.l1.playMove.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    { id: 'done', title: T.l1.done.title, text: T.l1.done.text },
  ],
};

// ---------- lesson 2 ----------

const lesson2: Lesson = {
  id: 'collect-stars',
  title: T.l2.title,
  summary: T.l2.summary,
  createBoard: () => buildBoard(T.l2.boardName, MOVER_NODES, MOVER_WIRES),
  steps: [
    { id: 'intro', title: T.l2.intro.title, text: T.l2.intro.text, explain: T.l2.intro.explain },
    {
      ...addStep('add-star', 'block', 2),
      title: T.l2.star.title,
      text: T.l2.star.text,
      explain: T.l2.star.explain,
    },
    {
      id: 'star-type',
      title: T.l2.type.title,
      text: T.l2.type.text,
      explain: T.l2.type.explain,
      target: (s) => paramTarget(s, 'type', 'block', (n) => !isFloor(n)),
      check: (s) => hasNode(s.graph, 'block', isPickup),
    },
    {
      id: 'star-place',
      title: T.l2.place.title,
      text: T.l2.place.text,
      explain: T.l2.place.explain,
      target: (s) => paramTarget(s, 'position', 'block', isPickup),
      check: (s) =>
        nodesOfKind(s.graph, 'block', isPickup).some((n) => {
          const p = vecParam(n, 'position');
          return p !== null && Math.abs(p.x) >= 2;
        }),
    },
    {
      ...addStep('add-touch', 'touch'),
      title: T.l2.touch.title,
      text: T.l2.touch.text,
      explain: T.l2.touch.explain,
    },
    {
      ...wireStep('wire-touch-a', HERO_SELF, TOUCH_A),
      title: T.l2.wireA.title,
      text: T.l2.wireA.text,
      explain: T.l2.wireA.explain,
    },
    {
      ...wireStep('wire-touch-b', STAR_SELF, TOUCH_B),
      title: T.l2.wireB.title,
      text: T.l2.wireB.text,
    },
    {
      ...wireStep('wire-hide', TOUCHING, STAR_HIDE),
      title: T.l2.hide.title,
      text: T.l2.hide.text,
      explain: T.l2.hide.explain,
    },
    {
      ...addStep('add-counter', 'counter'),
      title: T.l2.counter.title,
      text: T.l2.counter.text,
      explain: T.l2.counter.explain,
    },
    {
      ...wireStep('wire-count', TOUCH_BEGAN, COUNTER_UP),
      title: T.l2.wireCount.title,
      text: T.l2.wireCount.text,
      explain: T.l2.wireCount.explain,
    },
    {
      ...addStep('add-show', 'show-number'),
      title: T.l2.show.title,
      text: T.l2.show.text,
      explain: T.l2.show.explain,
    },
    {
      ...wireStep('wire-show', COUNTER_VALUE, SHOW_VALUE),
      title: T.l2.wireShow.title,
      text: T.l2.wireShow.text,
    },
    {
      id: 'play-collect',
      title: T.l2.play.title,
      text: T.l2.play.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    { id: 'done', title: T.l2.done.title, text: T.l2.done.text },
  ],
};

// ---------- lesson 3 ----------

/** The counter's goal must be reachable: between 1 and the number of stars on the board. */
function counterGoalReachable(s: Snapshot): boolean {
  const stars = nodesOfKind(s.graph, 'block', isPickup).length;
  return nodesOfKind(s.graph, 'counter').some((n) => {
    const t = numParam(n, 'target');
    return t !== null && t >= 1 && t <= Math.max(1, stars);
  });
}

const lesson3: Lesson = {
  id: 'win-lose',
  title: T.l3.title,
  summary: T.l3.summary,
  createBoard: () => buildBoard(T.l3.boardName, COLLECTOR_NODES, COLLECTOR_WIRES),
  steps: [
    { id: 'intro', title: T.l3.intro.title, text: T.l3.intro.text, explain: T.l3.intro.explain },
    {
      id: 'goal',
      title: T.l3.goal.title,
      text: T.l3.goal.text,
      explain: T.l3.goal.explain,
      target: (s) => paramTarget(s, 'target', 'counter'),
      check: counterGoalReachable,
    },
    {
      ...addStep('add-end', 'win-lose'),
      title: T.l3.end.title,
      text: T.l3.end.text,
      explain: T.l3.end.explain,
    },
    {
      ...wireStep('wire-win', COUNTER_REACHED, WIN_IN),
      title: T.l3.wireWin.title,
      text: T.l3.wireWin.text,
    },
    {
      ...addStep('add-compare', 'compare'),
      title: T.l3.compare.title,
      text: T.l3.compare.text,
      explain: T.l3.compare.explain,
    },
    {
      ...wireStep('wire-height', HERO_Y, COMPARE_A),
      title: T.l3.wireHeight.title,
      text: T.l3.wireHeight.text,
      explain: T.l3.wireHeight.explain,
    },
    {
      id: 'compare-op',
      title: T.l3.op.title,
      text: T.l3.op.text,
      target: (s) => paramTarget(s, 'op', 'compare'),
      check: (s) => nodesOfKind(s.graph, 'compare').some((n) => ['lt', 'le'].includes(String(paramOf(n, 'op')))),
    },
    {
      ...addStep('add-const', 'const'),
      title: T.l3.constant.title,
      text: T.l3.constant.text,
      explain: T.l3.constant.explain,
    },
    {
      id: 'const-value',
      title: T.l3.constValue.title,
      text: T.l3.constValue.text,
      target: (s) => paramTarget(s, 'value', 'const'),
      check: (s) => nodesOfKind(s.graph, 'const').some((n) => (numParam(n, 'value') ?? 0) < 0),
    },
    {
      ...wireStep('wire-limit', CONST_VALUE, COMPARE_B),
      title: T.l3.wireLimit.title,
      text: T.l3.wireLimit.text,
    },
    {
      ...wireStep('wire-lose', COMPARE_OUT, LOSE_IN),
      title: T.l3.wireLose.title,
      text: T.l3.wireLose.text,
    },
    {
      id: 'play-win',
      title: T.l3.play.title,
      text: T.l3.play.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    {
      id: 'win',
      title: T.l3.win.title,
      text: T.l3.win.text,
      explain: T.l3.win.explain,
      check: (s) => s.ended === 'win',
    },
    { id: 'done', title: T.l3.done.title, text: T.l3.done.text },
  ],
};

// ---------- lesson 4 ----------

const isCarryable: NodeFilter = (n) => paramOf(n, 'carryable') !== 'no';
const isLock: NodeFilter = (n) => !isCarryable(n);
const isDoor: NodeFilter = (n) => !isPickup(n) && !isFloor(n);
const keyCode =
  (code: string): NodeFilter =>
  (n) =>
    paramOf(n, 'key') === code;

/** The key node added most recently (nodes are appended), so the hint never points at the old jump key. */
function newestKeyTarget(snap: Snapshot): TargetList {
  const keys = nodesOfKind(snap.graph, 'key');
  const node = keys[keys.length - 1];
  return [node ? [paramSel('key'), `.wc-node[data-id="${node.id}"]`] : paramSel('key')];
}

/** The mover plus a locked door, a fixed "lock" item and a goal to reach. */
const KEY_DOOR_NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'key', kind: 'key', x: 20, y: 190 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -4, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 370, params: { size: { x: 20, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'door',
    kind: 'block',
    x: 300,
    y: 520,
    params: { position: { x: 4, y: 2, z: 0 }, size: { x: 1, y: 3, z: 1 }, color: '#92400e' },
  },
  {
    alias: 'lock',
    kind: 'item',
    x: 300,
    y: 670,
    params: { position: { x: 2.6, y: 1, z: 0 }, color: '#7c3aed', shape: 'crate', carryable: 'no' },
  },
  {
    alias: 'goal',
    kind: 'block',
    x: 560,
    y: 20,
    params: { type: 'pickup', position: { x: 7, y: 1, z: 0 }, color: '#22c55e' },
  },
  { alias: 'touch', kind: 'touch', x: 560, y: 190 },
  { alias: 'end', kind: 'win-lose', x: 560, y: 340 },
];
const KEY_DOOR_WIRES: WireSpec[] = [
  ...MOVER_WIRES,
  ['hero', 'self', 'touch', 'a'],
  ['goal', 'self', 'touch', 'b'],
  ['touch', 'touching', 'end', 'win'],
];

const CARRY_WHO: Endpoint = { kind: 'carry', port: 'character' };
const GRAB_PRESSED: Endpoint = { kind: 'key', port: 'pressed', where: keyCode('KeyE') };
const CARRY_GRAB: Endpoint = { kind: 'carry', port: 'grab' };
const INTERACT_WHO: Endpoint = { kind: 'interact', port: 'character' };
const USE_PRESSED: Endpoint = { kind: 'key', port: 'pressed', where: keyCode('KeyF') };
const INTERACT_PRESS: Endpoint = { kind: 'interact', port: 'press' };
const LOCK_INTERACTED: Endpoint = { kind: 'item', port: 'interacted', where: isLock };
const AND_A: Endpoint = { kind: 'and', port: 'a' };
const CARRY_HOLDING: Endpoint = { kind: 'carry', port: 'holding' };
const AND_B: Endpoint = { kind: 'and', port: 'b' };
const AND_OUT: Endpoint = { kind: 'and', port: 'out' };
const DOOR_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isDoor };

const lesson4: Lesson = {
  id: 'carry-use',
  title: T.l4.title,
  summary: T.l4.summary,
  createBoard: () => buildBoard(T.l4.boardName, KEY_DOOR_NODES, KEY_DOOR_WIRES),
  steps: [
    { id: 'intro', title: T.l4.intro.title, text: T.l4.intro.text, explain: T.l4.intro.explain },
    {
      ...addStep('add-item', 'item', 2),
      title: T.l4.item.title,
      text: T.l4.item.text,
      explain: T.l4.item.explain,
    },
    {
      id: 'item-shape',
      title: T.l4.shape.title,
      text: T.l4.shape.text,
      explain: T.l4.shape.explain,
      target: (s) => paramTarget(s, 'shape', 'item', isCarryable),
      check: (s) => hasNode(s.graph, 'item', (n) => isCarryable(n) && paramOf(n, 'shape') === 'key'),
    },
    {
      ...addStep('add-carry', 'carry'),
      title: T.l4.carry.title,
      text: T.l4.carry.text,
      explain: T.l4.carry.explain,
    },
    {
      ...wireStep('wire-carry', HERO_SELF, CARRY_WHO),
      title: T.l4.wireCarry.title,
      text: T.l4.wireCarry.text,
    },
    {
      ...addStep('add-key-e', 'key', 2),
      title: T.l4.keyE.title,
      text: T.l4.keyE.text,
      explain: T.l4.keyE.explain,
    },
    {
      id: 'key-e-code',
      title: T.l4.keyECode.title,
      text: T.l4.keyECode.text,
      target: newestKeyTarget,
      check: (s) => hasNode(s.graph, 'key', keyCode('KeyE')),
    },
    {
      ...wireStep('wire-grab', GRAB_PRESSED, CARRY_GRAB),
      title: T.l4.wireGrab.title,
      text: T.l4.wireGrab.text,
      explain: T.l4.wireGrab.explain,
    },
    {
      id: 'play-carry',
      title: T.l4.playCarry.title,
      text: T.l4.playCarry.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    {
      id: 'back-to-edit',
      title: T.l4.edit.title,
      text: T.l4.edit.text,
      target: () => [PLAY_BTN],
      check: (s) => !s.playing,
    },
    {
      ...addStep('add-interact', 'interact'),
      title: T.l4.interact.title,
      text: T.l4.interact.text,
      explain: T.l4.interact.explain,
    },
    {
      ...wireStep('wire-interact', HERO_SELF, INTERACT_WHO),
      title: T.l4.wireInteract.title,
      text: T.l4.wireInteract.text,
    },
    {
      ...addStep('add-key-f', 'key', 3),
      title: T.l4.keyF.title,
      text: T.l4.keyF.text,
    },
    {
      id: 'key-f-code',
      title: T.l4.keyFCode.title,
      text: T.l4.keyFCode.text,
      target: newestKeyTarget,
      check: (s) => hasNode(s.graph, 'key', keyCode('KeyF')),
    },
    {
      ...wireStep('wire-press', USE_PRESSED, INTERACT_PRESS),
      title: T.l4.wirePress.title,
      text: T.l4.wirePress.text,
    },
    {
      ...addStep('add-and', 'and'),
      title: T.l4.and.title,
      text: T.l4.and.text,
      explain: T.l4.and.explain,
    },
    {
      ...wireStep('wire-lock', LOCK_INTERACTED, AND_A),
      title: T.l4.wireLock.title,
      text: T.l4.wireLock.text,
      explain: T.l4.wireLock.explain,
    },
    {
      ...wireStep('wire-holding', CARRY_HOLDING, AND_B),
      title: T.l4.wireHolding.title,
      text: T.l4.wireHolding.text,
    },
    {
      ...wireStep('wire-open', AND_OUT, DOOR_HIDE),
      title: T.l4.wireOpen.title,
      text: T.l4.wireOpen.text,
      explain: T.l4.wireOpen.explain,
    },
    {
      id: 'play-open',
      title: T.l4.play.title,
      text: T.l4.play.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    {
      id: 'win',
      title: T.l4.win.title,
      text: T.l4.win.text,
      explain: T.l4.win.explain,
      check: (s) => s.ended === 'win',
    },
    { id: 'done', title: T.l4.done.title, text: T.l4.done.text },
  ],
};

// ---------- lesson 5 ----------

const isRock: NodeFilter = isDoor;

/** The mover plus a tall rock in the way and a goal to reach. */
const ROCK_NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'key', kind: 'key', x: 20, y: 190 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -4, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 370, params: { size: { x: 20, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'rock',
    kind: 'block',
    x: 300,
    y: 520,
    params: { position: { x: 4, y: 2, z: 0 }, size: { x: 1, y: 3, z: 1 }, color: '#78716c' },
  },
  {
    alias: 'goal',
    kind: 'block',
    x: 560,
    y: 20,
    params: { type: 'pickup', position: { x: 7, y: 1, z: 0 }, color: '#22c55e' },
  },
  { alias: 'touch', kind: 'touch', x: 560, y: 190 },
  { alias: 'end', kind: 'win-lose', x: 560, y: 340 },
];
const ROCK_WIRES: WireSpec[] = [
  ...MOVER_WIRES,
  ['hero', 'self', 'touch', 'a'],
  ['goal', 'self', 'touch', 'b'],
  ['touch', 'touching', 'end', 'win'],
];

const HAND_WHO: Endpoint = { kind: 'hand-tool', port: 'character' };
const HAND_TOGGLE: Endpoint = { kind: 'hand-tool', port: 'toggle' };
const HAND_USE: Endpoint = { kind: 'hand-tool', port: 'use' };
const EQUIP_PRESSED: Endpoint = { kind: 'key', port: 'pressed', where: keyCode('KeyE') };
const SWING_PRESSED: Endpoint = { kind: 'key', port: 'pressed', where: keyCode('KeyF') };
const ROCK_USED_ON: Endpoint = { kind: 'block', port: 'usedOn', where: isRock };
const TOOL_IN_HAND: Endpoint = { kind: 'item', port: 'inHand' };
const ROCK_HIDE: Endpoint = { kind: 'block', port: 'hide', where: isRock };

const lesson5: Lesson = {
  id: 'hand-tools',
  title: T.l5.title,
  summary: T.l5.summary,
  createBoard: () => buildBoard(T.l5.boardName, ROCK_NODES, ROCK_WIRES),
  steps: [
    { id: 'intro', title: T.l5.intro.title, text: T.l5.intro.text, explain: T.l5.intro.explain },
    { ...addStep('add-item', 'item'), title: T.l5.item.title, text: T.l5.item.text },
    {
      id: 'item-shape',
      title: T.l5.shape.title,
      text: T.l5.shape.text,
      explain: T.l5.shape.explain,
      target: (s) => paramTarget(s, 'shape', 'item'),
      check: (s) => hasNode(s.graph, 'item', (n) => paramOf(n, 'shape') === 'pickaxe'),
    },
    {
      id: 'item-hold',
      title: T.l5.hold.title,
      text: T.l5.hold.text,
      explain: T.l5.hold.explain,
      target: (s) => paramTarget(s, 'holdStyle', 'item'),
      check: (s) => hasNode(s.graph, 'item', (n) => paramOf(n, 'holdStyle') === 'hand'),
    },
    {
      ...addStep('add-hand', 'hand-tool'),
      title: T.l5.tool.title,
      text: T.l5.tool.text,
      explain: T.l5.tool.explain,
    },
    { ...wireStep('wire-hand', HERO_SELF, HAND_WHO), title: T.l5.wireTool.title, text: T.l5.wireTool.text },
    { ...addStep('add-key-e', 'key', 2), title: T.l5.keyE.title, text: T.l5.keyE.text },
    {
      id: 'key-e-code',
      title: T.l5.keyECode.title,
      text: T.l5.keyECode.text,
      target: newestKeyTarget,
      check: (s) => hasNode(s.graph, 'key', keyCode('KeyE')),
    },
    {
      ...wireStep('wire-equip', EQUIP_PRESSED, HAND_TOGGLE),
      title: T.l5.wireEquip.title,
      text: T.l5.wireEquip.text,
      explain: T.l5.wireEquip.explain,
    },
    { ...addStep('add-key-f', 'key', 3), title: T.l5.keyF.title, text: T.l5.keyF.text },
    {
      id: 'key-f-code',
      title: T.l5.keyFCode.title,
      text: T.l5.keyFCode.text,
      target: newestKeyTarget,
      check: (s) => hasNode(s.graph, 'key', keyCode('KeyF')),
    },
    {
      ...wireStep('wire-use', SWING_PRESSED, HAND_USE),
      title: T.l5.wireUse.title,
      text: T.l5.wireUse.text,
      explain: T.l5.wireUse.explain,
    },
    {
      id: 'play-tool',
      title: T.l5.playTool.title,
      text: T.l5.playTool.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    {
      id: 'back-to-edit',
      title: T.l5.edit.title,
      text: T.l5.edit.text,
      target: () => [PLAY_BTN],
      check: (s) => !s.playing,
    },
    {
      ...addStep('add-and', 'and'),
      title: T.l5.and.title,
      text: T.l5.and.text,
      explain: T.l5.and.explain,
    },
    { ...wireStep('wire-rock', ROCK_USED_ON, AND_A), title: T.l5.wireRock.title, text: T.l5.wireRock.text },
    {
      ...wireStep('wire-in-hand', TOOL_IN_HAND, AND_B),
      title: T.l5.wireInHand.title,
      text: T.l5.wireInHand.text,
    },
    {
      ...wireStep('wire-break', AND_OUT, ROCK_HIDE),
      title: T.l5.wireBreak.title,
      text: T.l5.wireBreak.text,
      explain: T.l5.wireBreak.explain,
    },
    {
      id: 'play-break',
      title: T.l5.play.title,
      text: T.l5.play.text,
      target: () => [PLAY_BTN],
      check: (s) => s.playing,
    },
    {
      id: 'win',
      title: T.l5.win.title,
      text: T.l5.win.text,
      explain: T.l5.win.explain,
      check: (s) => s.ended === 'win',
    },
    { id: 'done', title: T.l5.done.title, text: T.l5.done.text },
  ],
};

export const LESSONS: readonly Lesson[] = [lesson1, lesson2, lesson3, lesson4, lesson5];

export function findLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
