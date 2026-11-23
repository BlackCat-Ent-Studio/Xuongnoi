import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { TRAFFIC_COLORS } from '../../src/engine/block-styles';
import { TICK_DT, type Board, type EntityView } from '../../src/engine/types';
import { splitLookCode } from '../../src/engine/parcel-code';
import { listSamples } from '../../src/io';
import { CAGE, COVER, GRID, ROUTES, isLaneCell } from '../../src/samples/sorting-grid-plan';
import { LAMP_ROWS, catchPlace } from '../../src/samples/sorting-grid-floor';
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

type Where = 'table' | 'tray' | 'deck' | 'air' | 'falling' | 'ground' | `box${number}`;

interface Carton {
  code: number;
  where: Where;
  /** Ticks in a row it has lain on the deck floor. */
  deckTicks: number;
  /** Ticks in a row it has been below the deck and in no cage. */
  fallTicks: number;
  /** It was on a robot's tray at some moment. */
  carried: boolean;
  /** The hole it was last seen falling through (0 = none yet), and the cage it was first seen in (0 = none yet). */
  shaft: number;
  cage: number;
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
  /** Per route (index 1..9): cartons that came to lie in that route's cage, by the measurement above. */
  truth: number[];
  /** Per route (index 1..9): cartons lying in that cage when the run ends, by the measurement / by the cage's own "Số vật bên trong"; and the most a cage ever held. */
  inCage: number[];
  cageSays: number[];
  mostInCage: number;
  /** Cartons that came to lie in another cage than the one under the hole they fell through / that stayed below the deck in no cage for more than 3 s (ids). */
  strayed: string[];
  hung: string[];
  /** Cartons that lay over the opening of a hole on the deck's face (on a cover; ids). */
  onCover: string[];
  /** Ticks on which a robot's tray was told to tip while the hole of its carton was locked. */
  tipsWhileLocked: number;
  /** Ticks on which "made" was not "alive + taken back". */
  lostTicks: number;
  /** Ticks on which a lamp did not show the colour for its cage's count / the plate over a hole or the parked plate did not follow the lock / a cage's count was not what lay in it one tick earlier. */
  lampWrongTicks: number;
  coverWrongTicks: number;
  countWrongTicks: number;
  /** Times a lock opened while cartons still lay in its cage. */
  lockDropsFull: number;
  /** Per route (index 1..9): times the hole was locked; and the most holes locked at once. */
  locks: number[];
  mostLocked: number;
  /** Seconds each hole (index 1..9) had been locked when the run ended (0 = open). */
  lockedAtEnd: number[];
  /** Presses of "Đổi lồng" by the script (the times), and how long the longest swap took from the press to the last cage empty. */
  presses: number[];
  swapSecondsMax: number;
  /** Waits beside a locked hole: how many, the longest one, the laps each robot (index 1..6) started, and the longest a robot was kept from tipping (from its first wait to the tip). */
  waits: number;
  waitSecondsMax: number;
  laps: number[];
  heldUpSecondsMax: number;
  /** Robots carrying a carton for a locked hole when the run ends. */
  heldUpAtEnd: number[];
  /** Ticks on which a robot waited beside a hole that was not locked / a hole was locked over an empty cage. */
  waitTicksOpen: number;
  lockedEmptyTicks: number;
  /** A swap the script started was still running when the run ended. */
  swapUnfinished: boolean;
  /** "Sức chứa" of the cages on the board that was played. */
  capacity: number;
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

const CAGE_HALF = CAGE.inside / 2;
const DECK_UNDER = GRID.top - 0.2;

/** The hole whose middle is within `half` of (x, z), or 0. */
function holeAt(x: number, z: number, half: number): number {
  for (const r of ROUTES) {
    const at = catchPlace(r.code);
    if (Math.abs(x - at.x) < half && Math.abs(z - at.z) < half) return r.code;
  }
  return 0;
}

/** In a cage = the middle between the walls, above the floor plate, below the rim (what the cage piece itself counts). */
function whereIs(e: EntityView): Where {
  const { x, y, z } = e.position;
  if (y < DECK_UNDER) {
    const k = holeAt(x, z, CAGE_HALF);
    if (k > 0 && y > CAGE.clearance && y < CAGE.rimY) return `box${k}`;
    return y < 0.3 ? 'ground' : 'falling';
  }
  if (y < GRID.top - 0.05) return 'falling';
  if (x < -GRID.pitch / 2) return 'table';
  if (y <= GRID.top + 0.21) return 'deck';
  if (y >= GRID.top + 0.4) return x < -0.4 ? 'table' : 'tray';
  return 'air';
}

export interface GridRunOptions {
  each?: (t: number, g: GridRun) => void;
  /** "Đổi lồng" is pressed once whenever a hole has been locked for this many seconds (and no swap is running). Left out = never pressed. */
  pressAfterLockedS?: number;
}

export const SWAP_BUTTON_CARD = 'nut-doi';
const lampColor = (count: number): string => TRAFFIC_COLORS[LAMP_ROWS[Math.min(LAMP_ROWS.length, Math.max(1, count)) - 1]! - 1]!;

export function runGrid(board: Board, seconds: number, opts: GridRunOptions = {}): GridResult {
  const g = startGrid(board);
  const { run, out } = g;
  const ticks = Math.round(seconds / TICK_DT);
  const ms = new Float64Array(ticks);
  const nums = (f: (k: number) => unknown, list: readonly number[]): number[] => [0, ...list.map((k) => Number(f(k)))];
  const res: GridResult = {
    seconds, made: 0, alive: 0, maxAlive: 0, goneRight: 0, goneWrong: 0, goneElsewhere: 0, lyingRight: 0, lyingWrong: 0, truth: [], sortedRight: 0, sortedWrong: 0, moved: [], carried: 0, handOvers: 0, handOverAlong: 0, handOverAcross: 0, carriedSlip: 0, tipSecondsMean: 0, tipSecondsMax: 0, counts: [], wrongs: [], shownTotal: 0, shownWrong: 0, shownOnDeck: 0, hud: {}, hudMax: {}, cameraHeld: false,
    inCage: [], cageSays: [], mostInCage: 0, strayed: [], hung: [], onCover: [], tipsWhileLocked: 0, lostTicks: 0, lampWrongTicks: 0, coverWrongTicks: 0, countWrongTicks: 0, lockDropsFull: 0, locks: [], mostLocked: 0, lockedAtEnd: [], presses: [], swapSecondsMax: 0,
    waits: 0, waitSecondsMax: 0, laps: [], heldUpSecondsMax: 0, heldUpAtEnd: [], waitTicksOpen: 0, lockedEmptyTicks: 0, swapUnfinished: false, capacity: 0,
    onDeck: [], onGround: [], loads: [], tips: [], perMinute: 0, minGap: Infinity, holeTicks: 0, fallen: [], overHoleTicks: 0, lowest: Infinity, deepestInSolid: -Infinity, inSolidWith: '', deadlocks: [], stuckAtEnd: false, longestStandstill: 0, standstillBy: '', heldMax: 0,
    msMean: 0, msP50: 0, msP95: 0, msP99: 0, msMax: 0, hash: 2166136261,
  };
  res.truth = [0, ...ROUTE_CODES.map(() => 0)];
  const cartons = new Map<string, Carton>();
  const onDeck = new Set<string>();
  const onGround = new Set<string>();
  const strayed = new Set<string>();
  const hung = new Set<string>();
  const onCover = new Set<string>();
  let gone = 0;
  res.locks = [0, ...ROUTE_CODES.map(() => 0)];
  res.laps = [0, ...ROBOTS.map(() => 0)];
  const lockedSince = [0, ...ROUTE_CODES.map(() => -1)];
  const layBefore = [0, ...ROUTE_CODES.map(() => 0)];
  const views = (owner: string): EntityView => run.world.entities().find((e) => e.ownerNodeId === owner)!;
  const lamps = [undefined, ...ROUTE_CODES.map((k) => views(`o-${k}/den`).id)];
  const covers = [undefined, ...ROUTE_CODES.map((k) => views(`o-${k}/nap-dong`).id)];
  const parked = [undefined, ...ROUTE_CODES.map((k) => views(`o-${k}/nap-mo`).id)];
  let pressedAt = -1;
  const waitFrom = ROBOTS.map(() => -1);
  const heldFrom = ROBOTS.map(() => -1);
  const lapping = ROBOTS.map(() => false);
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
    const t = (i + 1) * TICK_DT;
    // The script's finger: one press when a hole has been locked long enough.
    const swapping = out('dang-doi', 'on') === true;
    const press = opts.pressAfterLockedS !== undefined && !swapping && lockedSince.some((from, k) => k > 0 && from >= 0 && t - from >= opts.pressAfterLockedS!);
    if (press) {
      res.presses.push(t);
      pressedAt = t;
    }
    const t0 = performance.now();
    run.rt.tick({ keysDown: new Set(), ...(press ? { ui: { clicked: new Set([SWAP_BUTTON_CARD]), held: new Set(), picked: new Set() } } : {}) });
    run.world.step(TICK_DT);
    ms[i] = performance.now() - t0;
    if (pressedAt >= 0 && !press && out('dang-doi', 'on') !== true) {
      res.swapSecondsMax = Math.max(res.swapSecondsMax, t - pressedAt);
      pressedAt = -1;
    }
    for (const s of [1, 2]) if (out(`tram-${s}/tao-kien`, 'spawned') === true) res.made += 1;
    // --- cartons
    const items = run.items();
    const seen = new Set<string>();
    for (const e of items) {
      seen.add(e.id);
      let c = cartons.get(e.id);
      if (!c) {
        c = { code: splitLookCode(e.look ?? '').code, where: 'table', deckTicks: 0, fallTicks: 0, carried: false, shaft: 0, cage: 0 };
        cartons.set(e.id, c);
      }
      c.where = whereIs(e);
      if (c.where === 'falling') {
        const k = holeAt(e.position.x, e.position.z, GRID.hole / 2 + 0.1);
        if (k > 0 && e.position.y > CAGE.rimY) c.shaft = k;
      }
      c.fallTicks = c.where === 'falling' ? c.fallTicks + 1 : 0;
      if (c.fallTicks > 180) hung.add(e.id);
      if (c.where.startsWith('box') && c.cage === 0) {
        c.cage = Number(c.where.slice(3));
        res.truth[c.cage]! += 1;
        if (c.cage === c.code) res.sortedRight += 1;
        else res.sortedWrong += 1;
        if (c.cage !== c.shaft) strayed.add(e.id);
      }

      if (c.where === 'tray' && !c.carried) {
        c.carried = true;
        res.carried += 1;
      }
      c.deckTicks = c.where === 'deck' ? c.deckTicks + 1 : 0;
      if (c.deckTicks > 60) onDeck.add(e.id);
      // Longer than a fall through the opening takes
      if (c.deckTicks > 20 && holeAt(e.position.x, e.position.z, COVER.size.z / 2) > 0) onCover.add(e.id);
      if (c.where === 'ground') onGround.add(e.id);
    }
    for (const [id, c] of cartons) {
      if (seen.has(id)) continue;
      cartons.delete(id);
      gone += 1;
      if (c.where === `box${c.code}`) res.goneRight += 1;
      else if (c.where.startsWith('box')) res.goneWrong += 1;
      else res.goneElsewhere += 1;
    }
    res.maxAlive = Math.max(res.maxAlive, items.length);
    if (res.made !== items.length + gone) res.lostTicks += 1;
    // --- cages, lamps, covers, locks
    const lying = [0, ...ROUTE_CODES.map(() => 0)];
    for (const c of cartons.values()) if (c.where.startsWith('box')) lying[Number(c.where.slice(3))]! += 1;
    let lockedNow = 0;
    for (const k of ROUTE_CODES) {
      const says = Number(out(`o-${k}/long`, 'count'));
      const locked = out(`o-${k}/khoa`, 'on') === true;
      res.mostInCage = Math.max(res.mostInCage, lying[k]!, says);
      // The cage counted before the world moved on: its number is what lay in it one tick earlier.
      if (i > 0 && says !== layBefore[k]) res.countWrongTicks += 1;
      layBefore[k] = lying[k]!;
      if (run.world.getEntity(lamps[k]!)!.color !== lampColor(says)) res.lampWrongTicks += 1;
      if (run.world.getEntity(covers[k]!)!.visible !== locked || run.world.getEntity(parked[k]!)!.visible === locked) res.coverWrongTicks += 1;
      if (locked && lockedSince[k]! < 0) {
        lockedSince[k] = t;
        res.locks[k]! += 1;
      }
      if (!locked && lockedSince[k]! >= 0) {
        lockedSince[k] = -1;
        if (says > 0) res.lockDropsFull += 1;
      }
      if (locked) lockedNow += 1;
      if (locked && says === 0) res.lockedEmptyTicks += 1;
    }
    res.mostLocked = Math.max(res.mostLocked, lockedNow);
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
      // Beside a locked hole: the wait, the lap, and how long this carton is kept from being tipped.
      const tipping = out(`xe-${k}/lenh-do`, 'out') === true;
      const code = Number(out(`xe-${k}/doc-ma`, 'code'));
      if (tipping && code >= 1 && out(`o-${code}/khoa`, 'on') === true) res.tipsWhileLocked += 1;
      const waiting = out(`xe-${k}/cho-lo`, 'out') === true;
      if (waiting && !(code >= 1 && out(`o-${code}/khoa`, 'on') === true)) res.waitTicksOpen += 1;
      if (waiting && waitFrom[n]! < 0) {
        waitFrom[n] = t;
        res.waits += 1;
        if (heldFrom[n]! < 0) heldFrom[n] = t;
      }
      if (!waiting && waitFrom[n]! >= 0) {
        res.waitSecondsMax = Math.max(res.waitSecondsMax, t - waitFrom[n]!);
        waitFrom[n] = -1;
      }
      const lap = out(`xe-${k}/di-vong`, 'on') === true;
      if (lap && !lapping[n]) res.laps[k]! += 1;
      lapping[n] = lap;
      if (tipping && heldFrom[n]! >= 0) {
        res.heldUpSecondsMax = Math.max(res.heldUpSecondsMax, t - heldFrom[n]!);
        heldFrom[n] = -1;
      }
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
  res.inCage = [0, ...ROUTE_CODES.map(() => 0)];
  for (const c of cartons.values()) {
    if (!c.where.startsWith('box')) continue;
    if (c.where === `box${c.code}`) res.lyingRight += 1;
    else res.lyingWrong += 1;
    res.inCage[Number(c.where.slice(3))]! += 1;
  }
  res.cageSays = nums((k) => out(`o-${k}/long`, 'count'), ROUTE_CODES);
  res.lockedAtEnd = lockedSince.map((from, k) => (k > 0 && from >= 0 ? seconds - from : 0));
  res.strayed = [...strayed];
  res.hung = [...hung];
  res.onCover = [...onCover];
  res.heldUpAtEnd = ROBOTS.filter((k) => heldFrom[k - 1]! >= 0);
  res.swapUnfinished = pressedAt >= 0;
  res.capacity = Number(runnableGraph(board).nodes.find((n) => n.id === 'o-1/long')!.params.capacity);
  for (const from of heldFrom) if (from >= 0) res.heldUpSecondsMax = Math.max(res.heldUpSecondsMax, seconds - from);
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
    `${name} (${x.seconds} s): made ${x.made}, reached own cage ${x.sortedRight}, another cage ${x.sortedWrong}, taken back from a cage ${x.goneRight + x.goneWrong} / from elsewhere ${x.goneElsewhere}, alive ${x.alive} (max ${x.maxAlive}) = ${x.perMinute.toFixed(2)} sorted/min`,
    `  counters ${x.counts.slice(1).join('/')} (truth ${x.truth.slice(1).join('/')}), wrong ${x.wrongs.slice(1).join('/')}; shown total ${x.shownTotal}, wrong ${x.shownWrong}, on deck ${x.shownOnDeck}`,
    `  in the cages at the end ${x.inCage.slice(1).join('/')} (the cages say ${x.cageSays.slice(1).join('/')}), most in one cage ${x.mostInCage}; locks ${x.locks.slice(1).join('/')}, most at once ${x.mostLocked}, locked at the end for ${x.lockedAtEnd.slice(1).map((v) => v.toFixed(0)).join('/')} s; presses at ${x.presses.map((v) => v.toFixed(0)).join(', ') || '-'} s, longest swap ${x.swapSecondsMax.toFixed(1)} s`,
    `  waits ${x.waits} (longest ${x.waitSecondsMax.toFixed(1)} s), laps ${x.laps.slice(1).join('/')}, longest kept from tipping ${x.heldUpSecondsMax.toFixed(1)} s, kept at the end [${x.heldUpAtEnd.join(',')}]; tip ticks while locked ${x.tipsWhileLocked}, on a cover ${x.onCover.length}, strayed ${x.strayed.length}, hung ${x.hung.length}, lost ticks ${x.lostTicks}; wrong ticks lamp ${x.lampWrongTicks} / cover ${x.coverWrongTicks} / count ${x.countWrongTicks}, waited at an open hole ${x.waitTicksOpen}, locked over an empty cage ${x.lockedEmptyTicks}, locks opened with cartons inside ${x.lockDropsFull}${x.swapUnfinished ? ', SWAP STILL RUNNING' : ''}`,
    `  on the deck floor > 1 s: ${x.onDeck.length}, on the ground outside a cage: ${x.onGround.length}; loads ${x.loads.slice(1).join('/')}, tips ${x.tips.slice(1).join('/')}`,
    `  hand-overs ${x.handOvers}: carton off the tray middle at most ${mm(x.handOverAlong)} mm along / ${mm(x.handOverAcross)} mm across, while carried at most ${mm(x.carriedSlip)} mm along; a tip takes ${x.tipSecondsMean.toFixed(1)} s (longest ${x.tipSecondsMax.toFixed(1)} s)`,
    `  min gap ${mm(x.minGap)} mm, middle in a hole cell ${x.holeTicks} ticks, fallen [${x.fallen.join(',')}], deadlocks ${x.deadlocks.length}${x.deadlocks.length ? ` [${x.deadlocks.map((d) => d.toFixed(0)).join(', ')} s]${x.stuckAtEnd ? ' STUCK AT END' : ''}` : ''}, longest standstill ${x.longestStandstill.toFixed(1)} s (${x.standstillBy}), held max ${x.heldMax}`,
    `  chassis over a hole opening ${x.overHoleTicks} ticks, lowest chassis middle ${x.lowest.toFixed(3)} m, deepest in a solid ${mm(x.deepestInSolid)} mm (${x.inSolidWith})`,
    `  ms/tick mean ${x.msMean.toFixed(3)} p50 ${x.msP50.toFixed(3)} p95 ${x.msP95.toFixed(3)} p99 ${x.msP99.toFixed(3)} max ${x.msMax.toFixed(1)}, hash ${x.hash.toString(16)}`,
  ].join('\n');
}
