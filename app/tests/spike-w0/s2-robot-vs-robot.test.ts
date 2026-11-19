import { beforeAll, describe, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { engineOnce, f2, f3, mm, report } from './spike-lib';
import type { RapierModule } from '../../src/world/rapier-loader';

/**
 * Spike 2: do two robot-body chassis collide under "Vật lý thật"? Head-on, rear-end, and a follower that cuts its motors with the
 * "Dò phía trước" piece. Overlap depth = how far the two collision squares are inside each other along the line they drive on.
 * Nothing is asserted: numbers go to out/s2-*.md.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await engineOnce();
});

const CHASSIS = { length: 1.2, width: 1, height: 0.3, mass: 5, friction: 0.8 };
/** The collision box of a chassis is a square as wide as its longer side (nodes/robot-body.ts). */
const SIDE = Math.max(CHASSIS.length, CHASSIS.width);

interface Drive {
  name: string;
  motorN: number;
  maxRpm: number;
  power: number;
}
const NORMAL: Drive = { name: 'normal (sample: 2 x 6 N, 90 rpm, power 0.7)', motorN: 6, maxRpm: 90, power: 0.7 };
const MAX: Drive = { name: 'max (default motor: 2 x 30 N, 120 rpm, power 1)', motorN: 30, maxRpm: 120, power: 1 };

/** A chassis with two motors whose power is the const `${id}-p` (times `${id}-gate` when `sensor` is given). */
function robot(id: string, x: number, headingDeg: number, d: Drive, sensor?: { reach: number }, z = 0): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const nodes: NodeSpec[] = [
    [id, 'robot-body', { position: { x, y: CHASSIS.height / 2, z }, heading: headingDeg, ...CHASSIS }],
    [`${id}-ml`, 'motor', { side: -0.45, maxRpm: d.maxRpm, maxForce: d.motorN }],
    [`${id}-mr`, 'motor', { side: 0.45, maxRpm: d.maxRpm, maxForce: d.motorN }],
    [`${id}-p`, 'const', { value: 0 }],
  ];
  const wires: WireSpec[] = [[id, 'self', `${id}-ml`, 'body'], [id, 'self', `${id}-mr`, 'body']];
  if (sensor) {
    nodes.push([`${id}-eye`, 'ahead-sensor', { reach: sensor.reach }], [`${id}-clear`, 'not', {}], [`${id}-num`, 'bool-to-number', {}], [`${id}-gate`, 'math', { op: 'mul' }]);
    wires.push(
      [id, 'self', `${id}-eye`, 'who'], [`${id}-eye`, 'blocked', `${id}-clear`, 'in'], [`${id}-clear`, 'out', `${id}-num`, 'on'],
      [`${id}-p`, 'value', `${id}-gate`, 'a'], [`${id}-num`, 'value', `${id}-gate`, 'b'],
      [`${id}-gate`, 'out', `${id}-ml`, 'power'], [`${id}-gate`, 'out', `${id}-mr`, 'power'],
    );
  } else {
    wires.push([`${id}-p`, 'value', `${id}-ml`, 'power'], [`${id}-p`, 'value', `${id}-mr`, 'power']);
  }
  return { nodes, wires };
}

const FLOOR: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 80, y: 1, z: 20 } }];

function play(parts: { nodes: NodeSpec[]; wires: WireSpec[] }[]) {
  return rig([FLOOR, ...parts.flatMap((p) => p.nodes)], parts.flatMap((p) => p.wires), '3d', false, true, rapier);
}

type Rig = ReturnType<typeof play>;
const xOf = (r: Rig, id: string): number => r.entity(id)!.position.x;
const speedOf = (r: Rig, id: string): number => r.entity(id)!.robot!.speed;
/** Positive = the two collision squares are this deep inside each other along x; negative = the gap between them. */
const overlapX = (r: Rig, a: string, b: string): number => SIDE - Math.abs(xOf(r, a) - xOf(r, b));

