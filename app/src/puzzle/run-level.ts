import { createRuntime } from '../engine/runtime';
import { TICK_DT, type Graph, type InputSnapshot } from '../engine/types';
import { registerAllNodes } from '../nodes';
import { createWorld } from '../world/world';
import type { PuzzleAnswer, PuzzleLevel, PuzzleRunResult } from './types';

const NO_KEYS: InputSnapshot = { keysDown: new Set<string>() };

/** The board that actually runs: the level's locked part plus what the player added. */
export function buildPlayGraph(level: PuzzleLevel, answer: PuzzleAnswer): Graph {
  return {
    nodes: [...level.base.nodes, ...answer.nodes],
    wires: [...level.base.wires, ...answer.wires],
  };
}

/** Number of tray pieces the answer uses (what the three-star rule counts). */
export function piecesUsed(answer: PuzzleAnswer): number {
  return answer.nodes.length;
}

/**
 * Stars for a finished win: 3 within par pieces, else 2; then each "?" press beyond the level's
 * free hints costs one star, never below 1.
 */
export function starsFor(level: PuzzleLevel, answer: PuzzleAnswer, hintsUsed: number): 1 | 2 | 3 {
  const base = piecesUsed(answer) <= level.par ? 3 : 2;
  const over = Math.max(0, hintsUsed - level.freeHints);
  return Math.max(1, base - over) as 1 | 2 | 3;
}

/**
 * Plays the level headlessly with the same engine and world the game uses, no rendering.
 * Used by tests to prove each level is solvable and has no shortcut.
 */
export function runLevel(level: PuzzleLevel, answer: PuzzleAnswer, timeLimit = level.timeLimit): PuzzleRunResult {
  registerAllNodes();
  const world = createWorld(level.mode);
  const rt = createRuntime(buildPlayGraph(level, answer), world, level.mode);
  const maxTicks = Math.ceil(timeLimit / TICK_DT);
  let ticks = 0;
  for (; ticks < maxTicks && !world.ended; ticks++) {
    rt.tick(NO_KEYS);
    world.step(TICK_DT);
  }
  const ended = world.ended;
  if (!ended) return { outcome: 'timeout', seconds: ticks * TICK_DT, message: '' };
  return { outcome: ended.result === 'win' ? 'win' : 'lose', seconds: ticks * TICK_DT, message: ended.message };
}
