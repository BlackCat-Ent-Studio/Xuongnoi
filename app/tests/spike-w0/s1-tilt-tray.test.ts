import { describe, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { f2, len, mm, report, sub } from './spike-lib';
import { MASSES, VARIANTS, build, max, min, onTray, series, watch, type Sample } from './s1-tray-rig';

describe('spike 1: tilt tray from joint + link on a robot-body, real physics', () => {
  it('a) chassis still, tray flat for 3 s', () => {
    const say = report('s1a-rest.md');
    say('| tray | crate kg | on tray at 3 s | drift along mm | drift sideways mm | gap under crate mm (last) | overlap depth mm max / last | tilt to tray deg max | crate speed max m/s (after 0.5 s) |');
    say('|---|---|---|---|---|---|---|---|---|');
    for (const variant of VARIANTS) {
      for (const crateKg of MASSES) {
        const r = build({ variant, crateKg });
        const rows = watch(r, 3, 0);
        const a = rows[29]!;
        const z = rows[rows.length - 1]!;
        const late = rows.slice(30);
        say(`| ${variant} | ${crateKg} | ${onTray(z, r.size) ? 'yes' : 'NO'} | ${mm(z.along - a.along)} | ${mm(z.lateral - a.lateral)} | ${mm(z.gap)} | ${mm(max(late.map((s) => s.overlap)))} / ${mm(z.overlap)} | ${f2(max(rows.map((s) => s.tiltToTray)))} | ${max(late.map((s) => s.speed)).toFixed(4)} |`);
        series(`a-${variant}-${crateKg}kg`, rows);
        r.world.dispose?.();
      }
    }
  });

  it('b) chassis drives straight with the tray flat, then brakes', () => {
    const say = report('s1b-drive.md');
    say('| tray | crate kg | drive | top speed m/s | peak accel / decel m/s2 | slide while speeding up mm | slide while braking mm | total slide mm | on tray at end | overlap depth mm max | tilt to tray deg max |');
    say('|---|---|---|---|---|---|---|---|---|---|---|');
    const drives = [
      { name: 'sample (2 x 6 N, 90 rpm, power 0.7)', motorN: 6, maxRpm: 90, power: 0.7 },
      { name: 'sample motors, power 1', motorN: 6, maxRpm: 90, power: 1 },
      { name: 'default motor (2 x 30 N, 120 rpm), power 1', motorN: 30, maxRpm: 120, power: 1 },
    ];
    for (const variant of VARIANTS) {
      for (const crateKg of MASSES) {
        for (const d of drives) {
          const r = build({ variant, crateKg, motorN: d.motorN, maxRpm: d.maxRpm });
          const settle = watch(r, 1, 0);
          const start = settle[settle.length - 1]!;
          const slideAxis = (s: Sample): number => (variant === 'side-slab' ? s.lateral : s.along);
          const go = watch(r, 3, 1, () => {
            r.set('pl', { value: d.power });
            r.set('pr', { value: d.power });
          });
          const stop = watch(r, 3, 4, () => {
            r.set('pl', { value: 0 });
            r.set('pr', { value: 0 });
          });
          const all = [...go, ...stop];
          const accel = all.map((s, k) => (k === 0 ? 0 : (s.bodySpeed - all[k - 1]!.bodySpeed) / TICK_DT));
          const endGo = go[go.length - 1]!;
          const end = stop[stop.length - 1]!;
          say(
            `| ${variant} | ${crateKg} | ${d.name} | ${f2(max(all.map((s) => s.bodySpeed)))} | ${f2(max(accel))} / ${f2(min(accel))} | ${mm(slideAxis(endGo) - slideAxis(start))} | ${mm(slideAxis(end) - slideAxis(endGo))} | ${mm(slideAxis(end) - slideAxis(start))} | ${onTray(end, r.size) ? 'yes' : 'NO'} | ${mm(max(all.map((s) => s.overlap)))} | ${f2(max(all.map((s) => s.tiltToTray)))} |`,
          );
          if (variant === 'slab' && crateKg === 1) series(`b-${variant}-${crateKg}kg-${d.motorN}N-${d.power}`, [...settle, ...all]);
          r.world.dispose?.();
        }
      }
    }
  });

  it('b2) chassis spins on the spot (motors +0.5 / -0.5) with the tray flat', () => {
    const say = report('s1b2-spin.md');
    say('| tray | crate kg | turned deg in 3 s | crate drift along mm | sideways mm | on tray at end | overlap depth mm max |');
    say('|---|---|---|---|---|---|---|');
    for (const variant of VARIANTS) {
      for (const crateKg of MASSES) {
        const r = build({ variant, crateKg });
        const settle = watch(r, 1, 0);
        const start = settle[settle.length - 1]!;
        const h0 = r.entity('body')!.robot!.heading;
        const spin = watch(r, 3, 1, () => {
          r.set('pl', { value: 0.5 });
          r.set('pr', { value: -0.5 });
        });
        const h1 = r.entity('body')!.robot!.heading;
        const rest = watch(r, 1, 4, () => {
          r.set('pl', { value: 0 });
          r.set('pr', { value: 0 });
        });
        const end = rest[rest.length - 1]!;
        say(`| ${variant} | ${crateKg} | ${f2(((h1 - h0) * 180) / Math.PI)} | ${mm(end.along - start.along)} | ${mm(end.lateral - start.lateral)} | ${onTray(end, r.size) ? 'yes' : 'NO'} | ${mm(max([...spin, ...rest].map((s) => s.overlap)))} |`);
        r.world.dispose?.();
      }
    }
  });

  it('c) chassis still, tray tilts to 30 and 45 degrees', () => {
    const say = report('s1c-tilt.md');
    say('| tray | crate kg | target deg | joint deg/s | joint reached (s) / overloaded ticks / peak load N.m | crate starts to slide (s, at deg) | leaves tray (s) | rests at x, y, z (m) / tilt deg | from chassis centre m | crate speed max m/s | overlap depth mm max while on tray | lowest crate centre y | chassis moved mm |');
    say('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    const cases: { target: number; jointSpeed: number; maxTorque?: number }[] = [
      { target: 30, jointSpeed: 30 },
      { target: 45, jointSpeed: 30 },
      { target: 45, jointSpeed: 90 },
      { target: 45, jointSpeed: 360 },
    ];
    for (const variant of VARIANTS) {
      for (const crateKg of MASSES) {
        for (const c of cases) {
          const r = build({ variant, crateKg, jointSpeed: c.jointSpeed });
          const settle = watch(r, 1, 0);
          const start = settle[settle.length - 1]!;
          const b0 = r.entity('body')!.position;
          const rows = watch(r, 8, 1, () => r.set('ang', { value: c.target }));
          const reached = rows.find((s) => Math.abs(s.angle - c.target) < 0.5);
          const slideAxis = (s: Sample): number => s.along;
          const slid = rows.find((s) => Math.abs(slideAxis(s) - slideAxis(start)) > 0.005);
          const left = rows.find((s) => !onTray(s, r.size));
          const end = rows[rows.length - 1]!;
          const carried = left ? rows.filter((s) => s.t < left.t) : rows;
          const b1 = r.entity('body')!.position;
          say(
            `| ${variant} | ${crateKg} | ${c.target} | ${c.jointSpeed} | ${reached ? f2(reached.t - 1) : `never (ends at ${f2(end.angle)})`} / ${rows.filter((s) => s.overloaded).length} / ${f2(max(rows.map((s) => s.load)))} | ${slid ? `${f2(slid.t - 1)}, ${f2(slid.angle)}` : 'never'} | ${left ? f2(left.t - 1) : 'never'} | ${f2(end.cx)}, ${f2(end.cy)}, ${f2(end.cz)} / ${f2(end.tiltToWorld)} | ${f2(Math.hypot(end.cx - end.bx, end.cz - end.bz))} | ${f2(max(rows.map((s) => s.speed)))} | ${mm(max(carried.map((s) => s.overlap)))} | ${f2(min(rows.map((s) => s.cy)))} | ${mm(len(sub(b1, b0)))} |`,
          );
          if (c.jointSpeed === 30) series(`c-${variant}-${crateKg}kg-${c.target}deg`, [...settle, ...rows]);
          r.world.dispose?.();
        }
      }
    }
  });
});
