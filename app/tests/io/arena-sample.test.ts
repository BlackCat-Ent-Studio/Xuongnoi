import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type InputSnapshot } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

function play() {
  registerAllNodes();
  const board = listAllSamples().find((s) => s.id === 'arena')!.board;
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  const step = (...k: string[]): void => {
    rt.tick(keys(...k));
    world.step(TICK_DT);
  };
  const num = (node: string, port: string): number => Number(rt.getOutput(node, port));
  const view = (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!;
  return { world, rt, step, num, view };
}

describe('arena sample', () => {
  it('an idle player loses: the bot wears the health down and the player falls', () => {
    const g = play();
    for (let i = 0; i < 60 * 40 && !g.world.ended; i++) g.step();
    expect(g.world.ended?.result).toBe('lose');
    expect(g.rt.getOutput('player-health', 'dead')).toBe(true);
    expect(g.num('bot-health', 'hp')).toBe(6);
  });

  it('bare hands work but are slow; picking up the sword wins the fight quickly', () => {
    const g = play();
    for (let i = 0; i < 20; i++) g.step();
    // Walk to the sword, take it (E).
    for (let i = 0; i < 200 && g.view('player').position.x < -4.4; i++) g.step('ArrowRight');
    g.step('KeyE');
    g.step();
    expect(g.rt.getOutput('player-hand', 'holding')).toBe(true);
    // Face the bot and swing whenever it is in reach.
    let swings = 0;
    for (let i = 0; i < 60 * 20 && !g.world.ended; i++) {
      const dx = g.view('bot').position.x - g.view('player').position.x;
      if (Math.abs(dx) < 1.5 && i % 25 === 0) {
        g.step('KeyF', dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        swings++;
      } else {
        g.step(dx > 1.2 ? 'ArrowRight' : dx < -1.2 ? 'ArrowLeft' : '');
      }
    }
    expect(g.world.ended?.result).toBe('win');
    expect(g.num('player-health', 'hp')).toBeGreaterThan(0);
    expect(swings).toBeGreaterThanOrEqual(2);
    expect(g.rt.getOutput('bot-health', 'dead')).toBe(true);
  });

  it('a punch (no tool) costs the bot one health', () => {
    const g = play();
    g.step();
    g.step();
    for (let i = 0; i < 60 * 10 && g.num('bot-health', 'hp') === 6; i++) {
      const dx = g.view('bot').position.x - g.view('player').position.x;
      g.step(...(Math.abs(dx) < 1.5 && i % 20 === 0 ? ['KeyF', 'ArrowRight'] : ['ArrowRight']));
    }
    expect(g.num('bot-health', 'hp')).toBe(5);
  });
});
