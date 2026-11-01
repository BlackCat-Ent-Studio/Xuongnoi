import type { GraphNode, Wire } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

const STARS = [
  { id: 'star-1', x: -4, z: -3 },
  { id: 'star-2', x: 0, z: 3 },
  { id: 'star-3', x: 4, z: -3 },
] as const;

/** Each locked star has its own locked touch sensor: when the cat touches it, the star hides. */
const starNodes: GraphNode[] = STARS.flatMap((s, k): GraphNode[] => [
  {
    id: s.id,
    kind: 'block',
    params: { name: `Ngôi sao ${k + 1}`, position: { x: s.x, y: 0.5, z: s.z }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#facc15', type: 'pickup' },
    pos: { x: 30, y: 20 + k * 100 },
  },
  { id: `touch-${s.id}`, kind: 'touch', params: {}, pos: { x: 230, y: 20 + k * 130 } },
]);

const starWires: Wire[] = STARS.flatMap((s, k): Wire[] => [
  { id: `bs${k}a`, from: { node: 'cat', port: 'self' }, to: { node: `touch-${s.id}`, port: 'a' } },
  { id: `bs${k}b`, from: { node: s.id, port: 'self' }, to: { node: `touch-${s.id}`, port: 'b' } },
  { id: `bs${k}c`, from: { node: `touch-${s.id}`, port: 'began' }, to: { node: s.id, port: 'hide' } },
]);

/**
 * Level 3 (nhat-sao): count three star pickups, then open the gate. Stars are blocks of type "pickup" so the cat
 * walks through them. The gate's "Ẩn khi bật" follows the compare signal (it closes again when the signal drops)
 * and the compare is "bằng", so only the exact number 3 keeps it open for good; the tray constant starts at 5.
 */
export const level03: PuzzleLevel | null = {
  id: 'nhat-sao',
  order: 3,
  title: 'Nhặt sao',
  task: 'Mèo tự đi qua 3 ngôi sao rồi tới cổng. Cổng chỉ mở khi mèo đã nhặt đủ 3 sao. Hãy đếm sao và đặt số là 3.',
  hint: 'Gom 3 tín hiệu "Vừa chạm" bằng hai mảnh "Hoặc" rồi đưa vào Bộ đếm. So sánh số đếm với Hằng số 3, rồi nối vào "Ẩn khi bật" của cổng.',
  mode: '2d-top',
  cast: [PUZZLE_LOOKS.catChibi],
  base: {
    nodes: [
      {
        id: 'cat',
        kind: 'character',
        params: { name: 'Mèo nhỏ', position: { x: -8, y: 0.5, z: 0 }, speed: 4, color: '#f59e0b', look: PUZZLE_LOOKS.catChibi, role: 'bot' },
        pos: { x: 30, y: 400 },
      },
      {
        id: 'route',
        kind: 'route-follow',
        params: {
          count: 4,
          p1: { x: -4, y: 0.5, z: -3 },
          p2: { x: 0, y: 0.5, z: 3 },
          p3: { x: 4, y: 0.5, z: -3 },
          p4: { x: 11, y: 0.5, z: 0 },
          speed: 4,
          lookAhead: 0,
        },
        pos: { x: 230, y: 400 },
      },
      ...starNodes,
      {
        id: 'gate',
        kind: 'block',
        params: { name: 'Cổng', position: { x: 8, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 14 }, color: '#92400e', type: 'solid' },
        pos: { x: 800, y: 30 },
      },
      {
        id: 'goal',
        kind: 'block',
        params: { name: 'Cờ đích', position: { x: 11, y: 0.5, z: 0 }, size: { x: 0.8, y: 0.8, z: 0.8 }, color: '#22c55e', type: 'pickup' },
        pos: { x: 430, y: 400 },
      },
      { id: 'touch-goal', kind: 'touch', params: {}, pos: { x: 620, y: 400 } },
      {
        id: 'end',
        kind: 'win-lose',
        params: { winMessage: 'Mèo nhặt đủ 3 sao và qua cổng!', loseMessage: 'Thua mất rồi!' },
        pos: { x: 800, y: 440 },
      },
    ],
    wires: [
      { id: 'b1', from: { node: 'cat', port: 'self' }, to: { node: 'route', port: 'self' } },
      { id: 'b2', from: { node: 'route', port: 'moveX' }, to: { node: 'cat', port: 'moveX' } },
      { id: 'b3', from: { node: 'route', port: 'moveY' }, to: { node: 'cat', port: 'moveY' } },
      ...starWires,
      { id: 'b4', from: { node: 'cat', port: 'self' }, to: { node: 'touch-goal', port: 'a' } },
      { id: 'b5', from: { node: 'goal', port: 'self' }, to: { node: 'touch-goal', port: 'b' } },
      { id: 'b6', from: { node: 'touch-goal', port: 'touching' }, to: { node: 'end', port: 'win' } },
    ],
  },
  shownPorts: {
    cat: { in: [], out: [] },
    route: { in: [], out: [] },
    'star-1': { in: [], out: [] },
    'star-2': { in: [], out: [] },
    'star-3': { in: [], out: [] },
    'touch-star-1': { in: [], out: ['began'] },
    'touch-star-2': { in: [], out: ['began'] },
    'touch-star-3': { in: [], out: ['began'] },
    gate: { in: ['hiddenWhile'], out: [] },
    goal: { in: [], out: [] },
    'touch-goal': { in: [], out: [] },
    end: { in: [], out: [] },
  },
  tray: [
    { kind: 'or', count: 3 },
    { kind: 'counter', count: 1 },
    { kind: 'compare', count: 1, params: { op: 'eq' } },
    { kind: 'const', count: 1, params: { value: 5 } },
  ],
  editable: [{ kind: 'const', paramId: 'value' }],
  par: 5,
  freeHints: 2,
  timeLimit: 30,
  solution: {
    nodes: [
      { id: 'p-or1', kind: 'or', params: {}, pos: { x: 230, y: 150 } },
      { id: 'p-or2', kind: 'or', params: {}, pos: { x: 400, y: 150 } },
      { id: 'p-count', kind: 'counter', params: {}, pos: { x: 570, y: 150 } },
      { id: 'p-cmp', kind: 'compare', params: { op: 'eq' }, pos: { x: 570, y: 280 } },
      { id: 'p-const', kind: 'const', params: { value: 3 }, pos: { x: 400, y: 300 } },
    ],
    wires: [
      { id: 's1', from: { node: 'touch-star-1', port: 'began' }, to: { node: 'p-or1', port: 'a' } },
      { id: 's2', from: { node: 'touch-star-2', port: 'began' }, to: { node: 'p-or1', port: 'b' } },
      { id: 's3', from: { node: 'p-or1', port: 'out' }, to: { node: 'p-or2', port: 'a' } },
      { id: 's4', from: { node: 'touch-star-3', port: 'began' }, to: { node: 'p-or2', port: 'b' } },
      { id: 's5', from: { node: 'p-or2', port: 'out' }, to: { node: 'p-count', port: 'up' } },
      { id: 's6', from: { node: 'p-count', port: 'value' }, to: { node: 'p-cmp', port: 'a' } },
      { id: 's7', from: { node: 'p-const', port: 'value' }, to: { node: 'p-cmp', port: 'b' } },
      { id: 's8', from: { node: 'p-cmp', port: 'out' }, to: { node: 'gate', port: 'hiddenWhile' } },
    ],
  },
};
