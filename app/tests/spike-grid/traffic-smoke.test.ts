import { appendFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { buildFloor, line, runFloor, type Approach } from './grid-rig';

/** Measuring spike: short runs to see that each robot circuit moves at all. Numbers go to the log file. */
let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const LOG = process.env.SPIKE_LOG ?? 'tests/spike-grid/spike-log.txt';
const say = (text: string): void => {
  console.log(text);
  appendFileSync(LOG, `${text}\n`);
};

describe('smoke: 120 s, pitch 1.4', () => {
  it.each([['hold', 2], ['hold', 6], ['hold-flow', 6], ['eyes', 2], ['eyes', 6]] as [Approach, number][])('%s with %s robots', (approach, robots) => {
    const x = runFloor(buildFloor({ robots, pitch: 1.4, approach, seed: 1 }, rapier), 120);
    say(line(`smoke ${approach} x${robots}`, x));
    expect(x.delivered).toBeGreaterThanOrEqual(0);
  });
});
