import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { poseOf } from '../helpers/nav-rig';
import type { NodeSpec } from '../helpers/arm-rig';
import { CARTON, bot, crateBottom, deckRig, f, holeDeck, marker, seconds } from './deck-rig';

/**
 * SPIKE ONLY. Question 2: a deck with a hole made of plain blocks; a carton tipped from the side tray of a robot standing beside
 * the hole. Where does the carton end up?
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TOP = 2.6;

interface Drop {
  /** 'ground' = through the hole and at rest on the ground floor; 'deck' = lying on the deck; 'edge' = hanging in the hole; 'robot' = still on the robot. */
  where: 'ground' | 'deck' | 'edge' | 'robot' | 'lost';
  /** Rest place relative to the hole centre, along the dump direction and along the lane. */
  out: number;
  along: number;
  y: number;
  /** Seconds from the tilt command until it lay still on the ground. */
  settle: number;
  /** Highest point its lowest corner reached again after it first touched the ground (bounce). */
  bounce: number;
  arrivedAt: number;
  stopErr: number;
  minY: number;
  /** Where (out of the hole centre) and how fast sideways (m/s) its centre passed the underside of the deck; NaN = never. */
  crossOut: number;
  crossSpeed: number;
  /** Where its lowest corner first came within a centimetre of the ground. */
  touchOut: number;
}

interface Case {
  hole: number;
  /** Metres from the robot's centre line to the hole centre. */
  d: number;
  kg?: number;
  side?: 1 | -1;
  /** Heading the robot stands at while it dumps (the hole is then to that side of it). */
  heading?: number;
  /** Drive this far along the lane first (0 = stands there from the start and tips at once). */
  ride?: number;
  tilt?: number;
  /** Stop this far past the hole centre along the lane. */
  past?: number;
  /** What stands under the hole: nothing, a cage (four 1 m walls round 0.8 x 0.8 m), or that cage plus a shaft hanging from the hole down to 1.1 m. */
  under?: 'bare' | 'cage' | 'shaft';
  jointSpeed?: number;
}

const WALL = 0.05;
/** Four thin walls round a square of inner side `inner`, from height y0 to y1, centred on the origin. */
function walls(prefix: string, inner: number, y0: number, y1: number): NodeSpec[] {
  const h = inner / 2 + WALL / 2;
  const y = (y0 + y1) / 2;
  const long = inner + 2 * WALL;
  return [
    [`${prefix}a`, 'block', { position: { x: h, y, z: 0 }, size: { x: WALL, y: y1 - y0, z: long } }],
    [`${prefix}b`, 'block', { position: { x: -h, y, z: 0 }, size: { x: WALL, y: y1 - y0, z: long } }],
    [`${prefix}c`, 'block', { position: { x: 0, y, z: h }, size: { x: inner, y: y1 - y0, z: WALL } }],
    [`${prefix}d`, 'block', { position: { x: 0, y, z: -h }, size: { x: inner, y: y1 - y0, z: WALL } }],
  ];
}

