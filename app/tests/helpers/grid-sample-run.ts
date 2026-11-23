import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { TICK_DT, type Board, type EntityView } from '../../src/engine/types';
import { splitLookCode } from '../../src/engine/parcel-code';
import { listSamples } from '../../src/io';
import { CATCH, GRID, ROUTES, isLaneCell } from '../../src/samples/sorting-grid-plan';
import { catchPlace } from '../../src/samples/sorting-grid-floor';
import { overlapDepth } from './chassis-metrics';
import { start, type Started } from './factory-run';
import { stateHash } from './nav-rig';

/**
 * Plays the grid-floor sorting sample as shipped (nothing added, nothing taken away) and measures it from the entity
 * views and the outputs of its cards: where every carton went, what the counters say, how the robots moved.
 */

export const GRID_SAMPLE_ID = 'sorting-factory-grid';

/** The board exactly as the "Bài mẫu" menu hands it out. */
export const shippedGrid = (): Board => structuredClone(listSamples().find((s) => s.id === GRID_SAMPLE_ID)!.board);

export const ROBOTS = Array.from({ length: GRID.robots }, (_, n) => n + 1);
export const ROUTE_CODES = ROUTES.map((r) => r.code);

type Where = 'table' | 'tray' | 'deck' | 'air' | 'ground' | `box${number}`;

interface Carton {
  code: number;
  where: Where;
  /** Ticks in a row it has lain on the deck floor. */
  deckTicks: number;
  /** It was on a robot's tray at some moment. */
  carried: boolean;
}

export interface GridResult {
  seconds: number;
  /** Cartons the two stations made, and how many are still in the world at the end. */
  made: number;
  alive: number;
  maxAlive: number;
  /** Cartons that were taken back, by where they lay when it happened: in the box of their own route, in another box, anywhere else. */
  goneRight: number;
  goneWrong: number;
  goneElsewhere: number;
  /** Per route (index 1..9): cartons that ended in that route's box, by the measurement above. */
  truth: number[];
  /** What the counters of the catch boxes say (index 1..9), and their "wrong route" counters. */
  counts: number[];
  wrongs: number[];
  /** The read-outs on the screen. */
  shownTotal: number;
  shownWrong: number;
  shownOnDeck: number;
  /** Cartons that lay on the deck floor for more than a second / lay on the ground outside every box (ids). */
  onDeck: string[];
  onGround: string[];
  /** Cartons pushed onto a tray by each station, tips by each robot. */
  loads: number[];
  tips: number[];
  perMinute: number;
  /** Robots: smallest gap between two chassis (m), ticks with a chassis middle inside a hole cell, robots below the deck at the end. */
  minGap: number;
  holeTicks: number;
  fallen: number[];
  /** Times when no robot moved for 20 s (seconds each lasted), and the longest any single robot stood. */
  deadlocks: number[];
  stuckAtEnd: boolean;
  longestStandstill: number;
  standstillBy: string;
  heldMax: number;
  msMean: number;
  msP95: number;
  msMax: number;
  hash: number;
}

export interface GridRun {
  run: Started;
  out(node: string, port: string): unknown;
  robot(k: number): EntityView;
}

export function startGrid(board: Board): GridRun {
  const problems = validateCircuits(board);
  if (problems.length > 0) throw new Error(`circuits do not validate: ${JSON.stringify(problems)}`);
  const run = start(runnableGraph(board), board.mode);
  return {
    run,
    out: (node, port) => run.rt.getOutput(node, port),
    robot: (k) => run.world.entities().find((e) => e.ownerNodeId === `xe-${k}/than`)!,
  };
}

const BOX_HALF = CATCH.inner / 2 + 0.02;

