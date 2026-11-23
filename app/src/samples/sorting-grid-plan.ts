import type { Vec3 } from '../engine/types';

/**
 * The numbers of the grid-floor sorting sample that its circuits, its notes and its tests quote: the floor of 7 x 7 cells
 * on a raised deck, the nine drop holes and their routes, the two feeding stations, the robot and its tray.
 */
export const GRID = {
  rows: 7,
  cols: 7,
  /** Side of a cell (m). */
  pitch: 1.4,
  /** Height of the deck's upper face above the ground (m). */
  top: 2.6,
  /** Side of a drop hole (m). */
  hole: 0.7,
  robots: 6,
  routes: 9,
  seed: 20261123,
} as const;

/** A length rounded to the millimetre, so that a setting reads 4.2 and not 4.199999999999999. */
export const mm = (v: number): number => Math.round(v * 1000) / 1000;

/** Number of the cell in row r, column c (both from 0): the number its "Mốc sàn" carries. */
export const cellNumber = (r: number, c: number): number => r * GRID.cols + c + 1;
/** Middle of a cell on the deck (x, z); y is the deck's upper face. */
export const cellPlace = (r: number, c: number): Vec3 => ({ x: mm(c * GRID.pitch), y: GRID.top, z: mm(r * GRID.pitch) });
/** Holes sit on (odd row, odd column); every other cell is lane. */
export const isLaneCell = (r: number, c: number): boolean => r % 2 === 0 || c % 2 === 0;

export interface Route {
  /** The code printed on the carton, 1..9. */
  code: number;
  /** Row and column of the hole cell. */
  hole: readonly [row: number, col: number];
  /** The lane cell the robot stops on: the one just north of the hole. */
  stop: readonly [row: number, col: number];
  /** Angle of the tray's turntable (degrees): 90 tips to the robot's right, -90 to its left. */
  turn: number;
  /** The station cell the robot drives back to after this route. */
  home: number;
}

/** The two hand-over cells, on the west lane (which runs north). */
export const STATION_CELLS: readonly (readonly [row: number, col: number])[] = [
  [1, 0],
  [5, 0],
];
export const stationCell = (k: 1 | 2): readonly [row: number, col: number] => STATION_CELLS[k - 1]!;
export const stationNumber = (k: 1 | 2): number => cellNumber(...stationCell(k));

/** Routes that end with the drive back to station 1; the others go back to station 2. Chosen so that no way home leads through the other station's cell. */
const HOME_1 = [1, 2, 4, 5, 6];

/**
 * Route k = hole k, counted row by row from the north-west hole. The robot stops on the lane cell north of the hole. The
 * lanes of rows 0 and 4 run east (the hole is on the robot's right), the lane of row 2 runs west (the hole is on its left).
 */
export const ROUTES: readonly Route[] = Array.from({ length: GRID.routes }, (_, n): Route => {
  const hr = 1 + 2 * Math.floor(n / 3);
  const hc = 1 + 2 * (n % 3);
  const eastbound = ((hr - 1) / 2) % 2 === 0;
  return { code: n + 1, hole: [hr, hc], stop: [hr - 1, hc], turn: eastbound ? 90 : -90, home: stationNumber(HOME_1.includes(n + 1) ? 1 : 2) };
});

/** The robot: chassis, tray and the carton it carries (m, kg, degrees). */
export const ROBOT = {
  length: 0.9,
  width: 0.7,
  height: 0.24,
  mass: 5,
  /** The tray plate: how far it reaches across the chassis from its hinge, along the chassis, its thickness, and the gap under it. */
  tray: { across: 0.62, along: 0.74, thickness: 0.05, gap: 0.05 },
  tilt: 35,
  /** Seconds a carton must lie on the tray before the robot turns its tray and drives. */
  settleS: 1.2,
  drive: { power: 0.8, slowDistance: 0.6 },
  /** "Độ tăng tốc" of both motors (rpm per second). Gentler than the motor's own 400: from standstill to full speed in 0.4 s, so a carton does not creep backwards on the tray at every start. */
  motorAccel: 250,
} as const;
/** Height of the tray's upper face above the floor the robot stands on. */
export const TRAY_TOP = mm(ROBOT.height + ROBOT.tray.gap + ROBOT.tray.thickness);

export const CARTON = {
  size: { x: 0.32, y: 0.26, z: 0.28 },
  /** Tape colour and mass of the three classes the stations draw from. */
  classColors: ['#ef4444', '#22c55e', '#3b82f6'] as const,
  classMasses: [1, 2, 3] as const,
  /** Cartons one station may have in the world at once. */
  maxAlive: 20,
} as const;

/** The feeding station, in its own frame: the hand-over cell's middle is the origin, the deck's face is y = 0, the table lies to the west. */
export const STATION = {
  /** Seconds between "table empty" and the next carton. */
  feedGapS: 0.5,
  /** The table: from x0 to x1, its width along z; its top is 1 cm above the tray. */
  table: { x0: -1.2, x1: -0.46, width: 0.5, topY: mm(TRAY_TOP + 0.01) },
  /** Where a new carton's middle is (x). */
  cartonX: -0.8,
  /** The pusher: head size, speed, and where the head's front face stands when it is in and when it is out (x). */
  push: { head: 0.2, speed: 0.5, restX: -1.0, endX: -CARTON.size.x / 2 },
  /** The base the table and the pusher stand on: a block from the ground up to the deck's face. */
  base: { x0: -3.2, x1: -GRID.pitch / 2, width: 1.6 },
} as const;

/** The catch box under a hole and the short belt on the deck that carries a tipped carton into the hole (m). */
export const CATCH = {
  inner: 1.2,
  wallH: 1,
  wallT: 0.1,
  /** The belt lies between the stop cell and the hole: from / to are distances from the middle line of the stop cell's lane. */
  belt: { from: 0.5, to: 1.05, length: 0.8, height: 0.1, speed: 1 },
  /** Seconds between two "Thu hồi" beats. */
  recallEveryS: 0.25,
} as const;

/** Where the six robots start: cell and heading (degrees) of its lane, and the route they "remember" at the start (it picks their first station). */
export const STARTS: readonly { cell: readonly [number, number]; heading: number; route: number }[] = [
  { cell: [0, 1], heading: 0, route: 1 },
  { cell: [4, 3], heading: 0, route: 5 },
  { cell: [0, 5], heading: 0, route: 3 },
  { cell: [6, 1], heading: 180, route: 7 },
  { cell: [2, 3], heading: 180, route: 4 },
  { cell: [6, 5], heading: 180, route: 9 },
];

export const GRID_IDS = { robot: 'xe-phan-loai', station: 'tram-nap-san', catch: 'o-nhan-tuyen', floor: 'san-luoi', adder: 'cong-chin-so' } as const;
