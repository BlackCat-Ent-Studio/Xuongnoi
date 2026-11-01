import type { Params } from '../../../src/engine/types';
import type { PuzzleLevel } from '../../../src/puzzle/types';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const node = (id: string, kind: string, params: Params, x: number, y: number) => ({ id, kind, params, pos: { x, y } });

/**
 * Development-only sample level ("Cửa kho"): the bot walks right on its own, a solid door blocks the way and
 * stepping on the button must open it for good. Loaded by the puzzle page only with `?fixture` in dev builds.
 */
export const doorFixture: PuzzleLevel = {
  id: 'fixture-cua-kho',
  order: 99,
  title: 'Cửa kho (mẫu)',
  task: 'Bot đang tự đi tới cờ nhưng cửa kho đóng. Hãy nối sao cho bot dẫm nút đỏ thì cửa mở và mở mãi.',
  hint: 'Cảm biến chỉ bật lúc đang dẫm nút. Cần thứ gì đó nhớ lại.',
  mode: '2d-side',
  cast: [],
  base: {
    nodes: [
      node('floor', 'block', { position: v(0, -0.5, 0), size: v(60, 1, 1), color: '#7fcfb3' }, 0, 0),
      node('bot', 'character', { position: v(-8, 1, 0), speed: 4, name: 'Bot' }, 20, 30),
      node('go', 'const', { value: 1 }, 0, 0),
      node('btn', 'block', { position: v(-3, 0.15, 0), size: v(1.6, 0.3, 1), color: '#ff4f7b', type: 'pickup', name: 'Nút đỏ' }, 20, 250),
      node('door', 'block', { position: v(2, 1.5, 0), size: v(1, 3, 1), color: '#a8662f', type: 'solid', name: 'Cửa kho' }, 760, 300),
      node('flag', 'block', { position: v(8, 1, 0), size: v(0.6, 2, 1), color: '#ffc93c', type: 'pickup' }, 0, 0),
      node('atFlag', 'touch', {}, 0, 0),
      node('end', 'win-lose', {}, 0, 0),
    ],
    wires: [
      { id: 'b1', from: { node: 'go', port: 'value' }, to: { node: 'bot', port: 'moveX' } },
      { id: 'b2', from: { node: 'bot', port: 'self' }, to: { node: 'atFlag', port: 'a' } },
      { id: 'b3', from: { node: 'flag', port: 'self' }, to: { node: 'atFlag', port: 'b' } },
      { id: 'b4', from: { node: 'atFlag', port: 'touching' }, to: { node: 'end', port: 'win' } },
    ],
  },
  shownPorts: {
    floor: {},
    go: {},
    flag: {},
    atFlag: {},
    end: {},
    bot: { out: ['self'] },
    btn: { out: ['self'] },
    door: { in: ['hide'] },
  },
  tray: [
    { kind: 'touch', count: 1 },
    { kind: 'latch', count: 1 },
  ],
  editable: [
    { nodeId: 'bot', paramId: 'speed' },
    { kind: 'touch', paramId: 'mode' },
  ],
  par: 2,
  timeLimit: 20,
  solution: {
    nodes: [
      node('p1', 'touch', {}, 300, 40),
      node('p2', 'latch', {}, 560, 40),
    ],
    wires: [
      { id: 'pw1', from: { node: 'bot', port: 'self' }, to: { node: 'p1', port: 'a' } },
      { id: 'pw2', from: { node: 'btn', port: 'self' }, to: { node: 'p1', port: 'b' } },
      { id: 'pw3', from: { node: 'p1', port: 'touching' }, to: { node: 'p2', port: 'set' } },
      { id: 'pw4', from: { node: 'p2', port: 'on' }, to: { node: 'door', port: 'hide' } },
    ],
  },
};
