import { type Endpoint, hasNode, numParam, nodesOfKind } from './graph-checks';
import type { LessonKit } from './lessons-vehicles';
import { HEALTH_COLOR_TEXT as T } from './text-vi-course-c';
import { type NodeSpec, type WireSpec, isPlayer, paletteSel, setParamStep, textChanged } from './course-c-shared';
import type { Lesson } from './types';

/**
 * "Thanh máu đổi màu": a turret shoots the player; Máu -> Đổi thang số -> Thanh đo draws the health bar and
 * Chọn theo số turns the health level into a warning. Self-contained: shared builders arrive through `LessonKit`.
 */

export const HEALTH_COLOR_LESSON_ID = 'health-color';
const MAX_HP = 3;
const DEFAULT_WARNING = 'Xin chào!';

const NODES: NodeSpec[] = [
  { alias: 'stick', kind: 'stick', x: 20, y: 20 },
  { alias: 'hero', kind: 'character', x: 300, y: 20, params: { position: { x: -6, y: 1, z: 0 } } },
  { alias: 'floor', kind: 'block', x: 300, y: 380, params: { size: { x: 24, y: 1, z: 1 }, color: '#65a30d' } },
  {
    alias: 'turret',
    kind: 'character',
    x: 560,
    y: 20,
    params: { position: { x: 6, y: 1, z: 0 }, color: '#f97316', look: 'robot', role: 'bot' },
  },
  { alias: 'timer', kind: 'timer', x: 820, y: 20, params: { seconds: 2 } },
  { alias: 'loop', kind: 'or', x: 820, y: 200 },
  { alias: 'gun', kind: 'shooter', x: 1080, y: 20, params: { speed: 14, lifetime: 1.5, damage: 1 } },
  { alias: 'end', kind: 'win-lose', x: 1080, y: 320, params: { loseMessage: 'Bạn hết máu rồi!' } },
];
const WIRES: WireSpec[] = [
  ['stick', 'x', 'hero', 'moveX'],
  ['turret', 'self', 'gun', 'shooter'],
  ['hero', 'self', 'gun', 'target'],
  ['timer', 'done', 'gun', 'fire'],
  ['timer', 'done', 'loop', 'a'],
  ['loop', 'out', 'timer', 'reset'],
];

const HERO_SELF: Endpoint = { kind: 'character', port: 'self', where: isPlayer };
const HEALTH_SELF: Endpoint = { kind: 'health', port: 'self' };
const HEALTH_HP: Endpoint = { kind: 'health', port: 'hp' };
const HEALTH_DEAD: Endpoint = { kind: 'health', port: 'dead' };
const MAP_IN: Endpoint = { kind: 'map-range', port: 'value' };
const MAP_OUT: Endpoint = { kind: 'map-range', port: 'value' };
const METER_VALUE: Endpoint = { kind: 'ui-meter', port: 'value' };
const SELECT_IN: Endpoint = { kind: 'select-number', port: 'value' };
const SELECT_IS1: Endpoint = { kind: 'select-number', port: 'is1' };
const TEXT_SHOW: Endpoint = { kind: 'show-text', port: 'show' };
const LOSE: Endpoint = { kind: 'win-lose', port: 'lose' };

export function createHealthColorLesson(kit: LessonKit): Lesson {
  return {
    id: HEALTH_COLOR_LESSON_ID,
    title: T.title,
    summary: T.summary,
    createBoard: () => kit.buildBoard(T.boardName, NODES, WIRES),
    steps: [
      { id: 'intro', title: T.intro.title, text: T.intro.text, explain: T.intro.explain },
      { ...kit.addStep('add-health', 'health'), title: T.addHealth.title, text: T.addHealth.text, explain: T.addHealth.explain },
      {
        ...setParamStep('max-hp', 'health', 'maxHp', (s) => nodesOfKind(s.graph, 'health').some((n) => numParam(n, 'maxHp') === MAX_HP)),
        title: T.maxHp.title,
        text: T.maxHp.text,
        explain: T.maxHp.explain,
      },
      { ...kit.wireStep('wire-self', HERO_SELF, HEALTH_SELF), title: T.wireSelf.title, text: T.wireSelf.text },
      { ...kit.addStep('add-meter', 'ui-meter'), title: T.addMeter.title, text: T.addMeter.text, explain: T.addMeter.explain },
      { ...kit.addStep('add-map', 'map-range'), title: T.addMap.title, text: T.addMap.text, explain: T.addMap.explain },
      {
        ...setParamStep('map-scale', 'map-range', 'inMax', (s) => nodesOfKind(s.graph, 'map-range').some((n) => numParam(n, 'inMax') === MAX_HP)),
        title: T.mapScale.title,
        text: T.mapScale.text,
        explain: T.mapScale.explain,
      },
      { ...kit.wireStep('wire-hp-map', HEALTH_HP, MAP_IN), title: T.wireHpMap.title, text: T.wireHpMap.text },
      { ...kit.wireStep('wire-map-meter', MAP_OUT, METER_VALUE), title: T.wireMapMeter.title, text: T.wireMapMeter.text },
      { ...kit.addStep('add-select', 'select-number'), title: T.addSelect.title, text: T.addSelect.text, explain: T.addSelect.explain },
      {
        ...kit.wireStep('wire-hp-select', HEALTH_HP, SELECT_IN),
        title: T.wireHpSelect.title,
        text: T.wireHpSelect.text,
        explain: T.wireHpSelect.explain,
      },
      {
        id: 'add-text',
        title: T.addText.title,
        text: T.addText.text,
        target: () => [paletteSel('show-text')],
        check: (s) => hasNode(s.graph, 'show-text'),
      },
      {
        ...setParamStep('text-words', 'show-text', 'text', (s) => textChanged(s, 'show-text', 'text', DEFAULT_WARNING)),
        title: T.textWords.title,
        text: T.textWords.text,
      },
      { ...kit.wireStep('wire-warn', SELECT_IS1, TEXT_SHOW), title: T.wireWarn.title, text: T.wireWarn.text, explain: T.wireWarn.explain },
      { ...kit.wireStep('wire-dead', HEALTH_DEAD, LOSE), title: T.wireDead.title, text: T.wireDead.text },
      {
        id: 'play',
        title: T.play.title,
        text: T.play.text,
        explain: T.play.explain,
        target: () => [kit.playButton],
        check: (s) => s.playing,
      },
      { id: 'lost', title: T.lost.title, text: T.lost.text, check: (s) => s.ended === 'lose' },
      { id: 'done', title: T.done.title, text: T.done.text },
    ],
  };
}