function whereIs(e: EntityView): Where {
  const { x, y, z } = e.position;
  if (y < CATCH.wallH + 0.1) {
    for (const r of ROUTES) {
      const at = catchPlace(r.code);
      if (Math.abs(x - at.x) <= BOX_HALF && Math.abs(z - at.z) <= BOX_HALF) return `box${r.code}`;
    }
    return y < 0.4 ? 'ground' : 'air';
  }
  if (y < GRID.top - 0.05) return 'air';
  if (x < -GRID.pitch / 2) return 'table';
  if (y <= GRID.top + 0.21) return 'deck';
  if (y >= GRID.top + 0.4) return x < -0.4 ? 'table' : 'tray';
  return 'air';
}

export interface GridRunOptions {
  each?: (t: number, g: GridRun) => void;
}

export function runGrid(board: Board, seconds: number, opts: GridRunOptions = {}): GridResult {
  const g = startGrid(board);
  const { run, out } = g;
  const ticks = Math.round(seconds / TICK_DT);
  const ms = new Float64Array(ticks);
  const nums = (f: (k: number) => unknown, list: readonly number[]): number[] => [0, ...list.map((k) => Number(f(k)))];
  const res: GridResult = {
    seconds, made: 0, alive: 0, maxAlive: 0, goneRight: 0, goneWrong: 0, goneElsewhere: 0, truth: ROUTE_CODES.map(() => 0), counts: [], wrongs: [], shownTotal: 0, shownWrong: 0, shownOnDeck: 0,
    onDeck: [], onGround: [], loads: [], tips: [], perMinute: 0, minGap: Infinity, holeTicks: 0, fallen: [], deadlocks: [], stuckAtEnd: false, longestStandstill: 0, standstillBy: '', heldMax: 0,
    msMean: 0, msP95: 0, msMax: 0, hash: 2166136261,
  };
  res.truth = [0, ...ROUTE_CODES.map(() => 0)];
  const cartons = new Map<string, Carton>();
  const onDeck = new Set<string>();
  const onGround = new Set<string>();
  const anchor = ROBOTS.map((k) => g.robot(k)).map((v) => ({ x: v.position.x, z: v.position.z, h: v.robot!.heading, since: 0 }));
  let allStillSince = 0;
  for (let i = 0; i < ticks; i++) {
    const t0 = performance.now();
    run.tick();
    ms[i] = performance.now() - t0;
    const t = (i + 1) * TICK_DT;
    for (const s of [1, 2]) if (out(`tram-${s}/tao-kien`, 'spawned') === true) res.made += 1;
    // --- cartons
    const items = run.items();
    const seen = new Set<string>();
    for (const e of items) {
      seen.add(e.id);
      let c = cartons.get(e.id);
      if (!c) {
        c = { code: splitLookCode(e.look ?? '').code, where: 'table', deckTicks: 0, carried: false };
        cartons.set(e.id, c);
      }
      c.where = whereIs(e);
      if (c.where === 'tray') c.carried = true;
      c.deckTicks = c.where === 'deck' ? c.deckTicks + 1 : 0;
      if (c.deckTicks > 60) onDeck.add(e.id);
      if (c.where === 'ground') onGround.add(e.id);
    }
    for (const [id, c] of cartons) {
      if (seen.has(id)) continue;
      cartons.delete(id);
      if (c.where === `box${c.code}`) {
        res.goneRight += 1;
        res.truth[c.code]! += 1;
      } else if (c.where.startsWith('box')) res.goneWrong += 1;
      else res.goneElsewhere += 1;
    }
    res.maxAlive = Math.max(res.maxAlive, items.length);
    // --- robots
    const views = ROBOTS.map((k) => g.robot(k));
    res.hash = stateHash(res.hash, views);
    if (i % 6 === 0) res.hash = stateHash(res.hash, items);
    for (let a = 0; a < views.length; a++) for (let b = a + 1; b < views.length; b++) res.minGap = Math.min(res.minGap, -overlapDepth(views[a]!, views[b]!));
    let anyMoved = false;
    views.forEach((v, n) => {
      const a = anchor[n]!;
      const h = v.robot!.heading;
      if (Math.hypot(v.position.x - a.x, v.position.z - a.z) > 0.05 || Math.abs(h - a.h) > (5 * Math.PI) / 180) {
        anchor[n] = { x: v.position.x, z: v.position.z, h, since: t };
        anyMoved = true;
      } else if (t - a.since > res.longestStandstill) {
        res.longestStandstill = t - a.since;
        res.standstillBy = `xe-${n + 1} until ${t.toFixed(0)} s`;
      }
      if (!isLaneCell(Math.round(v.position.z / GRID.pitch), Math.round(v.position.x / GRID.pitch))) res.holeTicks += 1;
    });
    if (anyMoved) {
      if (t - allStillSince >= 20) res.deadlocks.push(t - allStillSince);
      allStillSince = t;
    }
    res.heldMax = Math.max(res.heldMax, Number(out('giu-o', 'held')));
    opts.each?.(t, g);
  }
  if (seconds - allStillSince >= 20) {
    res.deadlocks.push(seconds - allStillSince);
    res.stuckAtEnd = true;
  }
  res.alive = run.items().length;
  res.onDeck = [...onDeck];
  res.onGround = [...onGround];
  res.counts = nums((k) => out(`o-${k}/dem`, 'value'), ROUTE_CODES);
  res.wrongs = nums((k) => out(`o-${k}/dem-sai`, 'value'), ROUTE_CODES);
  res.shownTotal = Number(out('tong-kien/cong-8', 'out'));
  res.shownWrong = Number(out('tong-sai/cong-8', 'out'));
  res.shownOnDeck = Number(out('dem-roi', 'value'));
  res.loads = nums((s) => out(`tram-${s}/dem-nap`, 'value'), [1, 2]);
  res.tips = nums((k) => out(`xe-${k}/dem-do`, 'value'), ROBOTS);
  res.perMinute = (res.goneRight + res.goneWrong) / (seconds / 60);
  res.fallen = ROBOTS.filter((k) => g.robot(k).position.y < GRID.top);
  const sorted = Array.from(ms).sort((a, b) => a - b);
  res.msMean = sorted.reduce((a, b) => a + b, 0) / ticks;
  res.msP95 = sorted[Math.floor(ticks * 0.95)]!;
  res.msMax = sorted[ticks - 1]!;
  run.dispose();
  return res;
}

