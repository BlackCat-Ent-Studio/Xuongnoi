import type { PuzzleLevel } from '../types';
import { level01 } from './level-01';
import { level02 } from './level-02';
import { level03 } from './level-03';
import { level04 } from './level-04';
import { level05 } from './level-05';
import { level06 } from './level-06';
import { level07 } from './level-07';
import { level08 } from './level-08';

/** Every finished level, easy -> hard. One file per level so levels can be written in parallel. */
export const PUZZLE_LEVELS: readonly PuzzleLevel[] = [level01, level02, level03, level04, level05, level06, level07, level08]
  .filter((l): l is PuzzleLevel => l !== null)
  .sort((a, b) => a.order - b.order);
