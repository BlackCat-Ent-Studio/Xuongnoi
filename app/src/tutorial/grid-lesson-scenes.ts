import { estimateNodeSize } from '../editor/graph/graph-geometry';
import { STUDENT_CARD_METRICS } from '../editor/graph/shipped-layout';
import { getNodeDef } from '../engine/registry';
import type { Params } from '../engine/types';
import type { NodeSpec, WireSpec } from '../handbook/boards-robot-arm';

/**
 * Starting boards of the two lessons about a floor of numbered cells with arrows: one robot that finds its way, and two
 * robots whose ways cross in one cell. Each board carries its own judge made of plain cards ("Đo khoảng cách",
 * "Va chạm", "Thắng / Thua"), so a lesson is finished by what the robots do, not by a click.
 */

/** Distance between the middles of two neighbouring cells, which is also the size of a cell (m). */
export const CELL = 1.4;
export const BLUE = '#3b82f6';
export const GREEN = '#22c55e';
/** How near the middle of its goal cell a robot must stand to count as arrived (m). */
const ARRIVE_WITHIN = 0.2;
const BUMP_GROW = -0.1;

const CHASSIS = { length: 0.9, width: 0.7 };
const MOTOR_SIDE = CHASSIS.width / 2 - 0.05;

/** Middle of cell `number` of a 3 x 3 floor numbered 1..9 row by row, the floor centred on the origin. */
export function cellPlace(number: number): { x: number; y: number; z: number } {
  const row = Math.floor((number - 1) / 3);
  const col = (number - 1) % 3;
  return { x: (col - 1) * CELL, y: 0.5, z: (row - 1) * CELL };
}

// ---------------------------------------------------------------- card placing

const MARGIN = 20;
const COL_W = 300;
const GAP_Y = 24;

type Card = { alias: string; kind: string; params?: Params };

/** Height of a card at the biggest card size, so cards stacked here never overlap in any display mode. */
function heightOf(card: Card): number {
  const def = getNodeDef(card.kind);
  if (!def) throw new Error(`Unknown node kind in lesson board: ${card.kind}`);
  const params: Params = {};
  for (const p of def.params) params[p.id] = p.default;
  return estimateNodeSize({ id: '', kind: card.kind, params: { ...params, ...card.params }, pos: { x: 0, y: 0 } }, STUDENT_CARD_METRICS).h;
}

/** Stacks cards downwards in column `col` from `top`. Returns the placed cards and the lowest edge. */
function column(col: number, top: number, cards: readonly Card[]): { nodes: NodeSpec[]; bottom: number } {
  let y = top;
  const nodes = cards.map((c): NodeSpec => {
    const spec = { ...c, x: MARGIN + col * COL_W, y };
    y += heightOf(c) + GAP_Y;
    return spec;
  });
  return { nodes, bottom: y };
}

/** Columns side by side from `top`: a band of the board. */
function band(top: number, columns: readonly (readonly [col: number, cards: readonly Card[]])[]): { nodes: NodeSpec[]; bottom: number } {
  const placed = columns.map(([col, cards]) => column(col, top, cards));
  return { nodes: placed.flatMap((p) => p.nodes), bottom: Math.max(top, ...placed.map((p) => p.bottom)) };
}

const marker = (number: number, exits: string): Card => ({ alias: `cell${number}`, kind: 'floor-marker', params: { number, position: cellPlace(number), size: CELL, exits } });
const body = (alias: string, cell: number, heading: number, color: string): Card => ({
  alias,
  kind: 'robot-body',
  params: { position: cellPlace(cell), heading, length: CHASSIS.length, width: CHASSIS.width, color },
});
const motors = (id: string): Card[] => [
  { alias: `left${id}`, kind: 'motor', params: { side: -MOTOR_SIDE } },
  { alias: `right${id}`, kind: 'motor', params: { side: MOTOR_SIDE } },
];
/** The driver of robot `id` already drives its two motors; what it lacks is somewhere to go. */
const driveWires = (id: string): WireSpec[] => [
  [`body${id}`, 'self', `left${id}`, 'body'],
  [`body${id}`, 'self', `right${id}`, 'body'],
  [`body${id}`, 'self', `drive${id}`, 'robot'],
  ['start', 'started', `drive${id}`, 'go'],
  [`drive${id}`, 'left', `left${id}`, 'power'],
  [`drive${id}`, 'right', `right${id}`, 'power'],
];

// ---------------------------------------------------------------- one robot finds its way

