import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { overlapDepth } from '../helpers/chassis-metrics';
import { marker, navBot, navRig } from '../helpers/nav-rig';
import { CHASSIS, buildFloor, line, runFloor } from './grid-rig';

/**
 * Measuring spike: how much room a 90 degree turn on the spot needs. EXISTING pieces only in the two-robot cases: robot A
 * stands on a cell middle and is sent to the cell on its right, so "Đi tới điểm" turns it on the spot first; robot B
 * stands still one cell away. The gap between the two chassis outlines is taken on every tick of the turn.
 */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const LOG = process.env.SPIKE_LOG ?? 'tests/spike-grid/spike-log.txt';
const say = (text: string): void => {
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
};

type Where = 'ahead' | 'behind' | 'left';

/** A at (0,0) heading east turns to drive south (+z). B one pitch away: ahead (east), behind (west) or on the left (north). */
function turnBeside(pitch: number, where: Where, bHeading: number, bTurnsToo: boolean) {
  const at = where === 'ahead' ? { x: pitch, z: 0 } : where === 'behind' ? { x: -pitch, z: 0 } : { x: 0, z: -pitch };
  const a = navBot({ id: 'a', x: 0, z: 0, heading: 0, length: CHASSIS.length, width: CHASSIS.width });
  const b = navBot({ id: 'b', x: at.x, z: at.z, heading: bHeading, length: CHASSIS.length, width: CHASSIS.width });
  const rig = navRig(
    [marker(1, 0, pitch, pitch), marker(2, at.x, at.z + pitch, pitch), ...a.nodes, ...b.nodes, ['start', 'on-start', {}]],
    [...a.wires, ...b.wires, ['m1', 'self', 'a-go', 'target'], ['start', 'started', 'a-go', 'go'], ...(bTurnsToo ? ([['m2', 'self', 'b-go', 'target'], ['start', 'started', 'b-go', 'go']] as [string, string, string, string][]) : [])],
    rapier,
  );
  let minGap = Infinity;
  let drift = 0;
  let turned = 0;
  for (let k = 0; k < Math.round(6 / TICK_DT); k++) {
    rig.tick();
    const va = rig.entity('a')!;
    const vb = rig.entity('b')!;
    const deg = (va.robot!.heading * 180) / Math.PI;
    // Only the turn on the spot counts: stop once the nose is within 5 degrees of south, before A drives off.
    if (Math.abs(deg - 90) < 5) {
      turned = (k + 1) * TICK_DT;
      break;
    }
    minGap = Math.min(minGap, -overlapDepth(va, vb));
    drift = Math.max(drift, Math.hypot(va.position.x, va.position.z));
  }
  return { minGap, drift, turned };
}

const PITCHES = [0.95, 1, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4];

describe('a 90 degree turn on the spot beside a neighbour', () => {
  it('gap by cell size and by where the neighbour stands', () => {
    const cases: [string, Where, number, boolean][] = [
      ['neighbour ahead, nose to tail, standing', 'ahead', 0, false],
      ['neighbour behind, nose to tail, standing', 'behind', 0, false],
      ['neighbour on the left, across, standing', 'left', 0, false],
      ['neighbour on the left, along its own lane (side on), standing', 'left', 90, false],
      ['neighbour ahead, turning at the same time', 'ahead', 0, true],
    ];
    const half = Math.hypot(CHASSIS.length, CHASSIS.width) / 2;
    say(`TURN chassis ${CHASSIS.length} x ${CHASSIS.width} m: half diagonal ${(half * 1000).toFixed(0)} mm; by geometry a turn beside a neighbour standing nose to tail needs a cell of ${(half + CHASSIS.length / 2).toFixed(3)} m, beside a neighbour that turns too ${(2 * half).toFixed(3)} m`);
    for (const [name, where, heading, both] of cases) {
      const row = PITCHES.map((p) => {
        const t = turnBeside(p, where, heading, both);
        return `${p.toFixed(2)} m: ${(t.minGap * 1000).toFixed(0)} mm (drift ${(t.drift * 1000).toFixed(0)}, ${t.turned ? `${t.turned.toFixed(1)} s` : 'not turned in 6 s'})`;
      });
      say(`TURN ${name}: ${row.join(' | ')}`);
    }
    expect(turnBeside(1.4, 'ahead', 0, false).minGap).toBeGreaterThan(0);
  });
});

describe('the whole floor at smaller cells: 6 robots, "Giữ ô" with early asking, 300 s', () => {
  it.each([1.0, 1.05, 1.1, 1.15, 1.2, 1.3, 1.4, 1.6])('cell %s m', (pitch) => {
    const x = runFloor(buildFloor({ robots: 6, pitch, approach: 'hold-flow', seed: 20261122, drive: { power: 0.8, slowDistance: 0.6 } }, rapier), 300);
    say(line(`PITCH ${pitch.toFixed(2)} hold-flow tuned x6`, x));
    expect(x.middleInHoleTicks).toBe(0);
  });
});
