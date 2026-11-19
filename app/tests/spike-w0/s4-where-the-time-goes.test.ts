import { Session } from 'node:inspector';
import { beforeAll, describe, it } from 'vitest';
import { compileGraph } from '../../src/engine/compile';
import { getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type NodeDef } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';
import { cloneBoard } from './s4-clone-board';
import { engineOnce, f2, f3, report } from './spike-lib';
import type { RapierModule } from '../../src/world/rapier-loader';

/**
 * Spike 4, second part: where the per-tick time of the 8x board goes. Two independent readings:
 *  1. each card kind's `evaluate` wrapped with a timer (test-side wrapper, the engine files are not edited);
 *  2. a CPU profile of the same run (sampling every 0.2 ms), summed by function.
 */

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await engineOnce();
});

interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}

function post<T>(session: Session, method: string, params?: object): Promise<T> {
  return new Promise((resolve, reject) => session.post(method, params, (err, res) => (err ? reject(err) : resolve(res as T))));
}

const short = (url: string): string => url.replace(/\\/g, '/').replace(/^.*\/app\//, '').replace(/\?.*$/, '') || '(native)';

describe('spike 4: where the time of the 8x board goes', () => {
  it('per card kind and per function', { timeout: 600_000 }, async () => {
    const say = report('s4-profile.md');
    const base = structuredClone(listAllSamples().find((s) => s.id === 'agv-shuttle')!.board);
    const SECONDS = 20;

    for (const copies of [1, 8]) {
      const graph = cloneBoard(base, copies, 14);
      // --- reading 1: time inside evaluate(), by card kind
      const spent = new Map<string, { ms: number; calls: number }>();
      const restore: (() => void)[] = [];
      for (const kind of new Set(graph.nodes.map((n) => n.kind))) {
        const def = getNodeDef(kind) as NodeDef<unknown>;
        const original = def.evaluate;
        const acc = { ms: 0, calls: 0 };
        spent.set(kind, acc);
        def.evaluate = ((ctx, i, p, s) => {
          const t = performance.now();
          const out = original(ctx, i, p, s);
          acc.ms += performance.now() - t;
          acc.calls++;
          return out;
        }) as typeof original;
        restore.push(() => {
          def.evaluate = original;
        });
      }
      const options = worldOptionsForGraph(graph);
      const world = createWorld('3d', { ...(options ?? {}), rapier });
      const rt = createRuntime(graph, world, '3d');
      const input = { keysDown: new Set<string>() };
      const n = Math.round(SECONDS / TICK_DT);
      let graphMs = 0;
      let worldMs = 0;
      for (let k = 0; k < n; k++) {
        const a = performance.now();
        rt.tick(input);
        const b = performance.now();
        world.step(TICK_DT);
        graphMs += b - a;
        worldMs += performance.now() - b;
      }
      restore.forEach((f) => f());
      world.dispose?.();
      say(`### ${copies}x, ${SECONDS} s: cards ${f3(graphMs / n)} ms per tick, world step ${f3(worldMs / n)} ms per tick`);
      say('');
      say('| card kind | cards of it | ms per tick (all of them) | microseconds per card per tick | share of the card time |');
      say('|---|---|---|---|---|');
      const total = [...spent.values()].reduce((a, c) => a + c.ms, 0);
      for (const [kind, acc] of [...spent].sort((a, b) => b[1].ms - a[1].ms).slice(0, 12)) {
        const count = graph.nodes.filter((x) => x.kind === kind).length;
        say(`| ${kind} | ${count} | ${f3(acc.ms / n)} | ${((acc.ms / acc.calls) * 1000).toFixed(1)} | ${((acc.ms / total) * 100).toFixed(1)} % |`);
      }
      say('');
    }

    // --- reading 2: CPU profile of the 8x run
    const graph = cloneBoard(base, 8, 14);
    const options = worldOptionsForGraph(graph);
    const world = createWorld('3d', { ...(options ?? {}), rapier });
    const session = new Session();
    session.connect();
    await post(session, 'Profiler.enable');
    await post(session, 'Profiler.setSamplingInterval', { interval: 200 });
    await post(session, 'Profiler.start');
    const t0 = performance.now();
    compileGraph(graph);
    const rt = createRuntime(graph, world, '3d');
    const input = { keysDown: new Set<string>() };
    const n = Math.round(SECONDS / TICK_DT);
    for (let k = 0; k < n; k++) {
      rt.tick(input);
      world.step(TICK_DT);
    }
    const wall = performance.now() - t0;
    const { profile } = await post<{ profile: { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] } }>(session, 'Profiler.stop');
    session.disconnect();
    world.dispose?.();

    const byId = new Map(profile.nodes.map((x) => [x.id, x]));
    const self = new Map<number, number>();
    profile.samples.forEach((id, k) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[k] ?? 0) / 1000));
    const parent = new Map<number, number>();
    for (const x of profile.nodes) for (const c of x.children ?? []) parent.set(c, x.id);
    const key = (x: ProfileNode): string => `${x.callFrame.functionName || '(anonymous)'} @ ${short(x.callFrame.url)}:${x.callFrame.lineNumber + 1}`;
    const selfBy = new Map<string, number>();
    const inclBy = new Map<string, number>();
    for (const [id, ms] of self) {
      const x = byId.get(id)!;
      selfBy.set(key(x), (selfBy.get(key(x)) ?? 0) + ms);
      // Inclusive: every distinct function on the stack gets the sample once.
      const seen = new Set<string>();
      for (let at: number | undefined = id; at !== undefined; at = parent.get(at)) {
        const k2 = key(byId.get(at)!);
        if (seen.has(k2)) continue;
        seen.add(k2);
        inclBy.set(k2, (inclBy.get(k2) ?? 0) + ms);
      }
    }
    const sampled = [...self.values()].reduce((a, c) => a + c, 0);
    say(`### CPU profile, 8x, ${SECONDS} s simulated: wall ${f2(wall / 1000)} s, sampled ${f2(sampled / 1000)} s (line numbers are those of the code vitest ran, check them against the source)`);
    say('');
    say('| self time ms | share | function @ file:line |');
    say('|---|---|---|');
    for (const [k2, ms] of [...selfBy].sort((a, b) => b[1] - a[1]).slice(0, 25)) say(`| ${ms.toFixed(0)} | ${((ms / sampled) * 100).toFixed(1)} % | ${k2} |`);
    say('');
    say('| inclusive time ms | share | function @ file:line (only functions in src/) |');
    say('|---|---|---|');
    for (const [k2, ms] of [...inclBy].filter(([k3]) => k3.includes('src/')).sort((a, b) => b[1] - a[1]).slice(0, 40)) say(`| ${ms.toFixed(0)} | ${((ms / sampled) * 100).toFixed(1)} % | ${k2} |`);
  });
});
