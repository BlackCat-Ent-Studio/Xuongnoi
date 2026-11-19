import { beforeAll, describe, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { engineOnce, f2, f3, quantile, report } from './spike-lib';
import type { RapierModule } from '../../src/world/rapier-loader';

/**
 * Spike 4, third part: a rough fleet closer to the planned factory than 8 copies of the AGV board. N small chassis side by side, each
 * with two motors, a "Dò phía trước" stop, a tilt tray (joint + solid link), a zone that follows it to sense its load, three line
 * sensors on one shared straight line per lane, and one rigid crate on the tray. They drive 20 s, stop, tilt, and drive on.
 * Cost only: this is not a working sorter.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await engineOnce();
});

function fleet(n: number): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const nodes: NodeSpec[] = [['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 120, y: 1, z: 60 } }], ['go', 'on-start', {}], ['pw', 'const', { value: 0.7 }], ['ang', 'const', { value: 0 }]];
  const wires: WireSpec[] = [];
  for (let k = 0; k < n; k++) {
    const z = (k - (n - 1) / 2) * 2.5;
    const id = `r${k + 1}`;
    nodes.push(
      [`${id}-line`, 'line-track', { shape: 'custom', count: 2, closed: 'no', smooth: 'no', center: { x: 0, y: 0.02, z: 0 }, width: 0.3, p1: { x: -55, y: 0, z }, p2: { x: 55, y: 0, z } }],
      [id, 'robot-body', { position: { x: -50, y: 0.15, z }, heading: 0, length: 0.8, width: 0.6, height: 0.3, mass: 5, friction: 0.8 }],
      [`${id}-ml`, 'motor', { side: -0.3, maxRpm: 90, maxForce: 6, accel: 300 }],
      [`${id}-mr`, 'motor', { side: 0.3, maxRpm: 90, maxForce: 6, accel: 300 }],
      [`${id}-eye`, 'ahead-sensor', { reach: 1 }],
      [`${id}-clear`, 'not', {}],
      [`${id}-num`, 'bool-to-number', {}],
      [`${id}-gate`, 'math', { op: 'mul' }],
      [`${id}-s1`, 'line-sensor', { side: -0.2, forward: 0.45, spot: 0.2 }],
      [`${id}-s2`, 'line-sensor', { side: 0, forward: 0.45, spot: 0.2 }],
      [`${id}-s3`, 'line-sensor', { side: 0.2, forward: 0.45, spot: 0.2 }],
      [`${id}-tilt`, 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, maxSpeed: 30, mount: { x: -0.4, y: 0.35, z: 0 }, solid: 'no' }],
      [`${id}-tray`, 'link', { length: 0.8, thickness: 0.2, solid: 'yes', mass: 1 }],
      [`${id}-load`, 'zone', { center: { x: 0, y: 0.75, z: 0 }, size: { x: 0.8, y: 0.6, z: 0.8 }, filter: 'item', rule: 'center', rotate: 'yes' }],
      [`${id}-crate`, 'item', { shape: 'crate', position: { x: -50, y: 0.15 + 0.35 + 0.1 + 0.15 + 0.005, z }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: 1 }],
    );
    wires.push(
      [id, 'self', `${id}-ml`, 'body'], [id, 'self', `${id}-mr`, 'body'], [id, 'self', `${id}-eye`, 'who'],
      [`${id}-eye`, 'blocked', `${id}-clear`, 'in'], [`${id}-clear`, 'out', `${id}-num`, 'on'],
      ['pw', 'value', `${id}-gate`, 'a'], [`${id}-num`, 'value', `${id}-gate`, 'b'],
      [`${id}-gate`, 'out', `${id}-ml`, 'power'], [`${id}-gate`, 'out', `${id}-mr`, 'power'],
      [id, 'self', `${id}-s1`, 'who'], [id, 'self', `${id}-s2`, 'who'], [id, 'self', `${id}-s3`, 'who'],
      [`${id}-line`, 'self', `${id}-s1`, 'track'], [`${id}-line`, 'self', `${id}-s2`, 'track'], [`${id}-line`, 'self', `${id}-s3`, 'track'],
      [id, 'self', `${id}-tilt`, 'base'], ['go', 'started', `${id}-tilt`, 'power'], ['ang', 'value', `${id}-tilt`, 'angle'], [`${id}-tilt`, 'tip', `${id}-tray`, 'base'],
      [id, 'self', `${id}-load`, 'follow'],
    );
  }
  return { nodes, wires };
}

describe('spike 4: cost of a fleet of tray chassis', () => {
  it('2, 4, 8 and 16 tray chassis for 60 simulated seconds', { timeout: 600_000 }, () => {
    const say = report('s4-tray-fleet.md');
    say('| chassis | cards | wires | entities | per tick ms: mean | p50 | p95 | p99 | max | cards (mean) | world step (mean) | share of a 16.7 ms frame (mean / p95) | loaded at 19 s | loaded at 60 s | distance driven m (first chassis) |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const n of [1, 2, 4, 8, 8, 16]) {
      const f = fleet(n);
      const r = rig(f.nodes, f.wires, '3d', false, true, rapier);
      const total: number[] = [];
      let cards = 0;
      let world = 0;
      const input = { keysDown: new Set<string>() };
      const loadedNow = (): number => Array.from({ length: n }, (_, k) => (r.out(`r${k + 1}-load`, 'inside') === true ? 1 : 0)).reduce((a: number, c: number) => a + c, 0);
      let loaded19 = -1;
      const ticks = Math.round(60 / TICK_DT);
      const x0 = r.entity('r1')!.position.x;
      for (let k = 0; k < ticks; k++) {
        const t = k * TICK_DT;
        // 0-20 s drive, 20-30 s stand still and dump at 45 degrees, 30 s tray back, 32-60 s drive on.
        if (Math.abs(t - 19) < TICK_DT / 2) loaded19 = loadedNow();
        if (Math.abs(t - 20) < TICK_DT / 2) r.set('pw', { value: 0 });
        if (Math.abs(t - 21) < TICK_DT / 2) r.set('ang', { value: 45 });
        if (Math.abs(t - 30) < TICK_DT / 2) r.set('ang', { value: 0 });
        if (Math.abs(t - 32) < TICK_DT / 2) r.set('pw', { value: 0.7 });
        const a = performance.now();
        r.rt.tick(input);
        const b = performance.now();
        r.world.step(TICK_DT);
        const c = performance.now();
        cards += b - a;
        world += c - b;
        total.push(c - a);
      }
      const s = [...total].sort((p, q) => p - q);
      const mean = total.reduce((p, q) => p + q, 0) / total.length;
      say(
        `| ${n} | ${f.nodes.length} | ${f.wires.length} | ${r.world.entities().length} | ${f3(mean)} | ${f3(quantile(s, 0.5))} | ${f3(quantile(s, 0.95))} | ${f3(quantile(s, 0.99))} | ${f2(s[s.length - 1]!)} | ${f3(cards / ticks)} | ${f3(world / ticks)} | ${((mean / (1000 / 60)) * 100).toFixed(1)} % / ${((quantile(s, 0.95) / (1000 / 60)) * 100).toFixed(1)} % | ${loaded19} of ${n} | ${loadedNow()} of ${n} | ${f2(r.entity('r1')!.position.x - x0)} |`,
      );
      r.world.dispose?.();
    }
  });
});
