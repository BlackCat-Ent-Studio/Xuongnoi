import type { GraphNode, Vec3, Wire } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import { PUZZLE_LOOKS } from '../types';

/** Where the guard walks to and fro (x fixed, z between the two ends) and how fast. */
export const GUARD_LANE = { x: 0.5, z1: -4.1, z2: -0.9, wait: 0.4, speed: 1.3 } as const;
/** The patrol turns this far before its end points (it counts as arrived when that close), so the points sit this much outside the walked lane. */
const TURN_SLACK = 0.2;
/** What the guard's eyes can do. */
export const GUARD_EYES = { range: 10, angle: 90 } as const;
/** The cat's run speed along its route. */
export const CAT_SPEED = 3.2;
/** How close to a cover spot the cat counts as having arrived. */
export const CAT_ARRIVE = 0.25;
/** Seconds the cat crouches to spring after deciding to run; time the run takes on top of the plain distance over speed. */
export const CAT_READY = 0.2;
/** The cat eases into every cover spot from this far away (it never rushes into a hiding place), which costs a little time too. */
export const CAT_EASE = 1;
export const CRATE_SIZE: Vec3 = { x: 1.7, y: 2.2, z: 1.7 };

export interface StealthLayout {
  /** Cover crates (centres on the floor). */
  crates: readonly { x: number; z: number }[];
  /** The place behind each crate where the cat waits; the route is start, these, goal. */
  spots: readonly { x: number; z: number }[];
  start: { x: number; z: number };
  goal: { x: number; z: number };
  /** Where on its lane the guard begins. */
  guardZ: number;
}

/** The shipped layout. */
export const LAYOUT: StealthLayout = {
  crates: [
    { x: -3.9, z: 1.1 },
    { x: -0.1, z: 1.4 },
    { x: 6.2, z: 1.2 },
  ],
  spots: [
    { x: -5.2, z: 2.9 },
    { x: -0.35, z: 3.1 },
    { x: 7.8, z: 2.9 },
  ],
  start: { x: -9.8, z: 2.5 },
  goal: { x: 9.8, z: 2.5 },
  guardZ: -2.9,
};

const wire = (id: string, from: [string, string], to: [string, string]): Wire => ({ id, from: { node: from[0], port: from[1] }, to: { node: to[0], port: to[1] } });
const p3 = (p: { x: number; z: number }, y = 0.5): Vec3 => ({ x: p.x, y, z: p.z });

/** Route of the cat: start, then each cover spot, then the goal. */
export function routeOf(l: StealthLayout): { x: number; z: number }[] {
  return [l.start, ...l.spots, l.goal];
}

let sceneryIndex = 0;
/** Scenery is never drawn, so it only needs a spot of its own: a strip below the board holds them all in rows. */
const nextScenery = (): { x: number; y: number } => {
  const i = sceneryIndex++;
  return { x: 20 + (i % 5) * 190, y: 640 + Math.floor(i / 5) * 44 };
};
const scenery = (id: string, kind: string, params: GraphNode['params']): GraphNode => ({ id, kind, params, pos: nextScenery() });

/** Settings of the "Chạy theo tuyến" piece the player takes from the tray: the cat's route, run one leg at a time. */
export function routeParamsOf(l: StealthLayout): GraphNode['params'] {
  const route = routeOf(l);
  return {
    count: route.length,
    ...Object.fromEntries(route.map((p, i) => [`p${i + 1}`, p3(p)])),
    style: 'loop',
    follow: 'steer',
    speed: CAT_SPEED,
    lookAhead: 0,
    arriveRadius: CAT_ARRIVE,
    legs: 'dash',
    readyFor: CAT_READY,
    slowRadius: CAT_EASE,
  };
}

/** Settings of the "Dự đoán tầm nhìn" piece: it watches the next leg of the cat. */
export const FORECAST_PARAMS: GraphNode['params'] = { watch: 'leg', horizon: 12 };

