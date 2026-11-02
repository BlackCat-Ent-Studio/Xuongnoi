import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type InputSnapshot } from '../../src/engine/types';
import { HANDBOOK } from '../../src/handbook';
import { registerAllNodes } from '../../src/nodes';
import { listSamples } from '../../src/io';
import { LESSONS } from '../../src/tutorial/lessons';
import { createWorld } from '../../src/world/world';
import type { WorldOptions } from '../../src/world/world-options';
import type { EntityView } from '../../src/engine/types';
import type { World } from '../../src/engine/types';

/** A named board to play headless: a sample, a lesson start board or a handbook try-board. */
export interface NamedBoard {
  id: string;
  group: 'sample' | 'lesson' | 'handbook';
  board: Board;
}

export function allBoards(): NamedBoard[] {
  registerAllNodes();
  const out: NamedBoard[] = [];
  for (const s of listSamples()) out.push({ id: `sample:${s.id}`, group: 'sample', board: s.board });
  for (const l of LESSONS) out.push({ id: `lesson:${l.id}`, group: 'lesson', board: l.createBoard() });
  for (const e of HANDBOOK) out.push({ id: `handbook:${e.kind}`, group: 'handbook', board: e.tryBoard() });
  return out;
}

/** Fixed key pattern so boards with a player also move: each 45 ticks a different key set is held. */
const PATTERN: string[][] = [
  [],
  ['ArrowRight'],
  ['ArrowRight', 'Space'],
  ['KeyE'],
  ['ArrowLeft'],
  ['ArrowUp'],
  ['KeyQ'],
  ['ArrowDown', 'Space'],
  ['KeyF'],
  ['KeyW', 'KeyD'],
  ['KeyZ'],
];

export function inputAt(tick: number): InputSnapshot {
  return { keysDown: new Set(PATTERN[Math.floor(tick / 45) % PATTERN.length]) };
}

const round = (_k: string, v: unknown): unknown => (typeof v === 'number' ? Math.round(v * 1e4) / 1e4 : v);
/** Same, but without the flag only solid-body worlds add, so an ON run can be compared with an OFF run. */
const roundNoCarried = (k: string, v: unknown): unknown => (k === 'carried' ? undefined : round(k, v));

function fnv(h: number, text: string): number {
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

export interface RunOptions {
  seconds: number;
  /** Called after each world step (the physics checker hooks in here). */
  onTick?: (tick: number, world: World) => void;
  /** Leave the solid-body-only `carried` flag out of the hash (to compare an ON run with an OFF run). */
  ignoreCarriedFlag?: boolean;
  /** Hash every Nth tick. */
  hashEvery?: number;
}

export interface RunResult {
  hash: string;
  ticks: number;
  ended: string | null;
  error: string | null;
  world: World | null;
}

/** Plays the board headless with the scripted input and hashes the full entity state every few ticks. */
export function runBoard(board: Board, worldOptions: WorldOptions | undefined, opts: RunOptions): RunResult {
  registerAllNodes();
  const every = opts.hashEvery ?? 2;
  let h = 2166136261;
  let ticks = 0;
  let world: World | null = null;
  try {
    world = createWorld(board.mode, worldOptions);
    const rt = createRuntime(board.graph, world, board.mode);
    const total = Math.round(opts.seconds / TICK_DT);
    for (let i = 0; i < total && !world.ended; i++) {
      rt.tick(inputAt(i));
      world.step(TICK_DT);
      ticks++;
      if (i % every === 0) h = fnv(h, JSON.stringify(world.entities() as readonly EntityView[], opts.ignoreCarriedFlag ? roundNoCarried : round));
      opts.onTick?.(i, world);
    }
    return { hash: (h >>> 0).toString(16), ticks, ended: world.ended ? JSON.stringify(world.ended) : null, error: null, world };
  } catch (err) {
    return { hash: 'error', ticks, ended: null, error: err instanceof Error ? err.message : String(err), world };
  }
}
