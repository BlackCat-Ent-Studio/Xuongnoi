import type { GraphNode } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { groundParams, sceneryMaker, wire } from './player-built-kit';

const scenery = sceneryMaker();

const STARS = [
  { id: 'star-1', x: -4 },
  { id: 'star-2', x: 0 },
  { id: 'star-3', x: 4 },
] as const;

/** Stars are blocks of type "pickup" so the cat walks through them. Each star hides itself when the cat touches it (scenery: the pick-up effect). */
const starNodes: GraphNode[] = STARS.flatMap((s, k): GraphNode[] => [
  {
    id: s.id,
    kind: 'block',
    params: { name: `Sao ${k + 1}`, position: { x: s.x, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#facc15', type: 'pickup' },
    pos: { x: 10, y: 140 + k * 80 },
  },
  scenery(`touch-${s.id}`, 'touch', {}),
]);

/** The cat walks the route star 1, star 2, star 3, then the flag. The walk is a tray piece with these points already set. */
const ROUTE_PARAMS: GraphNode['params'] = {
  count: 4,
  p1: { x: -4, y: 0.5, z: 0 },
  p2: { x: 0, y: 0.5, z: 0 },
  p3: { x: 4, y: 0.5, z: 0 },
  p4: { x: 11, y: 0.5, z: 0 },
  speed: 4,
  lookAhead: 0,
};

/**
 * Level 3 (nhat-sao): count three stars, then open the gate (side view, the same wooden door as level 2). The board shows
 * the cat, the three stars and the gate. The player makes the cat walk the route (one point per star, then the flag),
 * counts every point it reaches and joins the counter's "Đã đủ" to the gate. The counter's goal starts at 5 and the
 * player sets it to 3; the gate's "Ẩn suốt lúc bật" follows "Đã đủ", which stays on once the goal is reached.
 * The stars hiding when touched, the flag and the win rule (cat touches the flag) are scenery.
 *
 * Why no "So sánh": a compare whose two inputs are fed by one "Số cố định" is always true, which opens the gate with
 * no counting at all (a cheaper win), so the counter's own "Đã đủ" does the comparing.
 */
export const level03: PuzzleLevel | null = {
  id: 'nhat-sao',
  order: 3,
  title: 'Nhặt sao',
  task: 'Mèo đi qua 3 ngôi sao rồi tới cổng. Cổng chỉ mở khi mèo đã nhặt đủ 3 sao. Bạn tự nối mạch: cho mèo đi, đếm số sao, đặt mục tiêu là 3.',
  hint: '"Chạy theo tuyến" cho mèo đi qua từng sao. Mỗi lần "Tới điểm" thì "Bộ đếm" cộng 1. Chỉnh "Mục tiêu" về 3, rồi nối "Đã đủ" vào "Ẩn suốt lúc bật" của cổng.',
  mode: '2d-side',
  cast: [PUZZLE_LOOKS.catChibi],
  base: {
    nodes: [
      {
        id: 'cat',
        kind: 'character',
        params: { name: 'Mèo', position: { x: -8, y: 1, z: 0 }, speed: 4, color: '#f59e0b', look: PUZZLE_LOOKS.catChibi, role: 'bot' },
        pos: { x: 10, y: 20 },
      },
      ...starNodes,
      {
        id: 'gate',
        kind: 'block',
        params: { name: 'Cổng', position: { x: 8, y: 4, z: 0 }, size: { x: 0.8, y: 8, z: 1 }, color: '#92400e', type: 'solid' },
        pos: { x: 10, y: 400 },
      },
      scenery('goal', 'block', { name: 'Cờ đích', position: { x: 11, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' }),
      scenery('touch-goal', 'touch', {}),
      scenery('ground', 'block', groundParams(30)),
      scenery('end', 'win-lose', { winMessage: 'Mèo nhặt đủ 3 sao và qua cổng!', loseMessage: 'Thua mất rồi!' }),
    ],
    wires: [
      ...STARS.flatMap((s, k) => [
        wire(`bs${k}a`, ['cat', 'self'], [`touch-${s.id}`, 'a']),
        wire(`bs${k}b`, [s.id, 'self'], [`touch-${s.id}`, 'b']),
        wire(`bs${k}c`, [`touch-${s.id}`, 'began'], [s.id, 'hide']),
      ]),
      wire('b4', ['cat', 'self'], ['touch-goal', 'a']),
      wire('b5', ['goal', 'self'], ['touch-goal', 'b']),
      wire('b6', ['touch-goal', 'touching'], ['end', 'win']),
    ],
  },
  shownPorts: {
    cat: { in: ['moveX'], out: ['self'] },
    'star-1': { in: [], out: ['self'] },
    'star-2': { in: [], out: ['self'] },
    'star-3': { in: [], out: ['self'] },
    'touch-star-1': { in: [], out: [] },
    'touch-star-2': { in: [], out: [] },
    'touch-star-3': { in: [], out: [] },
    gate: { in: ['hiddenWhile'], out: [] },
    goal: { in: [], out: [] },
    'touch-goal': { in: [], out: [] },
    ground: { in: [], out: [] },
    end: { in: [], out: [] },
  },
  tray: [
    { kind: 'route-follow', count: 1, params: ROUTE_PARAMS },
    { kind: 'counter', count: 1 },
    // Spare piece: "Và" looks useful for gathering signals but nothing here needs it.
    { kind: 'and', count: 1 },
  ],
  editable: [{ kind: 'counter', paramId: 'target' }],
  par: 2,
  freeHints: 2,
  timeLimit: 30,
  solution: {
    nodes: [
      { id: 'p-route', kind: 'route-follow', params: ROUTE_PARAMS, pos: { x: 400, y: 20 } },
      { id: 'p-count', kind: 'counter', params: { target: 3 }, pos: { x: 400, y: 200 } },
    ],
    wires: [
      wire('s1', ['cat', 'self'], ['p-route', 'self']),
      wire('s2', ['p-route', 'moveX'], ['cat', 'moveX']),
      wire('s3', ['p-route', 'reached'], ['p-count', 'up']),
      wire('s4', ['p-count', 'reached'], ['gate', 'hiddenWhile']),
    ],
  },
};