export const WAY_START = 1;
export const WAY_GOAL = 8;
/** The cells the arrows lead through from the start to the goal by the shortest way: one turn, in cell 2. */
export const WAY_PATH: readonly number[] = [2, 5, 8];
export const WAY_WIN_TEXT = 'Robot đã tới ô đích!';

/**
 * Arrows of the 3 x 3 floor: a one-way ring round the outside (1 → 2 → 3 → 6 → 9 → 8 → 7 → 4 → 1) and a short cut down
 * the middle (2 → 5 → 8). No two cells point at each other.
 */
const WAY_ARROWS: Record<number, string> = { 1: 'E', 2: 'ES', 3: 'S', 4: 'N', 5: 'S', 6: 'S', 7: 'N', 8: 'W', 9: 'W' };

/**
 * Start of "Robot tự tìm đường trên lưới": the floor, a robot on cell 1 whose driver has no goal yet, the number of the
 * goal cell, and the judge (the robot within reach of the middle of the goal cell wins). Columns 2 and 3 of the top band
 * are left free for the learner's cards.
 */
export function findWayScene(): NodeSpec[] {
  const left = band(MARGIN, [
    [0, [{ alias: 'start', kind: 'on-start' }, { alias: 'goal', kind: 'const', params: { value: WAY_GOAL } }]],
    [1, [body('body', WAY_START, 0, BLUE)]],
  ]);
  // The driver, the motors and, under the motors, the judge.
  const right = band(MARGIN, [
    [4, [{ alias: 'drive', kind: 'robot-goto' }]],
    [5, [...motors(''), { alias: 'near', kind: 'distance', params: { threshold: ARRIVE_WITHIN } }, { alias: 'judge', kind: 'win-lose', params: { winMessage: WAY_WIN_TEXT } }]],
  ]);
  // The floor cards (columns 0 to 2) start below the learner's cards too, so nothing added in a free column lands on a cell card.
  const free = Math.max(left.bottom, ...[2, 3].map((col) => column(col, MARGIN, findWaySolutionCards(col)).bottom));
  const floor = band(free + GAP_Y, [0, 1, 2].map((col) => [col, [0, 1, 2].map((row) => marker(row * 3 + col + 1, WAY_ARROWS[row * 3 + col + 1]!))] as const));
  return [...left.nodes, ...right.nodes, ...floor.nodes];
}
export const FIND_WAY_SCENE_WIRES: WireSpec[] = [
  ...driveWires(''),
  ['body', 'self', 'near', 'a'],
  [`cell${WAY_GOAL}`, 'self', 'near', 'b'],
  ['near', 'within', 'judge', 'win'],
];

/** What the learner adds, by free column: the reader and the route finder, then the number-to-marker lookup. */
function findWaySolutionCards(col: number): Card[] {
  return col === 2 ? [{ alias: 'reader', kind: 'floor-marker-sensor' }, { alias: 'route', kind: 'grid-route' }] : [{ alias: 'find', kind: 'floor-marker-find' }];
}
export function findWaySolutionNodes(): NodeSpec[] {
  return [2, 3].flatMap((col) => column(col, MARGIN, findWaySolutionCards(col)).nodes);
}
export const FIND_WAY_SOLUTION_WIRES: WireSpec[] = [
  ['body', 'self', 'reader', 'who'],
  ['reader', 'number', 'route', 'at'],
  ['goal', 'value', 'route', 'goal'],
  ['route', 'next', 'find', 'number'],
  ['find', 'marker', 'drive', 'target'],
];

// ---------------------------------------------------------------- two robots, one cell

/** Where the two robots start and where each wants to go: the blue one drives along the row, the green one down the column. */
export const CROSS = { cell: 5, start1: 4, goal1: 6, start2: 2, goal2: 8 } as const;
export const CROSS_WIN_TEXT = 'Cả hai robot tới đích, không ai đụng ai!';
export const CROSS_LOSE_TEXT = 'Hai robot đụng nhau ở ô 5!';

const CROSS_ARROWS: Record<number, string> = { 2: 'S', 4: 'E', 5: 'ES', 6: 'none', 8: 'none' };

const HOLD_COLUMN = 5;
const HOLD_CARD: Card = { alias: 'hold', kind: 'cell-hold' };

