import { expect, it } from 'vitest';
import type { Board } from '../../src/engine/types';
import { say } from '../traffic/traffic-log';
import { GRID_IDS } from '../../src/samples/sorting-grid-plan';
import { circuitOf } from './factory-run';
import { runGrid, shippedGrid, type GridResult } from './grid-sample-run';

/**
 * "Nothing happens without its wire" for the grid-floor sorting sample: the board is played once as it is and once with
 * ONE wire taken out, and the cut must show as the named symptom. A symptom is read from the same measurements as the
 * reference run (entity views, card outputs, the numbers on the screen); it must be absent on the board before the cut.
 */

/** Simulated seconds of every run: long enough for each robot to load, drive and tip at least once. */
export const CUT_SECONDS = 45;

const sum = (list: readonly number[]): number => list.reduce((a, b) => a + b, 0);

export const HUD = {
  total: 'Tổng kiện đã phân loại',
  wrong: 'Kiện vào sai ô',
  onDeck: 'Kiện nằm lại trên mặt sàn',
  route: (k: number): string => `Tuyến ${k}`,
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
  'counted cartons are not taken back': (x, base) => x.goneRight + x.goneWrong < base.goneRight + base.goneWrong && x.alive > base.alive,
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
  /** The board before the cut when that is not the shipped one (a board on which the thing the wire reports does happen), and a name for it. */
  from?: { name: string; board: () => Board };
  seconds?: number;
}

/** A board whose stations make cartons of route k only, so that route is fed from the first tip on. */
export function onlyRoute(k: number, board: Board = shippedGrid()): Board {
  const dice = circuitOf(board, GRID_IDS.station).graph.nodes.find((n) => n.id === 'xuc-xac')!;
  dice.params.min = k;
  dice.params.max = k;
  return board;
}

export const cutLine = (x: GridResult): string =>
  `made ${x.made}, on a tray ${x.carried}, own box ${x.sortedRight}, other box ${x.sortedWrong}, deck ${x.onDeck.length}, ground ${x.onGround.length}, taken back ${x.goneRight + x.goneWrong}, alive ${x.alive}; counters ${x.counts.slice(1).join('/')}, wrong ${sum(x.wrongs)}, loads ${x.loads.slice(1).join('/')}, tips ${x.tips.slice(1).join('/')}; moved ${x.moved.join('') || '-'}, gap ${(x.minGap * 1000).toFixed(0)} mm; screen ${x.hud[HUD.total]}/${x.hud[HUD.wrong]}/${x.hud[HUD.onDeck]}, waiting codes seen ${x.hudMax[HUD.waiting(1)]}/${x.hudMax[HUD.waiting(2)]}, camera ${x.cameraHeld ? 'held' : 'free'}`;

const bases = new Map<string, GridResult>();
function baseRun(cut: Cut): GridResult {
  const key = `${cut.from?.name ?? 'as shipped'} ${cut.seconds ?? CUT_SECONDS}`;
  let res = bases.get(key);
  if (!res) {
    res = runGrid((cut.from?.board ?? shippedGrid)(), cut.seconds ?? CUT_SECONDS);
    bases.set(key, res);
    say(`BASE [${key}]: ${cutLine(res)}`);
  }
  return res;
}

/** With VITE_GRID_CUT_FIND=1 nothing is asserted: every symptom that shows is printed, to fill in a table. */
const FIND = Boolean((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GRID_CUT_FIND);

/** One test per cut. */
export function cutTests(cuts: readonly Cut[]): void {
  it.each(cuts.map((c) => [c.name, c] as const))('%s', { timeout: 600_000 }, (_name, cut) => {
    const base = baseRun(cut);
    const x = runGrid(cut.board(), cut.seconds ?? CUT_SECONDS);
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
