import type * as THREE from 'three';
import type { EntityView, ViewMode } from '../engine/types';

/** One dressed-up object of the stage (a door, a button, a crate...) that replaces the plain box of an entity. */
export interface StageFigure {
  object: THREE.Object3D;
  /** Follows the entity (position, size, colour); `dt` is 0 on a still redraw. */
  update(e: EntityView, dt: number): void;
  /**
   * Set by figures that animate out instead of vanishing (a door that swings open). While the entity is hidden the
   * renderer keeps the figure and calls this with `dt`; it returns true once the figure may be removed.
   */
  fadeOut?(dt: number): boolean;
  dispose(): void;
}

/**
 * A look for the puzzle stage. The renderer asks it which role an entity plays and, for the roles it knows, builds a
 * figure instead of the plain box. Everything it returns is decoration: collision and game rules never read it.
 */
export interface StageTheme {
  /** Visual-only size factor of characters and of the items they carry (collision boxes stay as they are). */
  readonly characterScale: number;
  /** Where a crate held out front by the legs robot is drawn: distance ahead of the figure and height of its base. */
  readonly carryOffset: { reach: number; height: number };
  /** Warm light colours for the scene. */
  readonly light: { sky: number; ground: number; sun: number };
  /** Role of an entity for this view mode, or null to keep the default drawing. Cheap and pure. */
  roleOf(e: EntityView, mode: ViewMode): string | null;
  /** Called at the start of every sync with all entities, so figures can react to who stands where (a pressed button). */
  observe(entities: readonly EntityView[]): void;
  /** Builds the figure for a role. `all` is every entity of the scene (used to keep the scenery clear of them). */
  create(role: string, e: EntityView, all: readonly EntityView[], mode: ViewMode): StageFigure | null;
}
