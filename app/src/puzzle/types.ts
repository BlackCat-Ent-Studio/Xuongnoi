import type { Graph, GraphNode, Params, ViewMode, Wire } from '../engine/types';
import type { StoreSlotsDef } from './store-slots';

/**
 * One puzzle level ("Xưởng Bot giải đố"). A level is a real Xưởng Nối board: the locked part lives in
 * `base` and the player adds pieces from the tray and wires. The level is won when a locked
 * "Thắng / Thua" (win-lose) node in `base` ends the game with a win.
 */
export interface PuzzleLevel {
  /** Stable id, used as the progress key (never renumber). Example: 'bot-dau-tien'. */
  id: string;
  /** 1-based position in the level list (easy -> hard). */
  order: number;
  title: string;
  /** Task text shown in the "Đề bài" box. */
  task: string;
  /** Text shown when the player taps "?" (using it costs the second star). */
  hint: string;
  /** View the level is played in. 3D levels also lock a camera node ("Máy quay") inside `base`. */
  mode: ViewMode;
  /** Character looks used in the level (informational, for the level list), e.g. ['robot-legs']. */
  cast: string[];
  /** Locked nodes, their params, canvas positions and any pre-joined wires. Must contain one win-lose node. */
  base: Graph;
  /**
   * Ports shown on a locked node's card, keyed by node id. Nodes not listed show all their ports.
   * Only ports listed here can be wired by the player on that node.
   */
  shownPorts?: Record<string, { in?: string[]; out?: string[] }>;
  /** Step run: also pause when a drawn move pin goes from 0 to moving, and light the cards one step before the fired card. */
  stepMoveBreaks?: boolean;
  /** Marked slots on the store pad: the delivering robot sets one crate in each, filling them in order. Level-side, never wired by the player. */
  storeSlots?: StoreSlotsDef;
  /** Pieces the player may place. Each placed copy becomes a node of `kind` with these params. */
  tray: TrayPiece[];
  /** Params the player may change (12b). Kept short: only where the puzzle needs it. */
  editable?: EditableParam[];
  /** Fewest tray pieces that solve the level; using at most this many (without the hint) gives 3 stars. */
  par: number;
  /** Times "?" may be pressed without losing a star (each press beyond costs one star, never below 1). */
  freeHints: number;
  /** Seconds of play before an unfinished run counts as failed. */
  timeLimit: number;
  /** Reference answer, used by tests (and by nobody in the UI). Node ids must not clash with `base`. */
  solution: PuzzleAnswer;
}

export interface TrayPiece {
  kind: string;
  /** How many copies the tray holds. */
  count: number;
  /** Params a placed copy starts with (on top of the node's defaults). */
  params?: Params;
}

/** A param the player may edit: on a locked node (`nodeId`) or on every placed copy of a tray `kind`. */
export interface EditableParam {
  nodeId?: string;
  kind?: string;
  paramId: string;
}

/** What the player added: placed tray pieces (with their params) and every wire they joined. */
export interface PuzzleAnswer {
  nodes: GraphNode[];
  wires: Wire[];
}

export type PuzzleOutcome = 'win' | 'lose' | 'timeout';

export interface PuzzleRunResult {
  outcome: PuzzleOutcome;
  /** Seconds of game time simulated until the end (or the time limit). */
  seconds: number;
  /** Message from the win-lose node, '' on timeout. */
  message: string;
}

/** Saved per level id in localStorage. */
export interface PuzzleProgress {
  stars: 0 | 1 | 2 | 3;
}

/** Character looks added for the puzzle game (values of the character node's `look` param). */
export const PUZZLE_LOOKS = {
  robotWheel: 'robot-wheel',
  robotLegs: 'robot-legs',
  catChibi: 'cat-chibi',
  catQuad: 'cat-quad',
} as const;
