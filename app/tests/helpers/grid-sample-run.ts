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

/** True when the environment variable is set for this run (read when the test runs, e.g. `GRID_900=1 npx vitest run ...`). */
export const envFlag = (name: string): boolean => Boolean((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[name]);

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
  /** Cartons lying in a catch box when the run ends (counted, not yet taken back): in the box of their own route, in another one. */
  lyingRight: number;
  lyingWrong: number;
  /** Per route (index 1..9): cartons that reached that route's box (taken back from it or lying in it at the end), by the measurement above. */
  truth: number[];
  /** Cartons that reached the box of their own route / another route's box. */
  sortedRight: number;
  sortedWrong: number;
  /** Robots that left the cell they started on. */
  moved: number[];
  /** Cartons that lay on a robot's tray at some moment. */
  carried: number;
  /** Hand-overs: how far from the middle of the tray the carton lay when the robot took it (m, worst case along and across the chassis), and how many were measured. */
  handOvers: number;
  handOverAlong: number;
  handOverAcross: number;
  /** How far along the chassis a taken carton ever lay from the middle of the tray while the tray was flat (m): what the starts and stops of the drive shift it. */
  carriedSlip: number;
  /** Seconds a robot stood on its stop cell per tip, from "standing on the middle" to "tray flat again": mean and longest. */
  tipSecondsMean: number;
  tipSecondsMax: number;
  /** What the counters of the catch boxes say (index 1..9), and their "wrong route" counters. */
  counts: number[];
  wrongs: number[];
  /** The read-outs on the screen. */
  shownTotal: number;
  shownWrong: number;
  shownOnDeck: number;
  /** What the screen shows at the end, by the label of each "Hiện số" card; and whether the board's "Máy quay" card holds the camera. */
  hud: Record<string, number>;
  /** The largest number each of those cards showed at any moment of the run. */
  hudMax: Record<string, number>;
  cameraHeld: boolean;
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
  /** Ticks on which a chassis outline reached over the opening of a hole, and the lowest any chassis middle ever was (m). */
  overHoleTicks: number;
  lowest: number;
  /** How deep a chassis outline ever was inside a solid thing that stands still (deck plate, post, table, belt, wall; m), and inside what. Standing on a plate reads about 0. */
  deepestInSolid: number;
  inSolidWith: string;
  /** Times when no robot moved for 20 s (seconds each lasted), and the longest any single robot stood. */
  deadlocks: number[];
  stuckAtEnd: boolean;
  longestStandstill: number;
  standstillBy: string;
  heldMax: number;
  msMean: number;
  msP50: number;
  msP95: number;
  msP99: number;
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
  if (y <= CATCH.wallH) {
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
    seconds, made: 0, alive: 0, maxAlive: 0, goneRight: 0, goneWrong: 0, goneElsewhere: 0, lyingRight: 0, lyingWrong: 0, truth: [], sortedRight: 0, sortedWrong: 0, moved: [], carried: 0, handOvers: 0, handOverAlong: 0, handOverAcross: 0, carriedSlip: 0, tipSecondsMean: 0, tipSecondsMax: 0, counts: [], wrongs: [], shownTotal: 0, shownWrong: 0, shownOnDeck: 0, hud: {}, hudMax: {}, cameraHeld: false,
    onDeck: [], onGround: [], loads: [], tips: [], perMinute: 0, minGap: Infinity, holeTicks: 0, fallen: [], overHoleTicks: 0, lowest: Infinity, deepestInSolid: -Infinity, inSolidWith: '', deadlocks: [], stuckAtEnd: false, longestStandstill: 0, standstillBy: '', heldMax: 0,
    msMean: 0, msP50: 0, msP95: 0, msP99: 0, msMax: 0, hash: 2166136261,
  };
  res.truth = [0, ...ROUTE_CODES.map(() => 0)];
  const cartons = new Map<string, Carton>();
  const onDeck = new Set<string>();
  const onGround = new Set<string>();
  const anchor = ROBOTS.map((k) => g.robot(k)).map((v) => ({ x: v.position.x, z: v.position.z, h: v.robot!.heading, since: 0 }));
  const taken = ROBOTS.map(() => false);
  const tipFrom = ROBOTS.map(() => -1);
  let tipSum = 0;
  let tipCount = 0;
  const starts = ROBOTS.map((k) => ({ x: g.robot(k).position.x, z: g.robot(k).position.z }));
  let allStillSince = 0;
  // The openings of the nine holes, as boxes through the deck's face.
  const holes = ROUTES.map((r) => ({ position: { x: r.hole[1] * GRID.pitch, y: GRID.top, z: r.hole[0] * GRID.pitch }, size: { x: GRID.hole, y: 2, z: GRID.hole } }) as EntityView);
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
      if (c.where === 'tray' && !c.carried) {
        c.carried = true;
        res.carried += 1;
      }
      c.deckTicks = c.where === 'deck' ? c.deckTicks + 1 : 0;
      if (c.deckTicks > 60) onDeck.add(e.id);
      if (c.where === 'ground') onGround.add(e.id);
    }
    for (const [id, c] of cartons) {
      if (seen.has(id)) continue;
      cartons.delete(id);
      if (c.where === `box${c.code}`) res.goneRight += 1;
      else if (c.where.startsWith('box')) res.goneWrong += 1;
      else res.goneElsewhere += 1;
      if (c.where.startsWith('box')) res.truth[Number(c.where.slice(3))]! += 1;
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
      if (holes.some((hole) => overlapDepth(v, hole) > 0)) res.overHoleTicks += 1;
      res.lowest = Math.min(res.lowest, v.position.y);
      for (const box of run.world.solidBoxes()) {
        const depth = overlapDepth(v, box as EntityView);
        if (depth > res.deepestInSolid) {
          res.deepestInSolid = depth;
          res.inSolidWith = `xe-${n + 1} at ${t.toFixed(1)} s in a box ${box.size.x.toFixed(2)} x ${box.size.y.toFixed(2)} x ${box.size.z.toFixed(2)} at ${box.position.x.toFixed(2)}, ${box.position.y.toFixed(2)}, ${box.position.z.toFixed(2)}`;
        }
      }
      // The moment the robot takes a carton as loaded: where does it lie on the tray?
      const k = n + 1;
      const now = out(`xe-${k}/cho-yen`, 'done') === true;
      if (now && !taken[n]) {
        const carton = items.find((e) => e.id === out(`xe-${k}/tren-khay`, 'first'));
        if (carton) {
          const dx = carton.position.x - v.position.x;
          const dz = carton.position.z - v.position.z;
          res.handOvers += 1;
          res.handOverAlong = Math.max(res.handOverAlong, Math.abs(dx * Math.cos(h) + dz * Math.sin(h)));
          res.handOverAcross = Math.max(res.handOverAcross, Math.abs(-dx * Math.sin(h) + dz * Math.cos(h)));
        }
      }
      if (now && out(`xe-${k}/lenh-do`, 'out') !== true) {
        const carton = items.find((e) => e.id === out(`xe-${k}/tren-khay`, 'first'));
        if (carton) res.carriedSlip = Math.max(res.carriedSlip, Math.abs((carton.position.x - v.position.x) * Math.cos(h) + (carton.position.z - v.position.z) * Math.sin(h)));
      }
      taken[n] = now;
      // A tip: from the tick the robot stands on its goal with a taken carton until its tray is flat and empty again.
      const atGoal = out(`xe-${k}/toi-noi`, 'out') === true;
      if (atGoal && tipFrom[n]! < 0) tipFrom[n] = t;
      if (!atGoal && tipFrom[n]! >= 0 && out(`xe-${k}/chay`, 'out') === true) {
        tipSum += t - tipFrom[n]!;
        tipCount += 1;
        res.tipSecondsMax = Math.max(res.tipSecondsMax, t - tipFrom[n]!);
        tipFrom[n] = -1;
      }
    });
    if (anyMoved) {
      if (t - allStillSince >= 20) res.deadlocks.push(t - allStillSince);
      allStillSince = t;
    }
    res.heldMax = Math.max(res.heldMax, Number(out('giu-o', 'held')));
    for (const h of run.world.hudItems()) res.hudMax[h.label] = Math.max(res.hudMax[h.label] ?? 0, Number(h.value));
    opts.each?.(t, g);
  }
  if (seconds - allStillSince >= 20) {
    res.deadlocks.push(seconds - allStillSince);
    res.stuckAtEnd = true;
  }
  res.alive = run.items().length;
  for (const c of cartons.values()) {
    if (!c.where.startsWith('box')) continue;
    if (c.where === `box${c.code}`) res.lyingRight += 1;
    else res.lyingWrong += 1;
    res.truth[Number(c.where.slice(3))]! += 1;
  }
  res.sortedRight = res.goneRight + res.lyingRight;
  res.sortedWrong = res.goneWrong + res.lyingWrong;
  res.moved = ROBOTS.filter((k) => Math.hypot(g.robot(k).position.x - starts[k - 1]!.x, g.robot(k).position.z - starts[k - 1]!.z) > GRID.pitch / 2 || Number(out(`xe-${k}/dem-do`, 'value')) > 0);
  res.onDeck = [...onDeck];
  res.onGround = [...onGround];
  res.counts = nums((k) => out(`o-${k}/dem`, 'value'), ROUTE_CODES);
  res.wrongs = nums((k) => out(`o-${k}/dem-sai`, 'value'), ROUTE_CODES);
  res.shownTotal = Number(out('tong-kien/cong-8', 'out'));
  res.shownWrong = Number(out('tong-sai/cong-8', 'out'));
  res.shownOnDeck = Number(out('dem-roi', 'value'));
  res.hud = Object.fromEntries(run.world.hudItems().map((h) => [h.label, Number(h.value)]));
  res.cameraHeld = run.world.cameraCommand() !== null;
  res.loads = nums((s) => out(`tram-${s}/dem-nap`, 'value'), [1, 2]);
  res.tips = nums((k) => out(`xe-${k}/dem-do`, 'value'), ROBOTS);
  res.perMinute = (res.sortedRight + res.sortedWrong) / (seconds / 60);
  res.tipSecondsMean = tipCount > 0 ? tipSum / tipCount : 0;
  res.fallen = ROBOTS.filter((k) => g.robot(k).position.y < GRID.top);
  const sorted = Array.from(ms).sort((a, b) => a - b);
  res.msMean = sorted.reduce((a, b) => a + b, 0) / ticks;
  res.msP50 = sorted[Math.floor(ticks * 0.5)]!;
  res.msP95 = sorted[Math.floor(ticks * 0.95)]!;
  res.msP99 = sorted[Math.floor(ticks * 0.99)]!;
  res.msMax = sorted[ticks - 1]!;
  run.dispose();
  return res;
}