/** The locked board of the level for a layout. Only the layout changes between searches; the shipped level uses LAYOUT. */
export function stealthBase(l: StealthLayout): { nodes: GraphNode[]; wires: Wire[] } {
  sceneryIndex = 0;
  const nodes: GraphNode[] = [
    scenery('floor', 'block', { position: { x: 0, y: -0.5, z: -0.2 }, size: { x: 26, y: 1, z: 12 }, color: '#a7c4a0', type: 'solid' }),
    scenery('goal', 'block', { name: 'Ô xanh', position: { x: l.goal.x, y: 0.1, z: l.goal.z }, size: { x: 1.6, y: 0.2, z: 1.6 }, color: '#22c55e', type: 'pickup' }),
    ...l.crates.map((c, i) =>
      scenery(`crate-${i + 1}`, 'block', { name: `Thùng ${i + 1}`, position: { x: c.x, y: CRATE_SIZE.y / 2, z: c.z }, size: CRATE_SIZE, color: '#b45309', type: 'solid' }),
    ),
    scenery('arrive', 'touch', {}),
    scenery('cam', 'camera', { mode: 'fixed', point: { x: 0, y: 0, z: 0 }, view: 'tilted', zoom: 0.85 }),
    scenery('end', 'win-lose', { winMessage: 'Mèo nhỏ tới đích mà không bị thấy!', loseMessage: 'Lính gác thấy mèo nhỏ rồi!' }),
    // Left column: the cat, then the guard with its walk. The eyes (loss plumbing) are scenery.
    { id: 'hero', kind: 'character', params: { name: 'Mèo nhỏ', position: p3(l.start, 1), speed: CAT_SPEED, color: '#f9a8d4', look: PUZZLE_LOOKS.catChibi, role: 'bot' }, pos: { x: 10, y: 10 } },
    { id: 'guard', kind: 'character', params: { name: 'Lính gác', position: { x: GUARD_LANE.x, y: 1, z: l.guardZ }, speed: GUARD_LANE.speed, color: '#64748b', look: PUZZLE_LOOKS.robotLegs, role: 'bot' }, pos: { x: 10, y: 132 } },
    { id: 'patrol', kind: 'patrol', params: { pointA: { x: GUARD_LANE.x, y: 0.5, z: GUARD_LANE.z1 - TURN_SLACK }, pointB: { x: GUARD_LANE.x, y: 0.5, z: GUARD_LANE.z2 + TURN_SLACK }, wait: GUARD_LANE.wait, pathfind: 'off' }, pos: { x: 10, y: 256 } },
    scenery('eyes', 'vision-sensor', { range: GUARD_EYES.range, angle: GUARD_EYES.angle, walls: 'yes' }),
    // The guard walks only because this locked card switches its walk on; the cat's own walk takes the same signal from it.
    { id: 'start', kind: 'on-start', params: {}, pos: { x: 10, y: 462 } },
  ];
  const wires: Wire[] = [
    wire('b1', ['guard', 'self'], ['patrol', 'self']),
    wire('b2', ['patrol', 'moveX'], ['guard', 'moveX']),
    wire('b3', ['patrol', 'moveY'], ['guard', 'moveY']),
    wire('b4', ['guard', 'self'], ['eyes', 'viewer']),
    wire('b5', ['hero', 'self'], ['eyes', 'target']),
    wire('b6', ['hero', 'self'], ['arrive', 'a']),
    wire('b7', ['goal', 'self'], ['arrive', 'b']),
    wire('b8', ['arrive', 'touching'], ['end', 'win']),
    wire('b9', ['eyes', 'seen'], ['end', 'lose']),
    wire('b10', ['start', 'started'], ['patrol', 'on']),
    wire('b11', ['start', 'started'], ['cam', 'on']),
  ];
  return { nodes, wires };
}

const base = stealthBase(LAYOUT);

