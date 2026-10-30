import type { Board, GameResult, Graph, Note, ViewMode } from '../engine/types';

/** Everything a step check may look at. Pure data, so checks are unit-testable. */
export interface Snapshot {
  graph: Graph;
  mode: ViewMode;
  playing: boolean;
  /** Result of the current play session once win/lose fired, else null. */
  ended: GameResult | null;
  /* Editor facts read by the board-tools lesson. Optional so plain snapshots stay valid; absent reads as none/false. */
  /** Ids of the selected nodes and notes. */
  selectedIds?: readonly string[];
  notes?: readonly Note[];
  /** True right after an undo, until something new is done. */
  canRedo?: boolean;
  /** Id of the group the canvas is inside, or null on the main board. */
  scope?: string | null;
}

/**
 * CSS selectors to pulse. A string is highlighted when found; an inner array is a
 * "first one that exists wins" group (e.g. property row, else the node itself).
 */
export type TargetList = (string | string[])[];

export interface Step {
  id: string;
  title: string;
  text: string;
  /** One or two sentences about the node introduced here. */
  explain?: string;
  target?: (snap: Snapshot) => TargetList;
  /** Auto-advance when true. Omit for pure-info steps (they show a "Tiếp" button). */
  check?: (snap: Snapshot) => boolean;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  /** Fresh board the lesson runs on. Called each time the lesson starts. */
  createBoard(): Board;
  steps: Step[];
}
