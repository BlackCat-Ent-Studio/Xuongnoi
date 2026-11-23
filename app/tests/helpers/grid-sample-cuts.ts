import { expect, it } from 'vitest';
import type { Board } from '../../src/engine/types';
import { say } from '../traffic/traffic-log';
import { cageLabel } from '../../src/samples/sorting-grid-floor';
import { GRID_IDS } from '../../src/samples/sorting-grid-plan';
import { circuitOf } from './factory-run';
import { envFlag, runGrid, shippedGrid, type GridResult } from './grid-sample-run';

/**
 * "Nothing happens without its wire" for the grid-floor sorting sample: the board is played once as it is and once with
 * ONE wire taken out, and the cut must show as the named symptom. A symptom is read from the same measurements as the
 * reference run (entity views, card outputs, the numbers on the screen); it must be absent on the board before the cut.
 */

/** Simulated seconds of a run: long enough for each robot to load, drive and tip at least once. */
export const CUT_SECONDS = 45;
/** Seconds for the symptoms that show at once (whole: every robot has left its cell and a carton lies on a tray after 10 s). */
export const QUICK_SECONDS = 20;
const QUICK = /^(no carton is made|no carton gets onto a tray|no robot leaves its cell|robot \d+ never leaves its cell)$/;
const secondsOf = (cut: Cut): number => cut.seconds ?? (QUICK.test(cut.symptom) ? QUICK_SECONDS : CUT_SECONDS);
/** Seconds a robot must stand for the symptom "stands for more than ... s": far longer than the 4 s wait beside a locked hole. */
export const STANDS_S = 30;

const sum = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0);

export const HUD = {
  total: 'Tổng kiện đã phân loại',
  wrong: 'Kiện vào sai ô',
  onDeck: 'Kiện nằm lại trên mặt sàn',
  route: (k: number): string => cageLabel(k),
  waiting: (s: number): string => `Trạm ${s}: mã kiện đang chờ`,
} as const;

/** What a cut can do to the run. `x` is the run with the wire out, `base` the same board with the wire in. */
export const SYMPTOMS = {
  'no carton is made': (x) => x.made === 0,
  'a station makes cartons without end': (x, base) => x.made >= 2 * base.made,
  'no carton gets onto a tray': (x) => x.carried === 0,
  'no robot leaves its cell': (x) => x.moved.length === 0,
  'no carton reaches a box': (x) => x.sortedRight + x.sortedWrong === 0,
  'at most half as many cartons reach a box': (x, base) => x.sortedRight + x.sortedWrong <= (base.sortedRight + base.sortedWrong) / 2,
  'fewer cartons reach a box': (x, base) => x.sortedRight + x.sortedWrong < base.sortedRight + base.sortedWrong,
  'cartons end in a wrong box': (x) => x.sortedWrong > 0,
  'cartons end on the deck floor or on the ground': (x) => x.onDeck.length + x.onGround.length > 0,
  'two robots touch': (x) => x.minGap < 0.01,
  'the tip counters stay at 0': (x) => sum(x.tips) === 0,
  'the load counters stay at 0': (x) => sum(x.loads) === 0,
  'the box counters stay at 0': (x) => sum(x.counts) === 0,
  'the wrong-route counters count': (x) => sum(x.wrongs) > 0,
  'the wrong-route counters stay at 0': (x) => sum(x.wrongs) === 0,
  // --- the lock of a full cage, the lamp, the plates, the wait and the lap, the swap
  'a carton lands on a cover': (x) => x.onCover.length > 0,
  'no hole is ever locked and a cage gets more cartons than its capacity': (x) => sum(x.locks) === 0 && x.mostInCage > x.capacity,
  'a lamp does not show the colour for the number in its cage': (x) => x.lampWrongTicks > 0,
  'the plates do not follow the lock': (x) => x.coverWrongTicks > 0,
  'no robot takes a lap': (x) => sum(x.laps) === 0,
  'a robot stands for more than 30 s': (x) => x.longestStandstill > STANDS_S,
  'a robot waits beside an open hole': (x) => x.waitTicksOpen > 0,
  'a hole stays locked over an empty cage': (x) => x.lockedEmptyTicks > 60,
  'the swap empties nothing': (x) => x.presses.length > 0 && x.goneRight + x.goneWrong === 0,
  'the swap never ends': (x) => x.swapUnfinished,
  'screen: total stays at 0': (x) => x.hud[HUD.total] === 0,
  'screen: total is too small': (x) => (x.hud[HUD.total] ?? 0) < x.sortedRight + x.sortedWrong,
  'screen: wrong-box number stays at 0': (x) => x.hud[HUD.wrong] === 0,
  'screen: wrong-box number is too small': (x) => (x.hud[HUD.wrong] ?? 0) < sum(x.wrongs),
  'screen: on-the-deck number stays at 0': (x) => x.hud[HUD.onDeck] === 0,
  'screen: on-the-deck number counts': (x) => (x.hud[HUD.onDeck] ?? 0) > 0,
  'screen: no waiting code at station 1': (x) => x.hudMax[HUD.waiting(1)] === 0,
  'screen: no waiting code at station 2': (x) => x.hudMax[HUD.waiting(2)] === 0,
  'the camera card does not hold the camera': (x) => !x.cameraHeld,
} satisfies Record<string, (x: GridResult, base: GridResult) => boolean>;

