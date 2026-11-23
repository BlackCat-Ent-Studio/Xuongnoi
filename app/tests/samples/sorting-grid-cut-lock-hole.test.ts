import { beforeAll, describe, expect, it } from 'vitest';
import { registerAllNodes } from '../../src/nodes';
import { CATCH_WIRES, GRID_MAIN_WIRES } from '../../src/samples/sorting-grid-floor';
import { ROBOT_WIRES } from '../../src/samples/sorting-grid-robot';
import { loadRapier } from '../../src/world/rapier-loader';
import { HOLE_ROWS, ROBOT_ROWS, holeLockCuts } from '../helpers/grid-lock-cuts';
import { HOLE_LOCK_WIRES, ROBOT_LOCK_WIRES, cutTests } from '../helpers/grid-sample-cuts';
import { shippedGrid } from '../helpers/grid-sample-run';

/** "Lỗ thả" without one wire of its lamp, its lock or its two plates (see helpers/grid-lock-cuts.ts for the boards the wires are cut on). */

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

describe('grid-floor sample, anti-forced: the lock wires', () => {
  it('every wire of the robot and of the hole that is not cut on the plain board is cut on a board where a hole locks', () => {
    const robot = ROBOT_WIRES.map((w) => w.join(' > '));
    const hole = CATCH_WIRES.map((w) => w.join(' > '));
    for (const name of ROBOT_LOCK_WIRES) expect(robot, name).toContain(name);
    for (const name of HOLE_LOCK_WIRES) expect(hole, name).toContain(name);
    expect(Object.keys(ROBOT_ROWS).sort()).toEqual([...ROBOT_LOCK_WIRES].sort());
    expect(Object.keys(HOLE_ROWS).sort()).toEqual([...HOLE_LOCK_WIRES].sort());
    expect(shippedGrid().graph.wires.length).toBe(GRID_MAIN_WIRES.length);
  });
});

describe('grid-floor sample, anti-forced: lamp, lock and plates of a hole', () => {
  cutTests(holeLockCuts());
});