/** A whole robot that already finds its way: what the learner built in the lesson before. */
const routedRobot = (id: string, cell: number, heading: number, color: string, goal: number): (readonly [number, Card[]])[] => [
  [0, [{ alias: `goal${id}`, kind: 'const', params: { value: goal } }]],
  [1, [body(`body${id}`, cell, heading, color), { alias: `reader${id}`, kind: 'floor-marker-sensor' }]],
  [2, [{ alias: `route${id}`, kind: 'grid-route' }, { alias: `find${id}`, kind: 'floor-marker-find' }]],
  [3, [{ alias: `drive${id}`, kind: 'robot-goto' }]],
  [4, motors(id)],
];
const routedWires = (id: string): WireSpec[] => [
  ...driveWires(id),
  [`body${id}`, 'self', `reader${id}`, 'who'],
  [`reader${id}`, 'number', `route${id}`, 'at'],
  [`goal${id}`, 'value', `route${id}`, 'goal'],
  [`route${id}`, 'next', `find${id}`, 'number'],
  [`find${id}`, 'marker', `drive${id}`, 'target'],
];

const firstRobotBand = (): { nodes: NodeSpec[]; bottom: number; start: NodeSpec[] } => {
  const start = column(0, MARGIN, [{ alias: 'start', kind: 'on-start' }]);
  return { ...band(start.bottom, routedRobot('1', CROSS.start1, 0, BLUE, CROSS.goal1)), start: start.nodes };
};

/** Top of the band of cards of the second robot: the cards of the first robot all lie above it. */
export const crossingSecondRobotY = (): number => firstRobotBand().bottom + GAP_Y;

/**
 * Start of "Hai robot, một ô": a floor shaped like a plus, two robots that each find their way and meet in the middle
 * cell, and the judge: the two chassis touching loses, both robots on the middle of their goal cells wins. The top of
 * the last column is left free for the learner's "Bảng giữ ô".
 */
export function crossingScene(): NodeSpec[] {
  const first = firstRobotBand();
  // The judge stands below the place kept free for the hold card.
  const judge = column(HOLD_COLUMN, column(HOLD_COLUMN, MARGIN, [HOLD_CARD]).bottom + GAP_Y, [
    { alias: 'near1', kind: 'distance', params: { threshold: ARRIVE_WITHIN } },
    { alias: 'near2', kind: 'distance', params: { threshold: ARRIVE_WITHIN } },
    { alias: 'both', kind: 'and' },
    // Shrunk a little, so the square the world keeps round a chassis only counts once the drawn bodies overlap.
    { alias: 'bump', kind: 'touch', params: { grow: BUMP_GROW } },
    { alias: 'judge', kind: 'win-lose', params: { winMessage: CROSS_WIN_TEXT, loseMessage: CROSS_LOSE_TEXT } },
  ]);
  const second = band(crossingSecondRobotY(), routedRobot('2', CROSS.start2, 90, GREEN, CROSS.goal2));
  // The five cell cards lie as the cells lie on the floor: a plus.
  const floorTop = second.bottom + GAP_Y;
  const row = heightOf(marker(1, 'none')) + GAP_Y;
  const floor = [2, 4, 5, 6, 8].map((n): NodeSpec => ({ ...marker(n, CROSS_ARROWS[n]!), x: MARGIN + ((n - 1) % 3) * COL_W, y: floorTop + Math.floor((n - 1) / 3) * row }));
  return [...first.start, ...first.nodes, ...judge.nodes, ...second.nodes, ...floor];
}
export const CROSSING_SCENE_WIRES: WireSpec[] = [
  ...routedWires('1'),
  ...routedWires('2'),
  ['body1', 'self', 'near1', 'a'],
  [`cell${CROSS.goal1}`, 'self', 'near1', 'b'],
  ['body2', 'self', 'near2', 'a'],
  [`cell${CROSS.goal2}`, 'self', 'near2', 'b'],
  ['near1', 'within', 'both', 'a'],
  ['near2', 'within', 'both', 'b'],
  ['both', 'out', 'judge', 'win'],
  ['body1', 'self', 'bump', 'a'],
  ['body2', 'self', 'bump', 'b'],
  ['bump', 'touching', 'judge', 'lose'],
];

/** What the learner adds: the hold card, at the top of the last column. */
export function crossingSolutionNodes(): NodeSpec[] {
  return column(HOLD_COLUMN, MARGIN, [HOLD_CARD]).nodes;
}
/** The three wires of robot `id` on row `id` of the hold card; the last one takes the place of "Ô kế tiếp" → "Số mốc". */
export const crossingSolutionWires = (id: '1' | '2'): WireSpec[] => [
  [`body${id}`, 'self', 'hold', `robot${id}`],
  [`route${id}`, 'next', 'hold', `want${id}`],
  ['hold', `cell${id}`, `find${id}`, 'number'],
];