export type Symptom = keyof typeof SYMPTOMS | `screen: route ${number} stays at 0` | `robot ${number} never leaves its cell` | `robot ${number} tips nothing`;

function shows(symptom: Symptom, x: GridResult, base: GridResult): boolean {
  const route = /^screen: route (\d+) stays at 0$/.exec(symptom);
  if (route) return x.hud[HUD.route(Number(route[1]))] === 0;
  const stays = /^robot (\d+) never leaves its cell$/.exec(symptom);
  if (stays) return !x.moved.includes(Number(stays[1]));
  const idle = /^robot (\d+) tips nothing$/.exec(symptom);
  if (idle) return x.tips[Number(idle[1])] === 0;
  return SYMPTOMS[symptom as keyof typeof SYMPTOMS](x, base);
}

export interface Cut {
  /** The wire, as `card.port > card.port`, with the board it is on in front. */
  name: string;
  /** The board with the wire out. */
  board: () => Board;
  symptom: Symptom;
  /** Simulated seconds, when not the usual. */
  seconds?: number;
  /** The board before the cut when that is not the shipped one (a board on which the thing the wire reports does happen), and a name for it. */
  from?: { name: string; board: () => Board };
  /** "Đổi lồng" is pressed by the script whenever a hole has been locked for this many seconds. */
  pressAfterLockedS?: number;
}

/** A board whose cages say "Đã đầy" at two cartons, so a hole is locked within the first half minute. */
export function quickLock(board: Board = shippedGrid()): Board {
  circuitOf(board, GRID_IDS.catch).graph.nodes.find((n) => n.id === 'long')!.params.capacity = 2;
  return board;
}

/** A board whose stations make cartons of the routes from..to only. */
export function onlyRoutes(from: number, to: number, board: Board = shippedGrid()): Board {
  const dice = circuitOf(board, GRID_IDS.station).graph.nodes.find((n) => n.id === 'xuc-xac')!;
  dice.params.min = from;
  dice.params.max = to;
  return board;
}

/** A board whose stations make cartons of route k only, so that route is fed from the first tip on. */
export function onlyRoute(k: number, board: Board = shippedGrid()): Board {
  const dice = circuitOf(board, GRID_IDS.station).graph.nodes.find((n) => n.id === 'xuc-xac')!;
  dice.params.min = k;
  dice.params.max = k;
  return board;
}

export const cutLine = (x: GridResult): string =>
  `locks ${x.locks.slice(1).join('/')}, most in a cage ${x.mostInCage}, on a cover ${x.onCover.length}, tip ticks while locked ${x.tipsWhileLocked}, waits ${x.waits}, laps ${x.laps.slice(1).join('/')}, stood ${x.longestStandstill.toFixed(0)} s, wrong ticks lamp ${x.lampWrongTicks} / plates ${x.coverWrongTicks}, waited at an open hole ${x.waitTicksOpen}, locked over an empty cage ${x.lockedEmptyTicks}, presses ${x.presses.length}${x.swapUnfinished ? ' (swap still running)' : ''} :: ` +
  `made ${x.made}, on a tray ${x.carried}, own box ${x.sortedRight}, other box ${x.sortedWrong}, deck ${x.onDeck.length}, ground ${x.onGround.length}, taken back ${x.goneRight + x.goneWrong}, alive ${x.alive}; counters ${x.counts.slice(1).join('/')}, wrong ${sum(x.wrongs)}, loads ${x.loads.slice(1).join('/')}, tips ${x.tips.slice(1).join('/')}; moved ${x.moved.join('') || '-'}, gap ${(x.minGap * 1000).toFixed(0)} mm; screen ${x.hud[HUD.total]}/${x.hud[HUD.wrong]}/${x.hud[HUD.onDeck]}, waiting codes seen ${x.hudMax[HUD.waiting(1)]}/${x.hudMax[HUD.waiting(2)]}, camera ${x.cameraHeld ? 'held' : 'free'}`;

