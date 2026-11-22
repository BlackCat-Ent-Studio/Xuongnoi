import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ParamValue } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { buildFloor, line, runFloor, type Approach } from './grid-rig';

/** Measuring spike: which "Đi tới điểm" settings and which cell size carry 6 robots best (300 s each). */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const LOG = process.env.SPIKE_LOG ?? 'tests/spike-grid/spike-log.txt';
const say = (text: string): void => {
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
};

const DRIVES: [string, Record<string, ParamValue>][] = [
  ['default p0.6 slow1.0', {}],
  ['p0.6 slow0.5', { slowDistance: 0.5 }],
  ['p0.8 slow0.6', { power: 0.8, slowDistance: 0.6 }],
  ['p1.0 slow0.8', { power: 1, slowDistance: 0.8 }],
  ['p1.0 slow0.5', { power: 1, slowDistance: 0.5 }],
];

describe('drive settings, 6 robots, pitch 1.4, 300 s', () => {
  it.each((['hold', 'hold-flow'] as Approach[]).flatMap((a) => DRIVES.map(([name, drive]) => [a, name, drive] as const)))('%s, %s', (approach, name, drive) => {
    const x = runFloor(buildFloor({ robots: 6, pitch: 1.4, approach, seed: 1, drive }, rapier), 300);
    say(line(`tune ${approach} [${name}]`, x));
    expect(x.minGap).toBeGreaterThan(0);
  });
});
