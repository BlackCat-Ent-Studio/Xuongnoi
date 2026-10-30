import type { GraphNode } from '../engine/types';
import { paramOf } from './graph-checks';
import { type Resolve, first, link, newest, paramSel, paramStep, wiresStep } from './lesson-b-helpers';
import type { LessonKit } from './lessons-vehicles';
import { CARGO_TEXT as T } from './text-vi-course-b';
import type { Lesson, Snapshot, TargetList } from './types';

/**
 * "Chở hàng": a truck loads crates of one goods type with a key, unloads them inside a zone, and a counter
 * of deliveries decides the win. Hero, truck and the climb-in key are already wired, as in the vehicle lesson.
 */

type BuildArgs = Parameters<LessonKit['buildBoard']>;

const CRATE_COLOR = '#b45309';
const goods = (alias: string, x: number, tag: string, shape: string, color: string, cx: number): BuildArgs[1][number] => ({
  alias,
  kind: 'item',
  x: cx,
  y: 300,
  params: {
    position: { x, y: 0.85, z: 0 },
    size: { x: 0.7, y: 0.7, z: 0.7 },
    color,
    shape,
    carryable: 'yes',
    holdStyle: 'head',
    tag,
  },
});

const NODES: BuildArgs[1] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'key-e', kind: 'key', x: 20, y: 190, params: { key: 'KeyE' } },
  { alias: 'enter', kind: 'enter-exit', x: 20, y: 360, params: { reach: 4 } },
  { alias: 'hero', kind: 'character', x: 270, y: 20, params: { position: { x: -18.5, y: 1, z: 0 } } },
  {
    alias: 'truck',
    kind: 'vehicle',
    x: 520,
    y: 20,
    params: { position: { x: -16, y: 1.1, z: 0 }, model: 'truck', color: '#f97316' },
  },
  {
    alias: 'floor',
    kind: 'block',
    x: 770,
    y: 20,
    params: { size: { x: 40, y: 1, z: 1 }, color: '#65a30d' },
  },
  {
    alias: 'pad',
    kind: 'block',
    x: 1020,
    y: 20,
    params: { type: 'pickup', position: { x: 0, y: 0.55, z: 0 }, size: { x: 4, y: 0.12, z: 1 }, color: '#fde047' },
  },
  goods('crate-1', -11, 'thùng', 'crate', CRATE_COLOR, 270),
  goods('crate-2', -10.2, 'thùng', 'crate', CRATE_COLOR, 520),
  goods('rock', -12, 'đá', 'ore', '#64748b', 770),
];
const WIRES: BuildArgs[2] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['stick', 'x', 'truck', 'moveX'],
  ['key-e', 'pressed', 'enter', 'press'],
  ['hero', 'self', 'enter', 'character'],
];

const isKey = (code: string) => (n: GraphNode) => paramOf(n, 'key') === code;
const truck: Resolve = (g) => first(g, 'vehicle');
const cargo: Resolve = (g) => first(g, 'cargo');
const keyL: Resolve = (g) => first(g, 'key', isKey('KeyL'));
const zone: Resolve = (g) => first(g, 'zone');
const and: Resolve = (g) => first(g, 'and');
const counter: Resolve = (g) => first(g, 'counter');
const showNumber: Resolve = (g) => first(g, 'show-number');
const end: Resolve = (g) => first(g, 'win-lose');

const goodsType = (n: GraphNode, id: string): boolean => String(paramOf(n, id) ?? '').trim() === 'thùng';

/** The Phím bấm added last, so the hint never points at the E key that was already there. */
function newestKeyTarget(snap: Snapshot): TargetList {
  const node = newest(snap.graph, 'key');
  return [node ? [paramSel('key'), `.wc-node[data-id="${node.id}"]`] : paramSel('key')];
}

export function createCargoDeliveryLesson(kit: LessonKit): Lesson {
  return {
    id: 'cargo-delivery',
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-cargo', 'cargo'), title: T.cargo.title, text: T.cargo.text, explain: T.cargo.explain },
      { ...wiresStep('wire-cargo-vehicle', [link(truck, 'self', cargo, 'vehicle')]), title: T.vehicle.title, text: T.vehicle.text },
      {
        ...paramStep('load-type', cargo, 'loadType', (n) => goodsType(n, 'loadType')),
        title: T.loadType.title,
        text: T.loadType.text,
        explain: T.loadType.explain,
      },
      {
        ...paramStep('unload-type', cargo, 'unloadType', (n) => goodsType(n, 'unloadType')),
        title: T.unloadType.title,
        text: T.unloadType.text,
        explain: T.unloadType.explain,
      },
      { ...kit.addStep('add-key', 'key', 2), title: T.key.title, text: T.key.text },
      {
        id: 'key-l',
        title: T.keyL.title,
        text: T.keyL.text,
        target: newestKeyTarget,
        check: (s) => keyL(s.graph) !== undefined,
      },
      { ...wiresStep('wire-load', [link(keyL, 'pressed', cargo, 'load')]), title: T.load.title, text: T.load.text, explain: T.load.explain },
      { ...kit.addStep('add-zone', 'zone'), title: T.zone.title, text: T.zone.text, explain: T.zone.explain },
      {
        ...paramStep('zone-filter', zone, 'filter', (n) => paramOf(n, 'filter') === 'vehicle'),
        title: T.filter.title,
        text: T.filter.text,
      },
      { ...kit.addStep('add-and', 'and'), title: T.and.title, text: T.and.text, explain: T.and.explain },
      { ...wiresStep('wire-in-zone', [link(zone, 'inside', and, 'a')]), title: T.inZone.title, text: T.inZone.text },
      { ...wiresStep('wire-press-l', [link(keyL, 'pressed', and, 'b')]), title: T.pressL.title, text: T.pressL.text },
      {
        ...wiresStep('wire-unload', [link(and, 'out', cargo, 'unload')]),
        title: T.unload.title,
        text: T.unload.text,
        explain: T.unload.explain,
      },
      { ...kit.addStep('add-counter', 'counter'), title: T.counter.title, text: T.counter.text },
      {
        ...paramStep('counter-target', counter, 'target', (n) => paramOf(n, 'target') === 2),
        title: T.target.title,
        text: T.target.text,
      },
      { ...wiresStep('wire-count', [link(cargo, 'unloaded', counter, 'up')]), title: T.count.title, text: T.count.text },
      { ...kit.addStep('add-show', 'show-number'), title: T.show.title, text: T.show.text },
      {
        ...wiresStep('wire-show', [link(cargo, 'typeCount', showNumber, 'value')]),
        title: T.showCount.title,
        text: T.showCount.text,
        explain: T.showCount.explain,
      },
      { ...kit.addStep('add-end', 'win-lose'), title: T.end.title, text: T.end.text },
      { ...wiresStep('wire-win', [link(counter, 'reached', end, 'win')]), title: T.win.title, text: T.win.text },
      {
        id: 'play-deliver',
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