describe('spike 2: robot against robot, real physics', () => {
  it('a) head-on and b) rear-end: overlap depth per tick', () => {
    const say = report('s2ab-pass-through.md');
    say('| run | drive | first overlap (s) | deepest overlap mm (s) | ticks overlapping | passed through each other | A speed before / during / after m/s | B speed before / during / after m/s | A "pushing" ever |');
    say('|---|---|---|---|---|---|---|---|---|');
    const series: string[] = ['run,drive,t,xA,xB,overlap,speedA,speedB'];
    for (const d of [NORMAL, MAX]) {
      for (const run of ['head-on', 'rear-end'] as const) {
        const r = play([robot('a', -3, 0, d), robot('b', run === 'head-on' ? 3 : 0, run === 'head-on' ? 180 : 0, d)]);
        r.set('a-p', { value: d.power });
        if (run === 'head-on') r.set('b-p', { value: d.power });
        let first = -1;
        let deepest = -Infinity;
        let deepestAt = 0;
        let ticks = 0;
        let pushing = false;
        const before = { a: 0, b: 0 };
        const during = { a: 0, b: 0 };
        const sign0 = Math.sign(xOf(r, 'a') - xOf(r, 'b'));
        let passed = false;
        const n = Math.round(8 / TICK_DT);
        for (let k = 0; k < n; k++) {
          r.tick();
          const t = (k + 1) * TICK_DT;
          const o = overlapX(r, 'a', 'b');
          if (o > 0) {
            ticks++;
            if (first < 0) {
              first = t;
              before.a = speedOf(r, 'a');
              before.b = speedOf(r, 'b');
            }
            if (o > deepest) {
              deepest = o;
              deepestAt = t;
              during.a = speedOf(r, 'a');
              during.b = speedOf(r, 'b');
            }
          }
          if (Math.sign(xOf(r, 'a') - xOf(r, 'b')) !== sign0) passed = true;
          if (r.entity('a')!.robot!.pushing) pushing = true;
          if (k % 6 === 0) series.push([run, d.motorN, t.toFixed(3), xOf(r, 'a').toFixed(4), xOf(r, 'b').toFixed(4), o.toFixed(4), speedOf(r, 'a').toFixed(3), speedOf(r, 'b').toFixed(3)].join(','));
        }
        say(`| ${run} | ${d.name} | ${first < 0 ? 'never' : f2(first)} | ${mm(deepest)} (${f2(deepestAt)}) | ${ticks} | ${passed ? 'YES' : 'no'} | ${f2(before.a)} / ${f2(during.a)} / ${f2(speedOf(r, 'a'))} | ${f2(before.b)} / ${f2(during.b)} / ${f2(speedOf(r, 'b'))} | ${pushing ? 'yes' : 'no'} |`);
        r.world.dispose?.();
      }
    }
    report('s2ab-series.csv')(series.join('\n'));
  });

  it('c) a follower that cuts its motors on "Đang bị chặn": stopping gap and restart', () => {
    const say = report('s2c-follower.md');
    say('| drive | sensor reach m | speed when the leader stops m/s | gap when the follower first reads blocked m | gap at rest m | smallest gap ever m (negative = inside the leader) | stops in (s after blocked) | restarts when leader moves on | restart delay s | gap while both drive again m (min / max) | starts after the leader moves on (7 s) |');
    say('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const d of [NORMAL, MAX]) {
      for (const reach of [3, 1, 0.5, 0.25, 0.1]) {
        // Leader 3.5 m ahead (bumper to bumper); both start together; the leader stops at 3 s, waits 6 s, drives on at 9 s.
        const r = play([robot('lead', 3.5 + SIDE, 0, d), robot('fol', 0, 0, d, { reach })]);
        r.set('lead-p', { value: d.power });
        r.set('fol-p', { value: d.power });
        const gap = (): number => -overlapX(r, 'lead', 'fol');
        let minGap = Infinity;
        let blockedAt = -1;
        let gapAtBlocked = NaN;
        let stoppedAt = -1;
        let speedAtStop = NaN;
        let gapAtRest = NaN;
        let restartAt = -1;
        let cycles = 0;
        let wasMoving = true;
        let followMin = Infinity;
        let followMax = -Infinity;
        const n = Math.round(16 / TICK_DT);
        for (let k = 0; k < n; k++) {
          const t = k * TICK_DT;
          // The leader runs into the stopped phase only after the follower has reached its speed and (for long reaches) its own following gap.
          if (t >= 3 && t < 9) r.set('lead-p', { value: 0 });
          if (t >= 9) r.set('lead-p', { value: d.power });
          if (Math.abs(t - 3) < 1e-9) speedAtStop = speedOf(r, 'fol');
          r.tick();
          const g = gap();
          minGap = Math.min(minGap, g);
          const blocked = r.out('fol-eye', 'blocked') === true;
          const v = Math.abs(speedOf(r, 'fol'));
          if (t >= 3 && t < 9) {
            if (blocked && blockedAt < 0) {
              blockedAt = t;
              gapAtBlocked = g;
            }
            if (blockedAt >= 0 && stoppedAt < 0 && v < 0.005) stoppedAt = t;
          }
          if (Math.abs(t - 8.9) < TICK_DT / 2) gapAtRest = g;
          if (t >= 9) {
            if (restartAt < 0 && v > 0.05) restartAt = t;
            const moving = v > 0.05;
            if (moving && !wasMoving) cycles++;
            wasMoving = moving;
            if (t > 12) {
              followMin = Math.min(followMin, g);
              followMax = Math.max(followMax, g);
            }
          } else {
            wasMoving = v > 0.05;
          }
        }
        say(`| ${d.name} | ${reach} | ${f2(speedAtStop)} | ${Number.isNaN(gapAtBlocked) ? 'never blocked' : f3(gapAtBlocked)} | ${f3(gapAtRest)} | ${f3(minGap)} | ${stoppedAt < 0 || blockedAt < 0 ? '-' : f2(stoppedAt - blockedAt)} | ${restartAt < 0 ? 'NO' : 'yes'} | ${restartAt < 0 ? '-' : f2(restartAt - 9)} | ${f3(followMin)} / ${f3(followMax)} | ${cycles} |`);
        r.world.dispose?.();
      }
    }
  });

  it('d) two robots with the same sensor meeting head-on: do they stop, and do they ever move again', () => {
    const say = report('s2d-head-on-sensors.md');
    say('| drive | sensor reach m | gap at rest m | smallest gap ever m | both blocked at the end | either moves in the last 5 s |');
    say('|---|---|---|---|---|---|');
    for (const d of [NORMAL, MAX]) {
      for (const reach of [3, 1, 0.5]) {
        const r = play([robot('a', -5, 0, d, { reach }), robot('b', 5, 180, d, { reach })]);
        r.set('a-p', { value: d.power });
        r.set('b-p', { value: d.power });
        let minGap = Infinity;
        let lateMove = false;
        const n = Math.round(12 / TICK_DT);
        for (let k = 0; k < n; k++) {
          r.tick();
          minGap = Math.min(minGap, -overlapX(r, 'a', 'b'));
          if (k * TICK_DT > 7 && (Math.abs(speedOf(r, 'a')) > 0.01 || Math.abs(speedOf(r, 'b')) > 0.01)) lateMove = true;
        }
        say(`| ${d.name} | ${reach} | ${f3(-overlapX(r, 'a', 'b'))} | ${f3(minGap)} | ${r.out('a-eye', 'blocked') === true && r.out('b-eye', 'blocked') === true ? 'yes (deadlock)' : 'no'} | ${lateMove ? 'yes' : 'no'} |`);
        r.world.dispose?.();
      }
    }
  });

  it('e) crossing at a right angle on a grid: does the sensor see a robot coming from the side', () => {
    const say = report('s2e-crossing.md');
    say('| drive | sensor reach m | deepest overlap of the two squares mm | A blocked ticks | B blocked ticks | both end blocked |');
    say('|---|---|---|---|---|---|');
    for (const d of [NORMAL, MAX]) {
      for (const reach of [1, 0.5]) {
        // A drives +x along z = 0, B drives -z... heading 90 = +z: B starts at z = -5 and drives toward +z; both reach the crossing (0, 0) together.
        const r = play([robot('a', -5, 0, d, { reach }), robot('b', 0, 90, d, { reach }, -5)]);
        r.set('a-p', { value: d.power });
        r.set('b-p', { value: d.power });
        let deepest = -Infinity;
        let ba = 0;
        let bb = 0;
        const n = Math.round(12 / TICK_DT);
        for (let k = 0; k < n; k++) {
          r.tick();
          const a = r.entity('a')!.position;
          const b = r.entity('b')!.position;
          deepest = Math.max(deepest, Math.min(SIDE - Math.abs(a.x - b.x), SIDE - Math.abs(a.z - b.z)));
          if (r.out('a-eye', 'blocked') === true) ba++;
          if (r.out('b-eye', 'blocked') === true) bb++;
        }
        say(`| ${d.name} | ${reach} | ${mm(deepest)} | ${ba} | ${bb} | ${r.out('a-eye', 'blocked') === true && r.out('b-eye', 'blocked') === true ? 'yes (deadlock)' : 'no'} |`);
        r.world.dispose?.();
      }
    }
  });
});
