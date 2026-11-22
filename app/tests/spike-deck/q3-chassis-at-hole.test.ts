import { beforeAll, describe, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { poseOf } from '../helpers/nav-rig';
import { CHASSIS, bot, deckRig, f, holeDeck, marker, seconds } from './deck-rig';

/**
 * SPIKE ONLY. Question 3: a chassis that drives over or beside a hole of the deck. The hole is at the origin; the robot drives
 * along +x on a line `offset` metres to the side of the hole centre.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TOP = 2.6;

interface Pass {
  /** Deepest the chassis bottom sank below the deck top (m). */
  sank: number;
  reached: boolean;
  endX: number;
  endY: number;
  /** Largest sideways drift from its line (m). */
  drift: number;
  seconds: number;
}

function pass(hole: number, offset: number, chassis = CHASSIS, power = 0.6): Pass {
  const b = bot({ id: 'r', x: -3, z: offset, floor: TOP, heading: 0, goal: 1, bare: true, chassis, drive: { power } });
  const r = deckRig([...holeDeck(TOP, 6, [0], [0], hole), marker(1, 3, offset, TOP, 0.4), ...b.nodes], b.wires, rapier);
  const out: Pass = { sank: 0, reached: false, endX: 0, endY: 0, drift: 0, seconds: -1 };
  for (let k = 0; k < seconds(15); k++) {
    r.tick();
    const e = r.entity('r')!;
    out.sank = Math.max(out.sank, TOP - (e.position.y - chassis.height / 2));
    out.drift = Math.max(out.drift, Math.abs(e.position.z - offset));
    if (!out.reached && r.out('r-go', 'arrived') === true) {
      out.reached = true;
      out.seconds = (k + 1) * TICK_DT;
    }
  }
  const p = poseOf(r.entity('r')!);
  out.endX = p.x;
  out.endY = r.entity('r')!.position.y;
  r.world.dispose?.();
  return out;
}

describe('SPIKE q3: a chassis driving over / beside a hole in a deck of blocks (deck top 2.6 m)', () => {
  it('0.9 x 0.7 m chassis (its square against blocks is 0.9 m): hole size x sideways offset of its line', () => {
    const rows = ['| hole m | line offset m | chassis side to hole edge m | sank m | reached the far side | end x | end y | sideways drift m |', '|---|---|---|---|---|---|---|---|'];
    for (const hole of [0.6, 0.7, 0.8, 0.9, 0.95, 1.0, 1.2, 1.5]) {
      for (const offset of [0, 0.1, 0.3, 0.7]) {
        const p = pass(hole, offset);
        rows.push(`| ${hole} | ${offset} | ${f(offset - hole / 2 - CHASSIS.width / 2, 2)} | ${f(p.sank, 4)} | ${p.reached ? `yes ${f(p.seconds, 1)} s` : 'NO'} | ${f(p.endX, 2)} | ${f(p.endY, 2)} | ${f(p.drift, 4)} |`);
      }
    }
    console.log(rows.join('\n'));
  });

  it('speed: full power over holes just wider than the square', () => {
    const rows = ['| hole m | power | sank m | reached | end x | end y |', '|---|---|---|---|---|---|'];
    for (const hole of [0.95, 1.0, 1.1, 1.2]) for (const power of [0.3, 0.6, 1]) {
      const p = pass(hole, 0, CHASSIS, power);
      rows.push(`| ${hole} | ${power} | ${f(p.sank, 4)} | ${p.reached ? 'yes' : 'NO'} | ${f(p.endX, 2)} | ${f(p.endY, 2)} |`);
    }
    console.log(rows.join('\n'));
  });

  it('a small 0.5 x 0.4 m chassis (square 0.5 m) over the 0.6 / 0.7 / 0.8 m holes', () => {
    const small = { length: 0.5, width: 0.4, height: 0.24 };
    const rows = ['| hole m | line offset m | sank m | reached | end x | end y |', '|---|---|---|---|---|---|'];
    for (const hole of [0.4, 0.6, 0.7, 0.8]) for (const offset of [0, 0.2, 0.5]) {
      const p = pass(hole, offset, small);
      rows.push(`| ${hole} | ${offset} | ${f(p.sank, 4)} | ${p.reached ? 'yes' : 'NO'} | ${f(p.endX, 2)} | ${f(p.endY, 2)} |`);
    }
    console.log(rows.join('\n'));
  });
});
