import { describe, expect, it } from 'vitest';
import { planPush, type Box, type PushBody } from '../../src/world/linear-actuator';
import { obbOf, quatFromAxes } from '../../src/world/oriented-box';

/**
 * A head that carries its exact outline meets a rigid crate by that outline. Hand numbers: a 0.4 m square head turned 45 degrees about z
 * (a diamond whose corner reaches 0.4 x sqrt(2) / 2 = 0.2828 m) moves along +x toward a 0.4 m crate whose bottom edge is 0.2 m up.
 * The diamond is only 0.2828 - 0.2 = 0.0828 m wide at that height, so it touches the crate's lower left corner after it has travelled
 * x0 - 0.2828 (x0 = the crate's centre), while its upright bounds (half 0.2828) would touch the crate after x0 - 0.4828.
 */
const S = Math.SQRT1_2;
const TURN_45_Z = quatFromAxes({ x: S, y: S, z: 0 }, { x: -S, y: S, z: 0 }, { x: 0, y: 0, z: 1 });
const HALF_DIAGONAL = 0.4 * Math.SQRT1_2;

function setup(x0: number, exact: boolean) {
  const outline = obbOf({ x: 0, y: 0, z: 0 }, { x: 0.4, y: 0.4, z: 0.4 }, TURN_45_Z);
  const head: Box = { pos: { x: 0, y: 0, z: 0 }, size: { x: 2 * HALF_DIAGONAL, y: 2 * HALF_DIAGONAL, z: 0.4 }, ...(exact ? { exact: outline } : {}) };
  const box = { pos: { x: x0, y: 0.4, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 } };
  const crate: PushBody = { id: 'c', box, massKg: 2, mu: 0.5, crossTol: 0.05, real: obbOf(box.pos, box.size) };
  return planPush({ head, dir: { x: 1, y: 0, z: 0 }, step: 0.5, bodies: [crate], solids: [], flat: null, probeContact: true });
}

describe('planPush with an exact head', () => {
  it('touches the crate corner at x0 - 0.2828 (within 0.2 mm), not at the upright bounds x0 - 0.4828', () => {
    const exact = setup(0.6, true);
    expect(Math.abs(exact.contactAt! - (0.6 - HALF_DIAGONAL))).toBeLessThan(0.0002);
    const fat = setup(0.6, false);
    expect(Math.abs(fat.contactAt! - (0.6 - 0.2 - HALF_DIAGONAL))).toBeLessThan(0.0002);
    // The upright bounds meet the crate 0.2 m before the real diamond does.
    expect(exact.contactAt! - fat.contactAt!).toBeGreaterThan(0.19);
  });

  it('the full step pushes the crate: one body is the load', () => {
    const plan = setup(0.6, true);
    expect(plan.loadIds).toEqual(['c']);
    expect(plan.requiredN).toBeGreaterThan(0);
  });
});
