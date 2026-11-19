import { Session } from 'node:inspector';
import { beforeAll, describe, it } from 'vitest';
import { compileGraph } from '../../src/engine/compile';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type World } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { rig } from '../helpers/arm-rig';
import { cloneBoard, trayFleet } from './many-machines';

/**
 * What one tick costs as a board grows: a measuring tool, not a test. It asserts nothing (the numbers depend on what else the
 * machine is doing) and only runs when asked:
 *
 *   VITE_TICK_COST="agv:1,4,8,16 tray:8,16" npx vitest run tests/perf/tick-cost --testTimeout 3000000 --silent=false
 *   VITE_TICK_COST="profile-agv:8" ...   (or profile-tray:16) prints where the time goes instead: the first 20 simulated
 *   seconds, or VITE_TICK_COST_SECONDS of them starting at second VITE_TICK_COST_FROM
 *
 * `agv:N` is N copies of the AGV sample in one flat graph, `tray:N` a fleet of N small tray chassis; 60 simulated seconds each,
 * "Vật lý thật" on. Each row ends with a hash of every entity over the run: the same hash before and after a change to the engine
 * means the big board played the same way.
 */
const plan: string = (import.meta.env.VITE_TICK_COST as string | undefined) ?? '';
const SECONDS = Number(import.meta.env.VITE_TICK_COST_SECONDS ?? 60);
const FROM = Number(import.meta.env.VITE_TICK_COST_FROM ?? 0);

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await loadRapier();
});

interface Run {
  world: World;
  tick: () => void;
  cards: number;
  compileMs: number;
}

function agv(copies: number): Run {
  const base = structuredClone(listAllSamples().find((s) => s.id === 'agv-shuttle')!.board);
  const graph = cloneBoard(base, copies, 14);
  // Compile alone: best of 5 (the first call also pays for the JIT).
  let compileMs = Infinity;
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    compileGraph(graph);
    compileMs = Math.min(compileMs, performance.now() - t);
  }
  const world = createWorld('3d', { ...(worldOptionsForGraph(graph) ?? {}), rapier });
  const rt = createRuntime(graph, world, '3d');
  const input = { keysDown: new Set<string>() };
  return { world, tick: () => (rt.tick(input), world.step(TICK_DT)), cards: graph.nodes.length, compileMs };
}

function tray(n: number): Run {
  const f = trayFleet(n);
  const t = performance.now();
  compileGraph({ nodes: f.nodes.map(([id, kind]) => ({ id, kind, params: {}, pos: { x: 0, y: 0 } })), wires: f.wires.map(([a, ap, b, bp], k) => ({ id: `w${k}`, from: { node: a, port: ap }, to: { node: b, port: bp } })) });
  const compileMs = performance.now() - t;
  const r = rig(f.nodes, f.wires, '3d', false, true, rapier);
  const input = { keysDown: new Set<string>() };
  let k = 0;
  const at = (s: number): boolean => Math.abs(k * TICK_DT - s) < TICK_DT / 2;
  return {
    world: r.world,
    cards: f.nodes.length,
    compileMs,
    tick: () => {
      // 0-20 s drive, 20-30 s stand still and dump at 45 degrees, 30 s tray back, 32 s on: drive again.
      if (at(20)) r.set('pw', { value: 0 });
      if (at(21)) r.set('ang', { value: 45 });
      if (at(30)) r.set('ang', { value: 0 });
      if (at(32)) r.set('pw', { value: 0.7 });
      k++;
      r.rt.tick(input);
      r.world.step(TICK_DT);
    },
  };
}

const make = (what: string, n: number): Run => (what === 'tray' ? tray(n) : agv(n));

/** FNV-1a over the text of every entity view. */
function mix(h: number, world: World): number {
  const s = JSON.stringify(world.entities());
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const f3 = (n: number): string => n.toFixed(3);

function post<T>(session: Session, method: string, params?: object): Promise<T> {
  return new Promise((resolve, reject) => session.post(method, params, (err, res) => (err ? reject(err) : resolve(res as T))));
}

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}

