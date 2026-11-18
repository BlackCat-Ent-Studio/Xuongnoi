import { describe, expect, it } from 'vitest';
import { betweenFingers } from '../../src/nodes/gripper';
import { loadRapier } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { tipDegrees } from '../world/crate-helpers';

/**
 * A gripper judges a crate that tipped over by its real outline, and a crate it carries keeps its turn relative to the hand
 * (it turns with the arm and keeps that turn when let go) while real physics is on.
 */

const S = Math.SQRT1_2;
const X90 = { x: S, y: 0, z: 0, w: S };
const Z90 = { x: 0, y: 0, z: S, w: S };
const LONG = { x: 0.4, y: 2, z: 0.4 };
/** Hand pointing +x with fingers closing along z and the third direction up, opening 1 m. */
const axes = { approach: { x: 1, y: 0, z: 0 }, close: { x: 0, y: 0, z: 1 }, rise: { x: 0, y: 1, z: 0 } };
const grasp = { x: 0, y: 0, z: 0 };

describe('between the fingers uses the turned shape', () => {
  it('a 2 m crate standing up, or lying along the arm, fits a 1 m opening; lying across the fingers it does not', () => {
    // Standing: shadow on z is 0.4. Lying along x (quarter turn about z): 0.4 on z. Lying along z (quarter turn about x): 2 on z.
    expect(betweenFingers(grasp, LONG, grasp, axes, 1)).toBe(true);
    expect(betweenFingers(grasp, LONG, grasp, axes, 1, Z90)).toBe(true);
    expect(betweenFingers(grasp, LONG, grasp, axes, 1, X90)).toBe(false);
    expect(betweenFingers(grasp, LONG, grasp, axes, 2.1, X90)).toBe(true);
  });

  it('the grasp point has to be inside the turned outline along the arm: a crate lying along x reaches 1 m ahead, not 0.2 m', () => {
    const ahead = { x: 0.9, y: 0, z: 0 };
    expect(betweenFingers(grasp, LONG, ahead, axes, 1)).toBe(false);
    expect(betweenFingers(grasp, LONG, ahead, axes, 1, Z90)).toBe(true);
  });
});

describe('a crate carried by the gripper keeps its turn relative to the hand', () => {
  /**
   * Side view. The hand hangs straight down from a joint 3 m up (link 1 m, wrist 2 m up, grasp point 1.7 m up). The crate (0.4 m cube) is
   * between the fingers from the start (the key goes down on the second tick), its top 0.05 m above the grasp point and 0.1 m under the palm,
   * so the gripper holds it in the air. (Swung off a shelf by a hand that hangs from a joint this far away, the crate's lower corner would
   * dip into the shelf as it turns: the hand really has to lift first.)
   */
  async function arm() {
    const rapier = await loadRapier();
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 4 } }],
      ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 1 } }],
      ['go', 'on-start'],
      ['ang', 'const', { value: -90 }],
      ['j', 'joint', { start: -90, min: -90, max: 90, maxTorque: 100, mount: { x: 0, y: 2.5, z: 0 } }],
      ['l', 'link', { length: 1, mass: 0 }],
      ['g', 'gripper', { width: 1, grip: 'between', mass: 0 }],
      ['c', 'item', { shape: 'crate', position: { x: 0, y: 1.55, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 1 }],
      ['k', 'key', { key: 'Space' }],
    ];
    const wires: WireSpec[] = [
      ['ped', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['ang', 'value', 'j', 'angle'],
      ['j', 'tip', 'l', 'base'],
      ['l', 'tip', 'g', 'base'],
      ['k', 'held', 'g', 'close'],
    ];
    return rig(nodes, wires, '2d-side', false, true, rapier);
  }

  it('lifting the arm 30 degrees turns the held crate 30 degrees; letting go keeps that turn for the first moments of its fall', async () => {
    const r = await arm();
    // One tick first: the engine gives the crate its turn on its first step, and only a crate that has one is clamped as a rigid crate.
    r.tick(1);
    r.hold('Space');
    r.tick(10);
    expect(r.out('g', 'holding')).toBe(true);
    expect(tipDegrees(r.entity('c')!)).toBeLessThan(1);
    r.set('ang', { value: -60 });
    r.tick(90);
    expect(Number(r.out('j', 'angleNow'))).toBeCloseTo(-60, 0);
    expect(r.out('g', 'holding')).toBe(true);
    expect(tipDegrees(r.entity('c')!)).toBeCloseTo(30, 0);
    r.hold();
    r.tick(3);
    expect(r.out('g', 'holding')).toBe(false);
    // Free again: it falls, still turned the way the hand held it (a fall of 3 ticks cannot turn it by more than a few degrees).
    const after = tipDegrees(r.entity('c')!);
    expect(after).toBeGreaterThan(25);
    expect(after).toBeLessThan(40);
  });
});