const pressOf = (cut: Cut): { pressAfterLockedS?: number } => (cut.pressAfterLockedS === undefined ? {} : { pressAfterLockedS: cut.pressAfterLockedS });

const bases = new Map<string, GridResult>();
function baseRun(cut: Cut): GridResult {
  const key = `${cut.from?.name ?? 'as shipped'} ${secondsOf(cut)}${cut.pressAfterLockedS === undefined ? '' : ` press ${cut.pressAfterLockedS}`}`;
  let res = bases.get(key);
  if (!res) {
    res = runGrid((cut.from?.board ?? shippedGrid)(), secondsOf(cut), pressOf(cut));
    bases.set(key, res);
    say(`BASE [${key}]: ${cutLine(res)}`);
  }
  return res;
}

/** With GRID_CUT_FIND=1 nothing is asserted: every symptom that shows is printed, to fill in a table. */
const FIND = envFlag('GRID_CUT_FIND');

/** One test per cut. */
export function cutTests(cuts: readonly Cut[]): void {
  it.each(cuts.map((c) => [c.name, c] as const))('%s', { timeout: 600_000 }, (_name, cut) => {
    const base = baseRun(cut);
    const x = runGrid(cut.board(), secondsOf(cut), pressOf(cut));
    if (FIND) {
      const all = (Object.keys(SYMPTOMS) as Symptom[]).filter((s) => shows(s, x, base) && !shows(s, base, base));
      say(`FIND [${cut.name}]: ${all.join(' | ') || 'NOTHING SHOWS'} :: ${cutLine(x)}`);
      return;
    }
    say(`CUT [${cut.name}] -> ${cut.symptom} :: ${cutLine(x)}`);
    expect(shows(cut.symptom, base, base), `"${cut.symptom}" already shows before the cut`).toBe(false);
    expect(shows(cut.symptom, x, base), `${cut.name}: expected "${cut.symptom}"; got ${cutLine(x)}`).toBe(true);
  });
}

/** Wires of "Xe phân loại" that only speak beside a locked hole: cut on a board where a hole does lock (the lock file). */
export const ROBOT_LOCK_WIRES: readonly string[] = [
  'doc-ma.code > muoi-mu-k.index',
  'doc-ma.code > muoi-mu-k-1.index',
  'muoi-mu-k.value > phan-du.b',
  'phan-du.out > lo-khoa.a',
  'lo-khoa.out > lo-mo.in',
  'doc-moc.number > o-o-do.a',
  'o-do.value > o-o-do.b',
  'than.self > dung-yen.who',
  'o-o-do.out > dung-canh-lo.a',
  'dung-yen.still > dung-canh-lo.b',
  'dung-canh-lo.out > cho-lo.a',
  'lo-khoa.out > cho-lo.b',
  'cho-lo.out > dem-cho.run',
  'cho-lo.out > thoi-cho.in',
  'thoi-cho.out > dem-cho.reset',
  'dem-cho.done > di-vong.set',
  'doc-ma.code > o-vong.index',
  'doc-moc.number > toi-o-vong.a',
  'o-vong.value > toi-o-vong.b',
  'toi-o-vong.out > di-vong.reset',
  'di-vong.on > dang-vong.on',
  'o-vong.value > lech-vong.a',
  'o-do.value > lech-vong.b',
  'lech-vong.out > them-vong.a',
  'dang-vong.value > them-vong.b',
  'them-vong.out > o-co-hang.b',
];

/** The same for "Lỗ thả": lamp, lock and plates. */
export const HOLE_LOCK_WIRES: readonly string[] = [
  'long.count > bang-mau.index',
  'bang-mau.value > den.pick',
  'long.full > khoa.set',
  'long.count > long-trong.a',
  'long-trong.out > khoa.reset',
  'khoa.on > lo-mo.in',
  'khoa.on > nap-dong.show',
  'lo-mo.out > nap-dong.hide',
  'khoa.on > nap-mo.hide',
  'lo-mo.out > nap-mo.show',
  'khoa.on > so-khoa.on',
];
