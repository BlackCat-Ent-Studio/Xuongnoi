import type { GraphNode } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';
import { groundParams, sceneryMaker, wire } from './player-built-kit';

const scenery = sceneryMaker();

const STARS = [
  { id: 'star-1', x: -3 },
  { id: 'star-2', x: 3 },
] as const;

/** Stars are blocks of type "pickup" so the cat walks through them, with the advanced "Báo đang ẩn" output on. The player wires each star to a "Chạm nhau", to its own "Ẩn đi", and its "Đang ẩn" to the gate through "Và". */
const starNodes: GraphNode[] = STARS.map(
  (s, k): GraphNode => ({
    id: s.id,
    kind: 'block',
    params: { name: `Sao ${k + 1}`, position: { x: s.x, y: 0.5, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#facc15', type: 'pickup', showHiddenOut: 'yes' },
    pos: { x: 10, y: 150 + k * 130 },
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
 * Level 3 (nhat-sao): hide two stars, then open the gate (side view, the same wooden door as level 2). The board shows the
 * cat, the two stars and the gate. The player makes the cat walk the route (its points lie beyond the gate, so the walk
 * carries no star position), then builds the stars' part: one "Chạm nhau" per star (cat + that star) whose "Mới chạm"
 * hides the star. Each star shows its "Đang ẩn" output (the general optional output of the block); both go into a "Và"
 * whose result is the gate's "Ẩn suốt lúc bật". The flag and the win rule (cat touches the flag) are scenery.
 */
export const level03: PuzzleLevel | null = {
  id: 'nhat-sao',
  order: 3,
  title: 'Nhặt sao',
  task: 'Mèo đi qua 2 ngôi sao rồi tới cổng. Cổng chỉ mở khi cả 2 sao đã biến mất. Bạn tự nối mạch: cho mèo đi, mỗi sao mèo chạm vào thì ẩn đi, rồi báo cho cổng khi cả hai sao đã ẩn.',
  hint: '"Chạy theo tuyến" cho mèo đi. Mỗi sao cần một "Chạm nhau" (mèo + sao đó): "Mới chạm" nối vào "Ẩn đi" của chính sao đó. Rồi "Đang ẩn" của cả hai sao vào "Và", và "Kết quả" của "Và" vào "Ẩn suốt lúc bật" của cổng.',
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
      scenery('end', 'win-lose', { winMessage: 'Mèo nhặt đủ 2 sao và qua cổng!', loseMessage: 'Thua mất rồi!' }),
    ],
    wires: [
      wire('b4', ['cat', 'self'], ['touch-goal', 'a']),
      wire('b5', ['goal', 'self'], ['touch-goal', 'b']),
      wire('b6', ['touch-goal', 'touching'], ['end', 'win']),
    ],
  },
  shownPorts: {
    cat: { in: ['moveX'], out: ['self'] },
    'star-1': { in: ['hide'], out: ['self', 'hidden'] },
    'star-2': { in: ['hide'], out: ['self', 'hidden'] },
    gate: { in: ['hiddenWhile'], out: [] },
    goal: { in: [], out: [] },
    'touch-goal': { in: [], out: [] },
    ground: { in: [], out: [] },
    end: { in: [], out: [] },
  },
  tray: [
    { kind: 'route-follow', count: 1, params: ROUTE_PARAMS },
    { kind: 'touch', count: 2 },
    { kind: 'on-start', count: 1 },
    // The second "Và" is the spare: one is needed, a second one has nothing to join.
    { kind: 'and', count: 2 },
  ],
  par: 5,
  freeHints: 3,
  timeLimit: 30,
  solution: {
    nodes: [
      { id: 'p-start', kind: 'on-start', params: {}, pos: { x: 230, y: 20 } },
      { id: 'p-route', kind: 'route-follow', params: ROUTE_PARAMS, pos: { x: 620, y: 20 } },
      { id: 'p-touch1', kind: 'touch', params: {}, pos: { x: 230, y: 100 } },
      { id: 'p-touch2', kind: 'touch', params: {}, pos: { x: 230, y: 300 } },
      { id: 'p-and', kind: 'and', params: {}, pos: { x: 430, y: 460 } },
    ],
    wires: [
      wire('s1', ['cat', 'self'], ['p-route', 'self']),
      wire('s2', ['p-route', 'moveX'], ['cat', 'moveX']),
      wire('s3', ['p-start', 'started'], ['p-route', 'on']),
      ...STARS.flatMap((s, k) => [
        wire(`t${k + 1}a`, ['cat', 'self'], [`p-touch${k + 1}`, 'a']),
        wire(`t${k + 1}b`, [s.id, 'self'], [`p-touch${k + 1}`, 'b']),
        wire(`h${k + 1}`, [`p-touch${k + 1}`, 'began'], [s.id, 'hide']),
        wire(`g${k + 1}`, [s.id, 'hidden'], ['p-and', k === 0 ? 'a' : 'b']),
      ]),
      wire('s4', ['p-and', 'out'], ['gate', 'hiddenWhile']),
    ],
  },
};
