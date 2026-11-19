import { execSync } from 'node:child_process';
import { cpus } from 'node:os';
import { beforeAll, describe, it } from 'vitest';
import { compileGraph } from '../../src/engine/compile';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';
import { cloneBoard } from './s4-clone-board';
import { engineOnce, f2, f3, quantile, report } from './spike-lib';
import type { RapierModule } from '../../src/world/rapier-loader';

/**
 * Spike 4: what a board with N copies of the AGV sample costs per tick, headless in node with "Vật lý thật" on.
 * The copies are made here, in the test: card ids get a prefix and the params that hold a place in the world are shifted
 * (the list comes from the placement audit of spike 3). No engine feature is added. Nothing is asserted.
 */

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await engineOnce();
});

/** Params that hold a place in the world, by node kind (only the kinds the AGV board uses). */
function nodeProcesses(): string {
  try {
    const out = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { encoding: 'utf8' });
    const rows = out.split(/\r?\n/).filter((l) => l.toLowerCase().includes('node.exe'));
    const memKb = rows.map((l: string) => Number((l.split('","')[4] ?? '').replace(/[^0-9]/g, ''))).reduce((a: number, c: number) => a + (Number.isFinite(c) ? c : 0), 0);
    return `${rows.length} node.exe alive (${Math.round(memKb / 1024)} MB together)`;
  } catch (e) {
    return `could not list processes: ${String(e).slice(0, 80)}`;
  }
}

interface Cost {
  copies: number;
  nodes: number;
  wires: number;
  compileMs: number;
  createMs: number;
  graphMs: number[];
  worldMs: number[];
  totalMs: number[];
  delivered: number[];
  laps: number[];
  entities: number;
  crates: number;
  wallS: number;
}

function measure(base: Board, copies: number, seconds: number, realPhysics = true): Cost {
  const graph = cloneBoard(base, copies, 14);
  if (!realPhysics) graph.settings = { ...graph.settings, realPhysics: false };
  // Compile alone: best of 5 (the first call also pays for the JIT).
  let compileMs = Infinity;
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    compileGraph(graph);
    compileMs = Math.min(compileMs, performance.now() - t);
  }
  const options = worldOptionsForGraph(graph);
  const world = createWorld('3d', options ? { ...options, ...(realPhysics ? { rapier } : {}) } : undefined);
  const t0 = performance.now();
  const rt = createRuntime(graph, world, '3d');
  const createMs = performance.now() - t0;
  const graphMs: number[] = [];
  const worldMs: number[] = [];
  const totalMs: number[] = [];
  const input = { keysDown: new Set<string>() };
  const n = Math.round(seconds / TICK_DT);
  const wall = performance.now();
  for (let i = 0; i < n; i++) {
    const a = performance.now();
    rt.tick(input);
    const b = performance.now();
    world.step(TICK_DT);
    const c = performance.now();
    graphMs.push(b - a);
    worldMs.push(c - b);
    totalMs.push(c - a);
  }
  const wallS = (performance.now() - wall) / 1000;
  const ids = Array.from({ length: copies }, (_, k) => `m${k + 1}-`);
  const out: Cost = {
    copies,
    nodes: graph.nodes.length,
    wires: graph.wires.length,
    compileMs,
    createMs,
    graphMs,
    worldMs,
    totalMs,
    delivered: ids.map((p) => Number(rt.getOutput(`${p}dem-thung`, 'value'))),
    laps: ids.map((p) => Number(rt.getOutput(`${p}dem-vong`, 'value'))),
    entities: world.entities().length,
    crates: world.entities().filter((e) => e.kind === 'item').length,
    wallS,
  };
  world.dispose?.();
  return out;
}

const stats = (xs: number[]): { mean: number; p50: number; p95: number; p99: number; max: number } => {
  const s = [...xs].sort((a, b) => a - b);
  return { mean: xs.reduce((a, c) => a + c, 0) / xs.length, p50: quantile(s, 0.5), p95: quantile(s, 0.95), p99: quantile(s, 0.99), max: s[s.length - 1]! };
};

describe('spike 4: cost of N copies of the AGV board, headless, real physics', () => {
  it('1x, 4x and 8x for 60 simulated seconds', { timeout: 600_000 }, () => {
    const say = report('s4-cost.md');
    const base = structuredClone(listAllSamples().find((s) => s.id === 'agv-shuttle')!.board);
    const cpu = cpus();
    say(`machine: ${cpu.length} logical CPUs, ${cpu[0]?.model ?? '?'}; node ${process.version}; before: ${nodeProcesses()}`);
    say('');
    // Warm-up so the first measured run is not the one that pays for the JIT.
    measure(base, 1, 10);
    say('| copies | switch | cards | wires | entities / crates at 60 s | compile ms (best of 5) | compile + create ms | per tick ms: mean | p50 | p95 | p99 | max | of which cards (mean) | world step (mean) | share of a 16.7 ms frame (mean / p95) | 60 s simulated in (s) | crates delivered per copy | laps per copy |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    const row = (c: Cost, label: string): void => {
      const t = stats(c.totalMs);
      say(
        `| ${c.copies} | ${label} | ${c.nodes} | ${c.wires} | ${c.entities} / ${c.crates} | ${f3(c.compileMs)} | ${f2(c.createMs)} | ${f3(t.mean)} | ${f3(t.p50)} | ${f3(t.p95)} | ${f3(t.p99)} | ${f2(t.max)} | ${f3(stats(c.graphMs).mean)} | ${f3(stats(c.worldMs).mean)} | ${((t.mean / (1000 / 60)) * 100).toFixed(1)} % / ${((t.p95 / (1000 / 60)) * 100).toFixed(1)} % | ${f2(c.wallS)} | ${c.delivered.join(' ')} | ${c.laps.join(' ')} |`,
      );
    };
    const runs: Cost[] = [];
    for (const copies of [1, 4, 8, 8, 16]) {
      const c = measure(base, copies, 60);
      runs.push(c);
      row(c, 'Vật lý thật on');
    }
    row(measure(base, 8, 60, false), 'off (crates by the old rules: not the same machine, cost reference only)');
    say('');
    say(`after: ${nodeProcesses()}`);
    // Where the worst ticks are: the 5 slowest ticks of the first 8x run.
    const eight = runs.find((r) => r.copies === 8)!;
    const worst = eight.totalMs.map((ms, i) => ({ ms, i })).sort((a, b) => b.ms - a.ms).slice(0, 5);
    say(`slowest ticks of the first 8x run: ${worst.map((w) => `tick ${w.i} (${f2(w.i * TICK_DT)} s): ${f2(w.ms)} ms`).join('; ')}`);
    const late = stats(eight.totalMs.slice(600));
    say(`8x without the first 10 s: mean ${f3(late.mean)} / p95 ${f3(late.p95)} / max ${f2(late.max)} ms`);
  });
});
