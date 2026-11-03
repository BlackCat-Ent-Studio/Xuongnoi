import type { PuzzleLevel } from '../types';
import { level01 } from './level-01';
import { level02 } from './level-02';
import { level03 } from './level-03';
import { level04 } from './level-04';
import { level05 } from './level-05';
import { level06 } from './level-06';
import { level07 } from './level-07';

/** Every finished level, easy -> hard (level 7 is the last). Retired levels live in ./archive and are not listed. One file per level. */
export const PUZZLE_LEVELS: readonly PuzzleLevel[] = [level01, level02, level03, level04, level05, level06, level07]
  .filter((l): l is PuzzleLevel => l !== null)
  .sort((a, b) => a.order - b.order);
