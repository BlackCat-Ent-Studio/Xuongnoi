import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

/** Level 6 (ne-linh-gac): the chibi cat walks to the goal while a guard cat patrols across the path. */
export const level06: PuzzleLevel = {
  id: 'ne-linh-gac',
  order: 6,
  title: 'Né lính gác',
  task: 'Mèo nhỏ muốn chạy tới ô xanh, nhưng mèo lính gác đi tuần ngang đường. Chạm vào lính gác là thua! Hãy bắt mèo nhỏ ĐỨNG CHỜ khi lính gác ở gần, và chạy khi lính gác đã xa.',
  hint: 'Đặt "Đo khoảng cách" đo giữa mèo nhỏ và lính gác (nối hai "Nhân vật"). "Trong tầm" bật khi lính gác ở gần. Cho nó qua "Đảo ngược" rồi nối vào "Cho đi" của mèo nhỏ. Chỉnh số "Ngưỡng": nhỏ quá mèo chạy liều, lớn quá mèo đứng mãi.',
  mode: '3d',
  cast: [PUZZLE_LOOKS.catChibi, PUZZLE_LOOKS.catQuad],
  base: {
    nodes: [
      { id: 'floor', kind: 'block', params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 14 }, color: '#a7c4a0', type: 'solid' }, pos: { x: 20, y: 470 } },
      { id: 'goal', kind: 'block', params: { name: 'Ô xanh', position: { x: 10, y: 0.1, z: 0 }, size: { x: 1.6, y: 0.2, z: 1.6 }, color: '#22c55e', type: 'pickup' }, pos: { x: 20, y: 400 } },
      { id: 'hero', kind: 'character', params: { name: 'Mèo nhỏ', position: { x: -10, y: 1, z: 0 }, speed: 4, color: '#f9a8d4', look: PUZZLE_LOOKS.catChibi, role: 'bot' }, pos: { x: 20, y: 20 } },
      { id: 'guard', kind: 'character', params: { name: 'Mèo lính gác', position: { x: 0, y: 1, z: -5 }, speed: 2, color: '#64748b', look: PUZZLE_LOOKS.catQuad, role: 'bot' }, pos: { x: 20, y: 200 } },
      { id: 'walk', kind: 'go-to', params: { stopDistance: 0.5 }, pos: { x: 230, y: 20 } },
      { id: 'patrol', kind: 'patrol', params: { pointA: { x: 0, y: 0.5, z: -5 }, pointB: { x: 0, y: 0.5, z: 5 }, wait: 0.5 }, pos: { x: 230, y: 200 } },
      { id: 'caught', kind: 'touch', params: {}, pos: { x: 440, y: 200 } },
      { id: 'cam', kind: 'camera', params: { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, view: 'top', zoom: 0.9 }, pos: { x: 440, y: 400 } },
      { id: 'end', kind: 'win-lose', params: { winMessage: 'Mèo nhỏ tới đích an toàn!', loseMessage: 'Lính gác bắt được mèo nhỏ rồi!' }, pos: { x: 650, y: 20 } },
    ],
    wires: [
      { id: 'b1', from: { node: 'hero', port: 'self' }, to: { node: 'walk', port: 'self' } },
      { id: 'b2', from: { node: 'goal', port: 'self' }, to: { node: 'walk', port: 'target' } },
      { id: 'b3', from: { node: 'walk', port: 'moveX' }, to: { node: 'hero', port: 'moveX' } },
      { id: 'b4', from: { node: 'walk', port: 'moveY' }, to: { node: 'hero', port: 'moveY' } },
      { id: 'b5', from: { node: 'guard', port: 'self' }, to: { node: 'patrol', port: 'self' } },
      { id: 'b6', from: { node: 'patrol', port: 'moveX' }, to: { node: 'guard', port: 'moveX' } },
      { id: 'b7', from: { node: 'patrol', port: 'moveY' }, to: { node: 'guard', port: 'moveY' } },
      { id: 'b8', from: { node: 'hero', port: 'self' }, to: { node: 'caught', port: 'a' } },
      { id: 'b9', from: { node: 'guard', port: 'self' }, to: { node: 'caught', port: 'b' } },
      { id: 'b10', from: { node: 'walk', port: 'arrived' }, to: { node: 'end', port: 'win' } },
      { id: 'b11', from: { node: 'caught', port: 'touching' }, to: { node: 'end', port: 'lose' } },
    ],
  },
  shownPorts: {
    floor: { in: [], out: [] },
    hero: { in: [], out: ['self'] },
    guard: { in: [], out: ['self'] },
    walk: { in: ['go'], out: [] },
    patrol: { in: [], out: [] },
    caught: { in: [], out: [] },
    goal: { in: [], out: [] },
    cam: { in: [], out: [] },
    end: { in: [] },
  },
  tray: [
    { kind: 'distance', count: 1, params: { threshold: 1 } },
    { kind: 'not', count: 1 },
    { kind: 'compare', count: 1 },
  ],
  editable: [{ kind: 'distance', paramId: 'threshold' }],
  par: 2,
  freeHints: 3,
  timeLimit: 60,
  solution: {
    nodes: [
      { id: 's-dist', kind: 'distance', params: { threshold: 3 }, pos: { x: 230, y: 330 } },
      { id: 's-not', kind: 'not', params: {}, pos: { x: 440, y: 330 } },
    ],
    wires: [
      { id: 'sw1', from: { node: 'hero', port: 'self' }, to: { node: 's-dist', port: 'a' } },
      { id: 'sw2', from: { node: 'guard', port: 'self' }, to: { node: 's-dist', port: 'b' } },
      { id: 'sw3', from: { node: 's-dist', port: 'within' }, to: { node: 's-not', port: 'in' } },
      { id: 'sw4', from: { node: 's-not', port: 'out' }, to: { node: 'walk', port: 'go' } },
    ],
  },
};
