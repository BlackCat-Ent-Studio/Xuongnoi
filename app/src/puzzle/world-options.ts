import type { ViewMode } from '../engine/types';
import type { WorldOptions } from '../world/world-options';
import { PUZZLE_LOOKS } from './types';

/** How much bigger than the base 1-unit body the stage draws every character. */
export const PUZZLE_CHARACTER_SCALE = 1.6;
/** Share of the base body width the collision box keeps, so arms and ears may stick out a little. */
const BOX_WIDTH = 1.3;
/** The stage props are laid out for a 2.9-unit robot; the figure is drawn PUZZLE_CHARACTER_SCALE tall. */
const STAGE_UNIT = PUZZLE_CHARACTER_SCALE / 2.9;

/**
 * The legs robot holds its crate out in front, low (the stage draws it that way). The physics holds it at
 * the same spot, so what is drawn is what can be blocked.
 */
export const LEGS_FRONT_CARRY = { reach: 1.19 * STAGE_UNIT, height: 0.55 * STAGE_UNIT };

/**
 * World rules for a puzzle level. Only the 3D levels get real bodies; the 2D levels keep the plain rules.
 */
export function puzzleWorldOptions(mode: ViewMode): WorldOptions | undefined {
  if (mode !== '3d') return undefined;
  const height = PUZZLE_CHARACTER_SCALE;
  return {
    solidBodies: true,
    // Base body is 1x1x1 centred on the position: keep the feet where they are and grow upward.
    characterBox: { size: { x: BOX_WIDTH, y: height, z: BOX_WIDTH }, offset: { x: 0, y: (height - 1) / 2, z: 0 } },
    frontCarryLooks: [PUZZLE_LOOKS.robotLegs, PUZZLE_LOOKS.robotWheel],
    frontCarry: LEGS_FRONT_CARRY,
  };
}
