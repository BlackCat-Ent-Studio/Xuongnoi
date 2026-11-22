import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { GRID, buildFloor, line, runFloor, type Approach } from './grid-rig';
import { cellOf } from './experimental-nodes';

/** Measuring spike: where the sensing-only right of way locks up, robot by robot. */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const LOG = process.env.SPIKE_LOG ?? 'tests/spike-grid/spike-log.txt';
const say = (text: string): void => {
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
};

describe('eyes only', () => {
  it.each([['eyes', 3, 1], ['eyes', 4, 1], ['eyes', 6, 1], ['eyes-turn', 4, 1], ['eyes-turn', 6, 1], ['eyes-turn', 6, 2], ['eyes-turn', 8, 1]] as [Approach, number, number][])('%s, %s robots, seed %s, 300 s: state when it ends', (approach, robots, seed) => {
    const f = buildFloor({ robots, pitch: 1.4, approach, seed }, rapier);
    const x = runFloor(f, 300);
    say(line(`diag ${approach} x${robots} seed ${seed}`, x));
    for (const id of f.ids) {
      const v = f.rig.entity(id)!;
      const cell = Number(f.rig.out(`${id}-cell`, 'held'));
      say(`   ${id}: at (${(v.position.z / 1.4).toFixed(2)}, ${(v.position.x / 1.4).toFixed(2)}) heading ${((v.robot!.heading * 180) / Math.PI).toFixed(0)}, drives to cell (${cellOf(GRID, cell).join(',')}), goal (${cellOf(GRID, Number(f.rig.out(`${id}-jobs`, 'goal'))).join(',')}), front eye ${f.rig.out(`${id}-eye`, 'blocked')} right eye ${f.rig.out(`${id}-eyeR`, 'blocked')} dwelling ${f.rig.out(`${id}-jobs`, 'dwelling')}`);
    }
    expect(x.minGap).toBeGreaterThan(-0.001);
  });
});