async function profile(what: string, n: number): Promise<void> {
  const run = make(what, n);
  // Run up to the stretch that is to be looked at.
  for (let k = 0; k < Math.round(FROM / TICK_DT); k++) run.tick();
  const session = new Session();
  session.connect();
  await post(session, 'Profiler.enable');
  await post(session, 'Profiler.setSamplingInterval', { interval: 200 });
  await post(session, 'Profiler.start');
  const ticks = Math.round(Math.min(SECONDS, 20) / TICK_DT);
  for (let k = 0; k < ticks; k++) run.tick();
  const { profile: p } = await post<{ profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] } }>(session, 'Profiler.stop');
  session.disconnect();
  run.world.dispose?.();
  const byId = new Map(p.nodes.map((x) => [x.id, x]));
  const parent = new Map<number, number>();
  for (const x of p.nodes) for (const c of x.children ?? []) parent.set(c, x.id);
  const short = (url: string): string => url.replace(/\\/g, '/').replace(/^.*\/app\//, '').replace(/\?.*$/, '') || '(native)';
  const key = (x: ProfileNode): string => `${x.callFrame.functionName || '(anonymous)'} @ ${short(x.callFrame.url)}:${x.callFrame.lineNumber + 1}`;
  const selfBy = new Map<string, number>();
  const inclBy = new Map<string, number>();
  let sampled = 0;
  p.samples.forEach((id, k) => {
    const ms = (p.timeDeltas[k] ?? 0) / 1000;
    sampled += ms;
    selfBy.set(key(byId.get(id)!), (selfBy.get(key(byId.get(id)!)) ?? 0) + ms);
    // Inclusive: every distinct function on the stack gets the sample once.
    const seen = new Set<string>();
    for (let at: number | undefined = id; at !== undefined; at = parent.get(at)) {
      const k2 = key(byId.get(at)!);
      if (seen.has(k2)) continue;
      seen.add(k2);
      inclBy.set(k2, (inclBy.get(k2) ?? 0) + ms);
    }
  });
  console.log(`### profile ${what}:${n}, ${ticks} ticks, sampled ${f3(sampled / 1000)} s (${f3(sampled / ticks)} ms per tick)`);
  console.log('| self ms | share | function @ file:line |\n|---|---|---|');
  for (const [k2, ms] of [...selfBy].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`| ${ms.toFixed(0)} | ${((ms / sampled) * 100).toFixed(1)} % | ${k2} |`);
  console.log('| inclusive ms | share | function @ file:line (src only) |\n|---|---|---|');
  for (const [k2, ms] of [...inclBy].filter(([k3]) => k3.includes('src/')).sort((a, b) => b[1] - a[1]).slice(0, 45)) console.log(`| ${ms.toFixed(0)} | ${((ms / sampled) * 100).toFixed(1)} % | ${k2} |`);
}

describe.skipIf(plan === '')('cost of one tick as the board grows (measuring tool, runs only when asked)', () => {
  it('prints one row per board size', async () => {
    const jobs = plan.split(/\s+/).filter(Boolean).flatMap((part) => {
      const [what = '', sizes = ''] = part.split(':');
      return sizes.split(',').map((s) => ({ what, n: Number(s) }));
    });
    // Warm-up so the first measured run is not the one that pays for the JIT.
    const warm = agv(1);
    for (let k = 0; k < 600; k++) warm.tick();
    warm.world.dispose?.();
    const rows: string[] = ['| board | cards | entities | compile ms | mean ms/tick | p50 | p95 | p99 | max | max after 1 s | hash |', '|---|---|---|---|---|---|---|---|---|---|---|'];
    for (const job of jobs) {
      if (job.what.startsWith('profile-')) {
        await profile(job.what.slice('profile-'.length), job.n);
        continue;
      }
      const run = make(job.what, job.n);
      const ticks = Math.round(SECONDS / TICK_DT);
      const ms: number[] = [];
      let hash = 2166136261;
      for (let k = 0; k < ticks; k++) {
        const a = performance.now();
        run.tick();
        ms.push(performance.now() - a);
        if (k % 300 === 299) hash = mix(hash, run.world);
      }
      const sorted = [...ms].sort((a, b) => a - b);
      const q = (p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
      const row = `| ${job.what} x${job.n} | ${run.cards} | ${run.world.entities().length} | ${f3(run.compileMs)} | ${f3(ms.reduce((a, c) => a + c, 0) / ms.length)} | ${f3(q(0.5))} | ${f3(q(0.95))} | ${f3(q(0.99))} | ${f3(sorted[sorted.length - 1]!)} | ${f3(Math.max(...ms.slice(60)))} | ${hash.toString(16)} |`;
      rows.push(row);
      console.log(row);
      // Where in the run the time goes: the mean of every 5 simulated seconds.
      const per = Math.round(5 / TICK_DT);
      const parts: string[] = [];
      for (let k = 0; k < ms.length; k += per) parts.push((ms.slice(k, k + per).reduce((a, c) => a + c, 0) / Math.min(per, ms.length - k)).toFixed(1));
      console.log(`  ${job.what} x${job.n} by 5 s: ${parts.join(' ')}`);
      run.world.dispose?.();
    }
    console.log(rows.join('\n'));
  });
});
