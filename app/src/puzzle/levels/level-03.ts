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

/** Stars are blocks of type "pickup" so the cat walks through them. The player wires each star to a "Chạm nhau" and to its own "Ẩn đi". */
const starNodes: GraphNode[] = STARS.map(
  (s, k): GraphNode => ({
    id: s.id,
    kind: 'block',
    params: { name: `Sao ${k + 1}`, position: { x: s.x, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#facc15', type: 'pickup' },
    pos: { x: 10, y: 140 + k * 100 },
  }),
);

/** The cat walks the route star 1, star 2, star 3, then the flag. The walk is a tray piece with these points already set. */
const ROUTE_PARAMS: GraphNode['params'] = {
  count: 2,
  p1: { x: 11, y: 0.5, z: 0 },
  p2: { x: 12, y: 0.5, z: 0 },
  speed: 4,
  lookAhead: 0,
};

/**
 * Level 3 (nhat-sao): touch three stars, then open the gate (side view, the same wooden door as level 2). The board shows
 * the cat, the three stars and the gate. The player makes the cat walk the route (the walk already holds one point per
 * star and the flag), then builds the stars' part: one "Chạm nhau" per star (cat + that star); its "Mới chạm" hides the
 * star and also counts. A "Hoặc" has only two inputs, so two of them gather the three touch signals into the counter's
 * single "Cộng 1". The counter's goal starts at 5 and the player sets it to 3; its "Đã đủ" opens the gate ("Ẩn suốt lúc bật").
 * The flag and the win rule (cat touches the flag) are scenery.
 *
 * Why no "So sánh": a compare whose two inputs are fed by one "Số cố định" is always true, which opens the gate with
 * no counting at all (a cheaper win), so the counter's own "Đã đủ" does the comparing.
 * Hiding a star is the visible pick-up effect; the count comes from the touch, so the hide wire does not change the result.
 */
export const level03: PuzzleLevel | null = {
  id: 'nhat-sao',
  order: 3,
  title: 'Nhặt sao',
  task: 'Mèo đi qua 3 ngôi sao rồi tới cổng. Cổng chỉ mở khi mèo đã nhặt đủ 3 sao. Bạn tự nối mạch: cho mèo đi, mỗi sao mèo chạm vào thì biến mất và được đếm, đặt mục tiêu là 3.',
  hint: '"Chạy theo tuyến" cho mèo đi. Mỗi sao cần một "Chạm nhau" (mèo + sao đó): "Mới chạm" làm sao ẩn đi và báo "Hoặc" để "Bộ đếm" cộng 1 (hai "Hoặc" gom ba sao). Chỉnh "Mục tiêu" về 3, rồi nối "Đã đủ" vào "Ẩn suốt lúc bật" của cổng.',
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
        pos: { x: 10, y: 450 },
      },
      scenery('goal', 'block', { name: 'Cờ đích', position: { x: 11, y: 0.6, z: 0 }, size: { x: 0.8, y: 1.2, z: 0.8 }, color: '#22c55e', type: 'pickup' }),
      scenery('touch-goal', 'touch', {}),
      scenery('ground', 'block', groundParams(30)),
      scenery('end', 'win-lose', { winMessage: 'Mèo nhặt đủ 3 sao và qua cổng!', loseMessage: 'Thua mất rồi!' }),
    ],
    wires: [
      wire('b4', ['cat', 'self'], ['touch-goal', 'a']),
      wire('b5', ['goal', 'self'], ['touch-goal', 'b']),
      wire('b6', ['touch-goal', 'touching'], ['end', 'win']),
    ],
  },
  shownPorts: {
    cat: { in: ['moveX'], out: ['self'] },
    'star-1': { in: ['hide'], out: ['self'] },
    'star-2': { in: ['hide'], out: ['self'] },
    'star-3': { in: ['hide'], out: ['self'] },
    gate: { in: ['hiddenWhile'], out: [] },
    goal: { in: [], out: [] },
    'touch-goal': { in: [], out: [] },
    ground: { in: [], out: [] },
    end: { in: [], out: [] },
  },
  tray: [
    { kind: 'route-follow', count: 1, params: ROUTE_PARAMS },
    { kind: 'touch', count: 3 },
    { kind: 'or', count: 2 },
    { kind: 'counter', count: 1 },
    { kind: 'on-start', count: 1 },
    // Spare piece: "Và" looks useful for gathering signals but it needs both inputs on at once, so it never counts.
    { kind: 'and', count: 1 },
  ],
  editable: [{ kind: 'counter', paramId: 'target' }],
  par: 8,
  freeHints: 3,
  timeLimit: 30,
  solution: {
    nodes: [
      { id: 'p-start', kind: 'on-start', params: {}, pos: { x: 230, y: 20 } },
      { id: 'p-route', kind: 'route-follow', params: ROUTE_PARAMS, pos: { x: 620, y: 20 } },
      { id: 'p-touch1', kind: 'touch', params: {}, pos: { x: 230, y: 100 } },
      { id: 'p-touch2', kind: 'touch', params: {}, pos: { x: 230, y: 280 } },
      { id: 'p-touch3', kind: 'touch', params: {}, pos: { x: 230, y: 460 } },
      { id: 'p-or1', kind: 'or', params: {}, pos: { x: 430, y: 160 } },
      { id: 'p-or2', kind: 'or', params: {}, pos: { x: 430, y: 340 } },
      { id: 'p-count', kind: 'counter', params: { target: 3 }, pos: { x: 800, y: 340 } },
    ],
    wires: [
      wire('s1', ['cat', 'self'], ['p-route', 'self']),
      wire('s2', ['p-route', 'moveX'], ['cat', 'moveX']),
      wire('s3', ['p-start', 'started'], ['p-route', 'on']),
      ...STARS.flatMap((s, k) => [
        wire(`t${k + 1}a`, ['cat', 'self'], [`p-touch${k + 1}`, 'a']),
        wire(`t${k + 1}b`, [s.id, 'self'], [`p-touch${k + 1}`, 'b']),
        wire(`h${k + 1}`, [`p-touch${k + 1}`, 'began'], [s.id, 'hide']),
      ]),
      wire('c1', ['p-touch1', 'began'], ['p-or1', 'a']),
      wire('c2', ['p-touch2', 'began'], ['p-or1', 'b']),
      wire('c3', ['p-or1', 'out'], ['p-or2', 'a']),
      wire('c4', ['p-touch3', 'began'], ['p-or2', 'b']),
      wire('c5', ['p-or2', 'out'], ['p-count', 'up']),
      wire('s4', ['p-count', 'reached'], ['gate', 'hiddenWhile']),
    ],
  },
};
