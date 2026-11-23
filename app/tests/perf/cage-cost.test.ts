import { Session } from 'node:inspector';
import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { FLOOR } from '../helpers/nav-rig';
import { holeDeck } from '../world/deck-rig';
import { CAGE, FACTORY_CARTON, MASSES, f3, seeded } from './cage-rig';
import { trayFleet } from './many-machines';

/**
 * What one tick costs with many cartons lying in cages: a measuring tool like `tick-cost`. The times depend on what else the
 * machine is doing, so it only runs when asked and asserts no time; it does assert that the board measured is the board meant
 * (every carton lies in a cage, and lies still, while the clock runs).
 *
 *   VITE_CAGE_COST="0,60,100,154" npx vitest run tests/perf/cage-cost --testTimeout 3000000 --silent=false
 *   VITE_CAGE_COST_RUNS=3 repeats every board (default 3).
 *   VITE_CAGE_COST_PROFILE=154 prints instead where the time of the timed 20 s goes on the board without robots.
 *
 * The board: a ground floor, a deck at 2.6 m with 3 x 3 drop holes (16 plain blocks), 21 open-top cages of five plain blocks
 * each (9 under the holes, 12 in three groups of four as on three trucks), and N cartons (0.32 x 0.26 x 0.28 m, 1 / 2 / 5 kg)
 * let fall into the cages in equal shares; "Vật lý thật" on. Twice: the cages alone, and with twelve small tray robots driving
 * on the same floor (each with a tilt tray, sensors and one carton of its own). The cartons get 12 s to come to rest, then 20 s
 * are timed.
 */
const plan: string = (import.meta.env.VITE_CAGE_COST as string | undefined) ?? '';
const RUNS = Number(import.meta.env.VITE_CAGE_COST_RUNS ?? 3);
const PROFILE: string = (import.meta.env.VITE_CAGE_COST_PROFILE as string | undefined) ?? '';
const SETTLE_S = 12;
const TIMED_S = 20;
const INSIDE = 1.0;
/** Where the middle of the deck is: beside the rows the robots drive along. */
const AT = { x: 0, z: 22 };
const PITCH = 2.5;

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

interface Spot {
  x: number;
  z: number;
}

function cageSpots(): Spot[] {
  const out: Spot[] = [];
  for (const dz of [-PITCH, 0, PITCH]) for (const dx of [-PITCH, 0, PITCH]) out.push({ x: AT.x + dx, z: AT.z + dz });
  for (const group of [-1, 0, 1]) for (const dx of [0, 1.3]) for (const dz of [0, 1.3]) out.push({ x: AT.x + 8 + dx, z: AT.z + group * 3.2 + dz - 0.65 });
  return out;
}

function cageNodes(k: number, at: Spot): NodeSpec[] {
  const t = CAGE.thick;
  const floorTop = CAGE.clearance + t;
  const outer = INSIDE + 2 * t;
  const wy = floorTop + CAGE.wall / 2;
  const reach = INSIDE / 2 + t / 2;
  const part = (name: string, x: number, y: number, z: number, sx: number, sy: number, sz: number): NodeSpec => [`cage${k}-${name}`, 'block', { position: { x: at.x + x, y, z: at.z + z }, size: { x: sx, y: sy, z: sz } }];
  return [
    part('floor', 0, CAGE.clearance + t / 2, 0, outer, t, outer),
    part('w1', -reach, wy, 0, t, CAGE.wall, outer),
    part('w2', reach, wy, 0, t, CAGE.wall, outer),
    part('w3', 0, wy, -reach, INSIDE, CAGE.wall, t),
    part('w4', 0, wy, reach, INSIDE, CAGE.wall, t),
  ];
}

function board(cartons: number, robots: number): { nodes: NodeSpec[]; wires: WireSpec[]; spots: Spot[] } {
  const fleet = robots > 0 ? trayFleet(robots) : { nodes: [FLOOR], wires: [] };
  const spots = cageSpots();
  const nodes: NodeSpec[] = [...fleet.nodes];
  const holes = [-PITCH, 0, PITCH];
  for (const [id, kind, params] of holeDeck(2.6, 5, holes, holes, 0.94)) {
    const p = params as { position: { x: number; y: number; z: number } };
    nodes.push([id, kind, { ...params, position: { x: p.position.x + AT.x, y: p.position.y, z: p.position.z + AT.z } }]);
  }
  spots.forEach((s, k) => nodes.push(...cageNodes(k, s)));
  const rnd = seeded(11);
  const stacked = spots.map(() => 0);
  for (let n = 0; n < cartons; n++) {
    const k = n % spots.length;
    const s = spots[k]!;
    const y = CAGE.clearance + CAGE.thick + 0.25 + stacked[k]! * 0.4;
    stacked[k]!++;
    nodes.push([`carton${n}`, 'item', { shape: 'crate', position: { x: s.x + (rnd() - 0.5) * 0.4, y, z: s.z + (rnd() - 0.5) * 0.4 }, size: { ...FACTORY_CARTON }, mass: MASSES[n % MASSES.length]! }]);
  }
  return { nodes, wires: fleet.wires, spots };
}

interface Timed {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  worst: number;
  entities: number;
  inCages: number;
  /** Cartons in a cage that moved more than 1 cm while the clock ran, and the furthest any of them moved (m). */
  moved: number;
  drift: number;
}

