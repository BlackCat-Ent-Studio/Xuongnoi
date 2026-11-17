import type { Vec3 } from '../engine/types';

/**
 * Optional world behaviour switched on by a game that wants real bodies (the puzzle game's 3D levels).
 * The editor, the samples and the lessons create worlds without options and keep the plain rules:
 * only blocks (and vehicles) stop anyone, items and characters pass through each other.
 */
export interface WorldOptions {
  /**
   * Characters and free items are solid to each other, a carried item is part of its carrier (it cannot go
   * through walls or other bodies), drops pick a free spot and zones ignore carried items.
   */
  solidBodies?: boolean;
  /** Anything that falls off the world (far below the floor) goes back to where it started. Off when falling is part of the game. */
  respawnFallen?: boolean;
  /** Robots drive on wheel traction: each wheel pushes with at most motor force and grip, wheels can slip, turning has inertia. */
  realPhysics?: boolean;
  /** Collision box of every character, so it matches the figure that is drawn (position stays at the base box centre). */
  characterBox?: { size: Vec3; offset: Vec3 };
  /** Every character carries in front of it (a game whose figures have no hands up: the editor). Takes the place of frontCarryLooks. */
  frontCarryAll?: boolean;
  /** Characters with one of these looks carry in front of them at `frontCarry` instead of above the head. */
  frontCarryLooks?: readonly string[];
  /** Where a front-carried item rides: centre distance ahead of the character and the height of its bottom above the feet. */
  frontCarry?: { reach: number; height: number };
}