function drop(c: Case): Drop {
  const side = c.side ?? 1;
  const heading = c.heading ?? 0;
  const rad = (heading * Math.PI) / 180;
  // The robot's right is (-sin, cos) of its heading on (x, z); the hole is at the origin.
  const rx = -Math.sin(rad) * side;
  const rz = Math.cos(rad) * side;
  const fx = Math.cos(rad);
  const fz = Math.sin(rad);
  const past = c.past ?? 0;
  const stop = { x: -rx * c.d + fx * past, z: -rz * c.d + fz * past };
  const ride = c.ride ?? 0;
  const start = { x: stop.x - fx * ride, z: stop.z - fz * ride };
  const b = bot({ id: 'r', x: start.x, z: start.z, floor: TOP, heading, side, crateKg: c.kg ?? 2, tilt: c.tilt ?? 35, ...(ride > 0 ? { goal: 1, face: heading } : { tipNow: true }) });
  if (c.jointSpeed !== undefined) b.nodes.find((n) => n[0] === 'r-tilt')![2]!.maxSpeed = c.jointSpeed;
  const under = c.under ?? 'bare';
  const extra: NodeSpec[] = [...(under !== 'bare' ? walls('cage', 0.8, 0, 1) : []), ...(under === 'shaft' ? walls('shaft', c.hole, 1.1, TOP - 0.2) : [])];
  const r = deckRig([...holeDeck(TOP, 6, [0], [0], c.hole), ...extra, marker(1, stop.x, stop.z, TOP, 0.4), ...b.nodes], b.wires, rapier);
  const out: Drop = { where: 'lost', out: 0, along: 0, y: 0, settle: -1, bounce: 0, arrivedAt: ride > 0 ? -1 : 0, stopErr: 0, minY: Infinity, crossOut: NaN, crossSpeed: NaN, touchOut: NaN };
  let touched = false;
  let prevOut = 0;
  let still = 0;
  for (let k = 0; k < seconds(ride > 0 ? 22 : 7); k++) {
    r.tick();
    const t = (k + 1) * TICK_DT;
    if (out.arrivedAt < 0) {
      if (r.out('r-go', 'arrived') === true) out.arrivedAt = t;
      continue;
    }
    const crate = r.entity('r-crate')!;
    const low = crateBottom(crate);
    out.minY = Math.min(out.minY, low);
    if (Number.isNaN(out.crossOut) && crate.position.y < TOP - 0.2) {
      out.crossOut = crate.position.x * rx + crate.position.z * rz;
      out.crossSpeed = (out.crossOut - prevOut) / TICK_DT;
    }
    prevOut = crate.position.x * rx + crate.position.z * rz;
    if (!touched && low < 0.01) {
      touched = true;
      out.touchOut = prevOut;
    }
    else if (touched) out.bounce = Math.max(out.bounce, low);
    if (t - out.arrivedAt > 7) break;
    if (touched && out.settle < 0) {
      // Still = it moved less than a millimetre over a quarter of a second.
      still = Math.hypot(crate.position.x, crate.position.y, crate.position.z);
      if (k % 15 === 0) {
        const was = (r as unknown as { last?: number }).last;
        if (was !== undefined && Math.abs(was - still) < 1e-3) out.settle = t - out.arrivedAt;
        (r as unknown as { last?: number }).last = still;
      }
    }
  }
  const crate = r.entity('r-crate')!;
  const body = poseOf(r.entity('r')!);
  out.stopErr = Math.hypot(body.x - stop.x, body.z - stop.z);
  out.y = crate.position.y;
  out.out = crate.position.x * rx + crate.position.z * rz;
  out.along = crate.position.x * fx + crate.position.z * fz;
  const low = crateBottom(crate);
  out.where = low < 0.02 && low > -0.02 ? 'ground' : low < -0.02 ? 'lost' : Math.abs(low - TOP) < 0.03 ? 'deck' : low > TOP + 0.03 ? 'robot' : 'edge';
  r.world.dispose?.();
  return out;
}