function timeBoard(cartons: number, robots: number, during: (ticks: () => void) => void = (ticks) => ticks()): Timed {
  const b = board(cartons, robots);
  const r = rig(b.nodes, b.wires, '3d', false, true, rapier);
  for (let k = 0; k < Math.round(SETTLE_S / TICK_DT); k++) r.tick();
  const mine = () => r.world.entities().filter((e) => e.kind === 'item' && e.ownerNodeId.startsWith('carton'));
  const half = INSIDE / 2;
  const inCage = (p: { x: number; y: number; z: number }): boolean => p.y > CAGE.clearance && p.y < CAGE.clearance + CAGE.thick + CAGE.wall && b.spots.some((s) => Math.abs(p.x - s.x) < half && Math.abs(p.z - s.z) < half);
  const before = new Map(mine().map((e) => [e.id, e.position]));
  const ms: number[] = [];
  during(() => {
    for (let k = 0; k < Math.round(TIMED_S / TICK_DT); k++) {
      const a = performance.now();
      r.tick();
      ms.push(performance.now() - a);
    }
  });
  const after = mine();
  let drift = 0;
  let moved = 0;
  let inCages = 0;
  for (const e of after) {
    if (!inCage(e.position)) continue;
    inCages++;
    const p = before.get(e.id)!;
    const d = Math.hypot(e.position.x - p.x, e.position.y - p.y, e.position.z - p.z);
    if (d > 0.01) moved++;
    drift = Math.max(drift, d);
  }
  const entities = r.world.entities().length;
  r.world.dispose?.();
  const sorted = [...ms].sort((x, y) => x - y);
  const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
  return { mean: ms.reduce((x, y) => x + y, 0) / ms.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), worst: sorted[sorted.length - 1]!, entities, inCages, moved, drift };
}

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
}

/** Self time per function over the timed stretch of one board, from the sampling profiler of the test process. */
function profileBoard(cartons: number): void {
  const session = new Session();
  session.connect();
  const done = (): void => undefined;
  session.post('Profiler.enable', undefined, done);
  session.post('Profiler.setSamplingInterval', { interval: 200 }, done);
  timeBoard(cartons, 0, (ticks) => {
    session.post('Profiler.start', undefined, done);
    ticks();
    session.post('Profiler.stop', undefined, (_err: unknown, res: unknown) => {
      const p = (res as unknown as { profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] } }).profile;
      const byId = new Map(p.nodes.map((x) => [x.id, x]));
      const self = new Map<string, number>();
      let all = 0;
      p.samples.forEach((id, k) => {
        const f = byId.get(id)!.callFrame;
        const file = f.url.replace(/\\/g, '/').replace(/^.*\/app\//, '').replace(/\?.*$/, '') || '(native)';
        const key = `${f.functionName || '(anonymous)'} @ ${file}:${f.lineNumber + 1}`;
        const ms = (p.timeDeltas[k] ?? 0) / 1000;
        all += ms;
        self.set(key, (self.get(key) ?? 0) + ms);
      });
      const rows = [...self].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([key, ms]) => `| ${ms.toFixed(0)} | ${((ms / all) * 100).toFixed(1)} % | ${key} |`);
      console.log([`### where the time goes, ${cartons} cartons, cages + deck (${f3(all / Math.round(TIMED_S / TICK_DT))} ms per tick sampled)`, '| self ms | share | function @ file:line |', '|---|---|---|', ...rows].join('\n'));
    });
  });
  session.disconnect();
}

describe.skipIf(plan === '' && PROFILE === '')('cost of one tick with cartons at rest in 21 cages (measuring tool, runs only when asked)', () => {
  it('prints one row per board and run', () => {
    if (PROFILE !== '') {
      timeBoard(20, 0);
      profileBoard(Number(PROFILE));
      return;
    }
    const sizes = plan.split(',').map(Number).filter((n) => Number.isFinite(n) && n >= 0);
    // Warm-up so the first measured board is not the one that pays for the JIT.
    timeBoard(20, 2);
    const rows = ['| board | cartons | run | entities | cartons in cages | mean ms/tick | p50 | p95 | p99 | worst | cartons that moved over 1 cm | furthest one moved (mm) |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
    for (const robots of [0, 12]) {
      for (const n of sizes) {
        for (let run = 1; run <= RUNS; run++) {
          const t = timeBoard(n, robots);
          const row = `| ${robots > 0 ? `cages + deck + ${robots} tray robots` : 'cages + deck'} | ${n} | ${run} | ${t.entities} | ${t.inCages}/${n} | ${f3(t.mean)} | ${f3(t.p50)} | ${f3(t.p95)} | ${f3(t.p99)} | ${f3(t.worst)} | ${t.moved} | ${f3(t.drift * 1000)} |`;
          rows.push(row);
          console.log(row);
          // The board that was timed is the board that was meant: at most one carton in twenty missed its cage or was still on the move.
          expect(t.inCages).toBeGreaterThanOrEqual(Math.floor(n * 0.95));
          expect(t.moved).toBeLessThanOrEqual(Math.ceil(n * 0.05));
        }
      }
    }
    console.log(rows.join('\n'));
  });
});