/**
 * Level 6 (ne-linh-gac): the little cat sneaks to the green tile past a guard robot that patrols and looks where it walks.
 * The cat only ever stops behind a crate; the player builds the cat's whole brain: the route run one leg at a time,
 * the sight forecast, and the "Còn >= Cần" check that lets it dash. On the board only the cat and the guard with
 * its walk (the enemy's brain, a locked card) are shown; crates, floor, goal tile, the guard's eyes, win/lose plumbing
 * and camera are scenery. The guard seeing the cat anywhere is a loss.
 */
export const level06: PuzzleLevel = {
  id: 'ne-linh-gac',
  order: 6,
  title: 'Lẻn qua mắt lính gác',
  task: 'Mèo nhỏ phải lẻn tới ô xanh, nấp sau từng thùng một. Lính gác đi tuần và nhìn theo hướng đi: bị thấy là thua! Bạn tự lắp bộ não cho mèo: khi nào được chạy sang thùng kế, khi nào phải nấp.',
  hint: 'Cho mèo đi theo "Chạy theo tuyến" (nối "Đi ngang" và "Đi dọc" về mèo). "Dự đoán tầm nhìn" cho biết "Còn" mấy giây nữa lính gác thấy chặng kế, và "Cần" là số giây mèo chạy hết chặng. Mèo chỉ được chạy khi "Còn" lớn hơn hoặc bằng "Cần": dùng "So sánh" rồi nối vào "Chạy".',
  mode: '3d',
  cast: [PUZZLE_LOOKS.catChibi, PUZZLE_LOOKS.robotLegs],
  base: { nodes: base.nodes, wires: base.wires },
  stepMoveBreaks: true,
  shownPorts: {
    ...Object.fromEntries(['floor', 'goal', 'crate-1', 'crate-2', 'crate-3', 'arrive', 'eyes', 'cam', 'end'].map((id) => [id, { in: [], out: [] }])),
    hero: { in: ['moveX', 'moveY'], out: ['self'] },
    guard: { in: ['moveX', 'moveY'], out: ['self'] },
    patrol: { in: ['self', 'on'], out: ['moveX', 'moveY', 'atEnd', 'route'] },
    start: { in: [], out: ['started'] },
  },
  tray: [
    { kind: 'route-follow', count: 1, params: routeParamsOf(LAYOUT) },
    { kind: 'sight-forecast', count: 1, params: FORECAST_PARAMS },
    { kind: 'compare', count: 1 },
    { kind: 'distance', count: 1, params: { threshold: 3 } },
    { kind: 'not', count: 1 },
  ],
  editable: [{ kind: 'distance', paramId: 'threshold' }],
  par: 3,
  freeHints: 4,
  timeLimit: 60,
  solution: {
    nodes: [
      { id: 's-route', kind: 'route-follow', params: routeParamsOf(LAYOUT), pos: { x: 260, y: 20 } },
      { id: 's-fore', kind: 'sight-forecast', params: FORECAST_PARAMS, pos: { x: 260, y: 300 } },
      { id: 's-cmp', kind: 'compare', params: { op: 'ge' }, pos: { x: 520, y: 300 } },
    ],
    wires: [
      wire('sw1', ['hero', 'self'], ['s-route', 'self']),
      wire('sw2', ['s-route', 'moveX'], ['hero', 'moveX']),
      wire('sw3', ['s-route', 'moveY'], ['hero', 'moveY']),
      wire('sw4', ['guard', 'self'], ['s-fore', 'viewer']),
      wire('sw5', ['hero', 'self'], ['s-fore', 'target']),
      wire('sw6', ['s-fore', 'window'], ['s-cmp', 'a']),
      wire('sw7', ['s-fore', 'need'], ['s-cmp', 'b']),
      wire('sw8', ['s-cmp', 'out'], ['s-route', 'go']),
      wire('sw9', ['start', 'started'], ['s-route', 'on']),
      wire('sw10', ['patrol', 'route'], ['s-fore', 'patrol']),
      wire('sw11', ['s-route', 'route'], ['s-fore', 'route']),
    ],
  },
};
