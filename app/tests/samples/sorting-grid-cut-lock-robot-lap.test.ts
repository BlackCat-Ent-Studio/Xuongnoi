import { beforeAll, describe } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { loadRapier } from '../../src/world/rapier-loader';
import { robotLockCuts } from '../helpers/grid-lock-cuts';
import { cutTests } from '../helpers/grid-sample-cuts';

/** "Xe phân loại" without one wire of its lap: the robot ends up standing for good (see helpers/grid-lock-cuts.ts for the boards the wires are cut on). */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

describe('grid-floor sample, anti-forced: the robot takes a lap and comes back', () => {
  cutTests(robotLockCuts(true));
});