export function gridLine(name: string, x: GridResult): string {
  const mm = (v: number): string => (v * 1000).toFixed(0);
  return [
    `${name} (${x.seconds} s): made ${x.made}, in own box ${x.goneRight}, in another box ${x.goneWrong}, taken back elsewhere ${x.goneElsewhere}, alive ${x.alive} (max ${x.maxAlive}) = ${x.perMinute.toFixed(2)} sorted/min`,
    `  counters ${x.counts.slice(1).join('/')} (truth ${x.truth.slice(1).join('/')}), wrong ${x.wrongs.slice(1).join('/')}; shown total ${x.shownTotal}, wrong ${x.shownWrong}, on deck ${x.shownOnDeck}`,
    `  on the deck floor > 1 s: ${x.onDeck.length}, on the ground outside a box: ${x.onGround.length}; loads ${x.loads.slice(1).join('/')}, tips ${x.tips.slice(1).join('/')}`,
    `  min gap ${mm(x.minGap)} mm, middle in a hole cell ${x.holeTicks} ticks, fallen [${x.fallen.join(',')}], deadlocks ${x.deadlocks.length}${x.deadlocks.length ? ` [${x.deadlocks.map((d) => d.toFixed(0)).join(', ')} s]${x.stuckAtEnd ? ' STUCK AT END' : ''}` : ''}, longest standstill ${x.longestStandstill.toFixed(1)} s (${x.standstillBy}), held max ${x.heldMax}`,
    `  ms/tick mean ${x.msMean.toFixed(3)} p95 ${x.msP95.toFixed(3)} max ${x.msMax.toFixed(1)}, hash ${x.hash.toString(16)}`,
  ].join('\n');
}