describe('SPIKE q2: a carton tipped sideways into a hole of a deck made of blocks (deck top 2.6 m)', () => {
  it('sweep: hole size x distance from the robot centre line to the hole centre (robot stands, tips at once, 2 kg)', () => {
    const rows = ['| hole m | d m | near edge from centre line | where | out of hole centre | along | rest y | bounce m | settle s |', '|---|---|---|---|---|---|---|---|---|'];
    for (const hole of [0.6, 0.7, 0.8]) {
      for (const d of [0.55, 0.65, 0.75, 0.85, 1.0]) {
        const res = drop({ hole, d });
        rows.push(`| ${hole} | ${d} | ${f(d - hole / 2, 2)} | ${res.where} | ${f(res.out)} | ${f(res.along)} | ${f(res.y)} | ${f(res.bounce)} | ${f(res.settle, 2)} |`);
      }
    }
    console.log(rows.join('\n'));
  });

  it('a ride of 3 m, stop, square up, tip: 24 drops per hole size at the distance the sweep says is best', () => {
    for (const [hole, d] of [[0.6, 0.65], [0.7, 0.7], [0.8, 0.75]] as const) {
      const all: Drop[] = [];
      const tally: Record<string, number> = {};
      for (const kg of [1, 2, 5]) {
        for (const side of [1, -1] as const) {
          for (const heading of [0, 90, 180, 270]) {
            const res = drop({ hole, d, kg, side, heading, ride: 3 });
            all.push(res);
            tally[res.where] = (tally[res.where] ?? 0) + 1;
          }
        }
      }
      const through = all.filter((x) => x.where === 'ground');
      const stat = (xs: number[]): string => (xs.length === 0 ? '-' : `${f(Math.min(...xs))}..${f(Math.max(...xs))} (mean ${f(xs.reduce((a, c) => a + c, 0) / xs.length)})`);
      console.log(
        `hole ${hole} m, robot centre line ${d} m from the hole centre, 24 rides: ${JSON.stringify(tally)}\n` +
          `  rest out of hole centre: ${stat(through.map((x) => x.out))}\n  rest along the lane: ${stat(through.map((x) => x.along))}\n` +
          `  radius from hole centre: ${stat(through.map((x) => Math.hypot(x.out, x.along)))}\n  rest y (centre): ${stat(through.map((x) => x.y))}\n` +
          `  bounce: ${stat(through.map((x) => x.bounce))}\n  settle s after "Đã tới": ${stat(through.filter((x) => x.settle > 0).map((x) => x.settle))}\n` +
          `  lowest point ever: ${stat(all.map((x) => x.minY))}\n  robot stop error: ${stat(all.map((x) => x.stopErr))}\n  arrived s: ${stat(all.map((x) => x.arrivedAt))}`,
      );
      expect(all.length).toBe(24);
    }
  });

  it('stop error along the lane: how far past the hole centre may the robot stop (hole 0.7, d 0.7)', () => {
    const rows = ['| past m | where | out | along |', '|---|---|---|---|'];
    for (const past of [-0.3, -0.2, -0.1, 0, 0.1, 0.2, 0.3]) {
      const res = drop({ hole: 0.7, d: 0.7, past });
      rows.push(`| ${past} | ${res.where} | ${f(res.out)} | ${f(res.along)} |`);
    }
    console.log(rows.join('\n'));
  });

  it('what catches it below: bare ground, a 0.8 m cage with 1 m walls, the cage with a shaft from the hole; tilt speed 60 and 20 degrees/s (hole 0.7, d 0.7, 24 rides each)', () => {
    const rows = ['| under | tilt deg/s | on ground | in the 0.8 m square under the hole | hung up (not on the ground) | passes deck underside at (out of hole centre) | sideways speed there m/s | first ground touch out | rest out | rest along |', '|---|---|---|---|---|---|---|---|---|---|'];
    const stat = (xs: number[]): string => {
      const ok = xs.filter((x) => !Number.isNaN(x));
      return ok.length === 0 ? '-' : `${f(Math.min(...ok), 2)}..${f(Math.max(...ok), 2)} (mean ${f(ok.reduce((a, c) => a + c, 0) / ok.length, 2)})`;
    };
    for (const under of ['bare', 'cage', 'shaft'] as const) {
      for (const jointSpeed of [60, 20]) {
        const all: Drop[] = [];
        for (const kg of [1, 2, 5]) for (const side of [1, -1] as const) for (const heading of [0, 90, 180, 270]) all.push(drop({ hole: 0.7, d: 0.7, kg, side, heading, ride: 3, under, jointSpeed }));
        const ground = all.filter((x) => x.where === 'ground');
        const inside = ground.filter((x) => Math.abs(x.out) < 0.4 && Math.abs(x.along) < 0.4);
        rows.push(`| ${under} | ${jointSpeed} | ${ground.length}/24 | ${inside.length}/24 | ${all.length - ground.length} (${all.filter((x) => x.where !== 'ground').map((x) => `${x.where}@y${f(x.y, 2)}`).join(' ')}) | ${stat(all.map((x) => x.crossOut))} | ${stat(all.map((x) => x.crossSpeed))} | ${stat(all.map((x) => x.touchOut))} | ${stat(ground.map((x) => x.out))} | ${stat(ground.map((x) => x.along))} |`);
      }
    }
    console.log(rows.join('\n'));
  });

  it('carton size check', () => {
    expect(Math.max(CARTON.x, CARTON.y, CARTON.z)).toBeLessThan(0.6);
  });
});
