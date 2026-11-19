import { describe, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { rig } from '../helpers/arm-rig';
import { engineOnce, f2, len, mm, report, sub } from './spike-lib';
import { CHASSIS, MASSES, VARIANTS, build, max, min, onTray, watch, type Sample, type Variant } from './s1-tray-rig';

/** Degrees between a crate's up axis and the world's. */
function tiltOfTurn(q: { x: number; y: number; z: number; w: number } | undefined): number {
  if (!q) return 0;
  const upY = 1 - 2 * (q.x * q.x + q.z * q.z);
  return (Math.acos(Math.max(-1, Math.min(1, upY))) * 180) / Math.PI;
}

describe('spike 1 follow-ups: causes behind the first tables', () => {
  it('d) what the chassis weighs with only a tray on it, and whether a scale on the tray reads the crate', async () => {
    const rapier = await engineOnce();
    const say = report('s1d-payload.md');
    say('| tray | clearance above chassis m | crate | chassis "payload" kg | scale on tray link kg | speed after 3 s at sample drive m/s |');
    say('|---|---|---|---|---|---|');
    for (const variant of VARIANTS) {
      for (const clearance of [0.01, 0.04, 0.06, 0.1]) {
        for (const noCrate of [true, false]) {
          const r = build({ variant, crateKg: 1, clearance, noCrate });
          watch(r, 1, 0);
          const payload = r.entity('body')!.robot!.payload ?? 0;
          const scale = Number(r.out('scale', 'mass'));
          const go = watch(r, 3, 1, () => {
            r.set('pl', { value: 0.7 });
            r.set('pr', { value: 0.7 });
          });
          say(`| ${variant} | ${clearance} | ${noCrate ? 'none' : '1 kg on tray'} | ${f2(payload)} | ${f2(scale)} | ${f2(go[go.length - 1]!.bodySpeed)} |`);
          r.world.dispose?.();
        }
      }
    }
    // The same chassis and motors with nothing mounted on it.
    const bare = rig(
      [
        ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 20 } }],
        ['body', 'robot-body', { position: { x: 0, y: CHASSIS.height / 2, z: 0 }, heading: 0, ...CHASSIS, friction: 0.8 }],
        ['ml', 'motor', { side: -0.45, maxRpm: 90, maxForce: 6 }],
        ['mr', 'motor', { side: 0.45, maxRpm: 90, maxForce: 6 }],
        ['p', 'const', { value: 0.7 }],
      ],
      [['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'], ['p', 'value', 'ml', 'power'], ['p', 'value', 'mr', 'power']],
      '3d', false, true, rapier,
    );
    bare.tick(180);
    say(`| (no tray) | - | none | ${f2(bare.entity('body')!.robot!.payload ?? 0)} | - | ${f2(bare.entity('body')!.robot!.speed)} |`);
  });

  it('e) drive and brake again with the tray 10 cm above the chassis (no false payload), two motor ramps', () => {
    const say = report('s1e-drive-clear.md');
    say('| tray | crate kg | drive | motor ramp rpm/s | top speed m/s | peak accel / decel m/s2 | slide speeding up mm | slide braking mm | on tray at end | overlap mm max |');
    say('|---|---|---|---|---|---|---|---|---|---|');
    const drives = [
      { name: 'sample (2 x 6 N, 90 rpm, power 0.7)', motorN: 6, maxRpm: 90, power: 0.7 },
      { name: 'default motor (2 x 30 N, 120 rpm), power 1', motorN: 30, maxRpm: 120, power: 1 },
    ];
    for (const variant of ['beam', 'side-slab'] as Variant[]) {
      for (const crateKg of MASSES) {
        for (const d of drives) {
          for (const accel of [400, 300]) {
            const r = build({ variant, crateKg, motorN: d.motorN, maxRpm: d.maxRpm, clearance: 0.1, accel });
            const settle = watch(r, 1, 0);
            const start = settle[settle.length - 1]!;
            const axis = (s: Sample): number => (variant === 'side-slab' ? s.lateral : s.along);
            const go = watch(r, 3, 1, () => {
              r.set('pl', { value: d.power });
              r.set('pr', { value: d.power });
            });
            const stop = watch(r, 3, 4, () => {
              r.set('pl', { value: 0 });
              r.set('pr', { value: 0 });
            });
            const all = [...go, ...stop];
            const acc = all.map((s, k) => (k === 0 ? 0 : (s.bodySpeed - all[k - 1]!.bodySpeed) / TICK_DT));
            const endGo = go[go.length - 1]!;
            const end = stop[stop.length - 1]!;
            say(`| ${variant} | ${crateKg} | ${d.name} | ${accel} | ${f2(max(all.map((s) => s.bodySpeed)))} | ${f2(max(acc))} / ${f2(min(acc))} | ${mm(axis(endGo) - axis(start))} | ${mm(axis(end) - axis(endGo))} | ${onTray(end, r.size) ? 'yes' : 'NO'} | ${mm(max(all.map((s) => s.overlap)))} |`);
            r.world.dispose?.();
          }
        }
      }
    }
  });

  it('f) tilt again: joint torque needed for 1, 5 and 10 kg, and joint speeds between 30 and 90 deg/s', () => {
    const say = report('s1f-tilt-torque-speed.md');
    say('| tray | crate kg | joint torque N.m | joint deg/s | target deg | peak load read N.m | overloaded ticks | reached (s) | leaves tray (s) | rests from chassis centre m / tilt deg | crate speed max m/s | overlap mm max on tray | gap max mm before leaving (hop) |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    const cases: { crateKg: number; maxTorque: number; jointSpeed: number; target: number }[] = [
      { crateKg: 1, maxTorque: 50, jointSpeed: 45, target: 45 },
      { crateKg: 1, maxTorque: 50, jointSpeed: 60, target: 45 },
      { crateKg: 5, maxTorque: 50, jointSpeed: 30, target: 45 },
      { crateKg: 5, maxTorque: 60, jointSpeed: 30, target: 45 },
      { crateKg: 5, maxTorque: 150, jointSpeed: 30, target: 30 },
      { crateKg: 5, maxTorque: 150, jointSpeed: 30, target: 45 },
      { crateKg: 5, maxTorque: 150, jointSpeed: 60, target: 45 },
      { crateKg: 5, maxTorque: 150, jointSpeed: 90, target: 45 },
      { crateKg: 10, maxTorque: 150, jointSpeed: 30, target: 45 },
    ];
    for (const variant of ['beam', 'side-slab'] as Variant[]) {
      for (const c of cases) {
        const r = build({ variant, crateKg: c.crateKg, jointSpeed: c.jointSpeed, maxTorque: c.maxTorque, clearance: 0.1 });
        watch(r, 1, 0);
        const rows = watch(r, 8, 1, () => r.set('ang', { value: c.target }));
        const reached = rows.find((s) => Math.abs(s.angle - c.target) < 0.5);
        const left = rows.find((s) => !onTray(s, r.size));
        const end = rows[rows.length - 1]!;
        const carried = left ? rows.filter((s) => s.t < left.t) : rows;
        say(
          `| ${variant} | ${c.crateKg} | ${c.maxTorque} | ${c.jointSpeed} | ${c.target} | ${f2(max(rows.map((s) => s.load)))} | ${rows.filter((s) => s.overloaded).length} | ${reached ? f2(reached.t - 1) : `never (${f2(end.angle)})`} | ${left ? f2(left.t - 1) : 'never'} | ${f2(Math.hypot(end.cx - end.bx, end.cz - end.bz))} / ${f2(end.tiltToWorld)} | ${f2(max(rows.map((s) => s.speed)))} | ${mm(max(carried.map((s) => s.overlap)))} | ${mm(max(carried.map((s) => s.gap)))} |`,
        );
        r.world.dispose?.();
      }
    }
  });

  it('g) the proven alternative: a piston on the chassis pushes the crate off the chassis top', async () => {
    const rapier = await engineOnce();
    const say = report('s1g-piston.md');
    say('| crate kg | payload read before kg | piston force read N max | overloaded | crate leaves chassis top (s) | rests from chassis centre m / tilt deg | crate speed max m/s | chassis moved mm |');
    say('|---|---|---|---|---|---|---|---|');
    for (const crateKg of MASSES) {
      const size = 0.4;
      const r = rig(
        [
          ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 20 } }],
          ['body', 'robot-body', { position: { x: 0, y: CHASSIS.height / 2, z: 0 }, heading: 0, ...CHASSIS, friction: 0.8 }],
          ['pos', 'const', { value: 0 }],
          ['p', 'linear-actuator', { stroke: 0.9, maxForce: 100, speed: 1.2, headSize: 0.4, direction: 90, orient: 'ground', mount: { x: 0, y: CHASSIS.height / 2 + 0.21, z: -1.75 } }],
          ['crate', 'item', { shape: 'crate', position: { x: 0, y: CHASSIS.height + size / 2 + 0.005, z: 0 }, size: { x: size, y: size, z: size }, mass: crateKg }],
        ],
        [['body', 'self', 'p', 'base'], ['pos', 'value', 'p', 'position']],
        '3d', false, true, rapier,
      );
      r.tick(60);
      const payload = r.entity('body')!.robot!.payload ?? 0;
      const b0 = { ...r.entity('body')!.position };
      const c0 = { ...r.entity('crate')!.position };
      const head0 = { ...r.world.getEntity(String(r.out('p', 'tip')))!.position };
      r.set('pos', { value: 0.9 });
      let leftAt = -1;
      let vmax = 0;
      let fmax = 0;
      let over = false;
      let prev = r.entity('crate')!.position;
      for (let k = 0; k < 360; k++) {
        r.tick();
        const c = r.entity('crate')!;
        vmax = Math.max(vmax, len(sub(c.position, prev)) / TICK_DT);
        prev = c.position;
        fmax = Math.max(fmax, Number(r.out('p', 'force')));
        if (r.out('p', 'overloaded') === true) over = true;
        if (leftAt < 0 && c.position.y < CHASSIS.height + size / 2 - 0.02) leftAt = (k + 1) * TICK_DT;
      }
      const c = r.entity('crate')!;
      const b1 = r.entity('body')!.position;
      const head1 = r.world.getEntity(String(r.out('p', 'tip')))!.position;
      say(`| ${crateKg} | ${f2(payload)} | ${f2(fmax)} | ${over ? 'yes' : 'no'} | ${leftAt < 0 ? 'never' : f2(leftAt)} | ${f2(Math.hypot(c.position.x - b1.x, c.position.z - b1.z))} / ${f2(tiltOfTurn(c.rotation))} | ${f2(vmax)} | ${mm(len(sub(b1, b0)))} |`);
      say(`<!-- crate ${f2(c0.x)},${f2(c0.y)},${f2(c0.z)} -> ${f2(c.position.x)},${f2(c.position.y)},${f2(c.position.z)}; head ${f2(head0.x)},${f2(head0.y)},${f2(head0.z)} -> ${f2(head1.x)},${f2(head1.y)},${f2(head1.z)}; positionNow ${r.out('p', 'positionNow')} -->`);
      r.world.dispose?.();
    }
  });
  it('h) sensing "the tray is loaded" with a zone that follows the chassis and counts items', () => {
    const say = report('s1h-loaded-zone.md');
    say('| tray | crate | zone count | zone inside |');
    say('|---|---|---|---|');
    for (const noCrate of [true, false]) {
      const r = build({ variant: 'beam', crateKg: 1, clearance: 0.1, noCrate, extraNodes: [['load', 'zone', { center: { x: 0, y: 0.75, z: 0 }, size: { x: 1, y: 0.6, z: 1 }, filter: 'item', rule: 'center', rotate: 'yes' }]], extraWires: [['body', 'self', 'load', 'follow']] });
      watch(r, 1, 0);
      say(`| beam | ${noCrate ? 'none' : '1 kg on tray'} | ${r.out('load', 'count')} | ${r.out('load', 'inside')} |`);
      r.world.dispose?.();
    }
  });
});
