import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { listAllSamples } from '../../src/io';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { createWorld } from '../../src/world/world';

/**
 * A scripted human plays the two sample games that depend on loose items lying in the walking line, once with
 * "Va chạm thật" off and once on. Both must be won: the items now block the way, so the player has to jump over them,
 * but nothing may become unwinnable. No shipped sample is switched on by this test.
 */

type Step =
  /** Hold keys until the condition is true; `autoJump` jumps whenever the hero stops making progress (something solid is in the way). */
  | { hold: string[]; autoJump?: boolean; until: (hero: EntityView, ents: readonly EntityView[]) => boolean }
  /** Press keys for a few ticks. */
  | { tap: string[] };

const near = (ents: readonly EntityView[], ownerSuffix: string, hero: EntityView): number => {
  const e = ents.find((x) => x.ownerNodeId.endsWith(ownerSuffix));
  return e ? Math.hypot(e.position.x - hero.position.x, e.position.z - hero.position.z) : Infinity;
};

function play(id: string, steps: readonly Step[], on: boolean): { result: string; step: number } {
  registerAllNodes();
  const board = listAllSamples().find((s) => s.id === id)!.board;
  const world = createWorld(board.mode, on ? worldOptionsForGraph({ nodes: [], wires: [], settings: { solidBodies: true } }) : undefined);
  const rt = createRuntime(board.graph, world, board.mode);
  let n = 0;
  let tapTicks = 0;
  let lastX = Infinity;
  let stalled = 0;
  for (let i = 0; i < 90 * 60 && !world.ended && n < steps.length; i++) {
    const ents = world.entities();
    const hero = ents.find((e) => e.kind === 'character')!;
    const step = steps[n]!;
    const keys = new Set<string>();
    if ('tap' in step) {
      for (const k of step.tap) keys.add(k);
      if (++tapTicks >= 4) {
        tapTicks = 0;
        n++;
      }
    } else if (step.until(hero, ents)) {
      n++;
      continue;
    } else {
      for (const k of step.hold) keys.add(k);
      stalled = Math.abs(hero.position.x - lastX) < 0.002 ? stalled + 1 : 0;
      if (step.autoJump && stalled > 6) keys.add('Space');
    }
    lastX = hero.position.x;
    rt.tick({ keysDown: keys });
    world.step(TICK_DT);
  }
  return { result: world.ended ? world.ended.result : 'running', step: n };
}

const R = ['ArrowRight'];
const never = (): boolean => false;

const KEY_DOOR: Step[] = [
  { hold: R, until: (h, e) => near(e, 'key-item', h) < 0.95 },
  { tap: ['KeyE'] },
  { hold: R, autoJump: true, until: (h) => h.position.x >= 0.7 },
  { tap: ['KeyF'] },
  { hold: R, autoJump: true, until: never },
];

const PICKAXE_ROCK: Step[] = [
  { hold: R, autoJump: true, until: (h, e) => near(e, 'pickaxe-item', h) < 0.95 },
  { tap: ['KeyE'] },
  { hold: R, autoJump: true, until: (h, e) => near(e, 'rock-1', h) < 1.4 },
  { tap: ['KeyF'] },
  { hold: R, autoJump: true, until: never },
];

describe('Va chạm thật on: items lying in the walking line do not make a sample unwinnable', () => {
  for (const [id, steps] of [['key-door', KEY_DOOR], ['pickaxe-rock', PICKAXE_ROCK]] as const) {
    it(`${id}: the scripted player wins with the switch off and on`, { timeout: 120_000 }, () => {
      const off = play(id, [...steps], false);
      const on = play(id, [...steps], true);
      expect(off, 'switch off').toMatchObject({ result: 'win' });
      expect(on, 'switch on').toMatchObject({ result: 'win' });
    });
  }
});