export function gridLine(name: string, x: GridResult): string {
  const mm = (v: number): string => (v * 1000).toFixed(0);
  return [
    `${name} (${x.seconds} s): made ${x.made}, reached own box ${x.sortedRight}, another box ${x.sortedWrong}, taken back from a box ${x.goneRight + x.goneWrong} / from elsewhere ${x.goneElsewhere}, alive ${x.alive} (max ${x.maxAlive}) = ${x.perMinute.toFixed(2)} sorted/min`,
    `  counters ${x.counts.slice(1).join('/')} (truth ${x.truth.slice(1).join('/')}), wrong ${x.wrongs.slice(1).join('/')}; shown total ${x.shownTotal}, wrong ${x.shownWrong}, on deck ${x.shownOnDeck}`,
    `  on the deck floor > 1 s: ${x.onDeck.length}, on the ground outside a box: ${x.onGround.length}; loads ${x.loads.slice(1).join('/')}, tips ${x.tips.slice(1).join('/')}`,
    `  hand-overs ${x.handOvers}: carton off the tray middle at most ${mm(x.handOverAlong)} mm along / ${mm(x.handOverAcross)} mm across, while carried at most ${mm(x.carriedSlip)} mm along; a tip takes ${x.tipSecondsMean.toFixed(1)} s (longest ${x.tipSecondsMax.toFixed(1)} s)`,
    `  min gap ${mm(x.minGap)} mm, middle in a hole cell ${x.holeTicks} ticks, fallen [${x.fallen.join(',')}], deadlocks ${x.deadlocks.length}${x.deadlocks.length ? ` [${x.deadlocks.map((d) => d.toFixed(0)).join(', ')} s]${x.stuckAtEnd ? ' STUCK AT END' : ''}` : ''}, longest standstill ${x.longestStandstill.toFixed(1)} s (${x.standstillBy}), held max ${x.heldMax}`,
    `  chassis over a hole opening ${x.overHoleTicks} ticks, lowest chassis middle ${x.lowest.toFixed(3)} m, deepest in a solid ${mm(x.deepestInSolid)} mm (${x.inSolidWith})`,
    `  ms/tick mean ${x.msMean.toFixed(3)} p50 ${x.msP50.toFixed(3)} p95 ${x.msP95.toFixed(3)} p99 ${x.msP99.toFixed(3)} max ${x.msMax.toFixed(1)}, hash ${x.hash.toString(16)}`,
  ].join('\n');
}
