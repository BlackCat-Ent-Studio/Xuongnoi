import { beforeAll, describe } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { loadRapier } from '../../src/world/rapier-loader';
import { mainLockCuts } from '../helpers/grid-lock-cuts';
import { cutTests } from '../helpers/grid-sample-cuts';

/** The main board without one wire of the lock number or of the button "Đổi lồng" (see helpers/grid-lock-cuts.ts for the boards the wires are cut on). */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

describe('grid-floor sample, anti-forced: the lock number and "Đổi lồng" on the main board', () => {
  cutTests(mainLockCuts());
});
