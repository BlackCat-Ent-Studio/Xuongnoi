import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type InputSnapshot } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';
import { listSamples, parseBoard, serializeBoard } from '../../src/io';
import { safeFileName } from '../../src/io/file-io';

const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

function start(board: Board) {
  registerAllNodes();
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  const step = (input: InputSnapshot): void => {
    rt.tick(input);
    world.step(TICK_DT);
  };
  return { world, rt, step };
}

describe('samples', () => {
  const samples = listSamples();

  it('lists three samples with distinct ids and the expected modes', () => {
    expect(samples.map((s) => s.id)).toEqual(['side-stars', 'top-collect', '3d-hop']);
    expect(samples.map((s) => s.board.mode)).toEqual(['2d-side', '2d-top', '3d']);
    for (const s of samples) expect(s.label.length).toBeGreaterThan(0);
  });

  it('returns independent copies', () => {
    listSamples()[0]!.board.name = 'changed';
    expect(listSamples()[0]!.board.name).not.toBe('changed');
  });

  for (const s of samples) {
    it(`${s.id}: parses and runs 600 idle ticks without error`, () => {
      const res = parseBoard(serializeBoard(s.board));
      expect(res.ok).toBe(true);
      const { world, step } = start(s.board);
      expect(() => {
        for (let i = 0; i < 600; i++) step(keys());
      }).not.toThrow();
      expect(world.entities().length).toBeGreaterThan(0);
      expect(world.ended).toBeNull();
    });
  }

  it('side-stars: held ArrowRight/Space moves the character without errors', () => {
    const { rt, world, step } = start(samples[0]!.board);
    for (let i = 0; i < 30; i++) step(keys());
    const x0 = Number(rt.getOutput('character-1', 'x'));
    let maxY = -Infinity;
    expect(() => {
      for (let i = 0; i < 120; i++) {
        step(keys('ArrowRight', 'Space'));
        maxY = Math.max(maxY, Number(rt.getOutput('character-1', 'y')));
      }
    }).not.toThrow();
    expect(Number(rt.getOutput('character-1', 'x'))).toBeGreaterThan(x0 + 1);
    expect(maxY).toBeGreaterThan(1.5);
    expect(world.hudItems().some((h) => h.label === 'Sao')).toBe(true);
  });

  it('side-stars: running into the gap without jumping loses by falling', () => {
    const { world, step } = start(samples[0]!.board);
    for (let i = 0; i < 400 && !world.ended; i++) step(keys('ArrowRight'));
    expect(world.ended?.result).toBe('lose');
  });

  it('side-stars: touching a star hides it and counts one', () => {
    const board = structuredClone(samples[0]!.board);
    const star = board.graph.nodes.find((n) => n.id === 'star-1')!;
    board.graph.nodes.find((n) => n.id === 'character-1')!.params.position = star.params.position!;
    const { rt, step } = start(board);
    for (let i = 0; i < 5; i++) step(keys());
    expect(rt.getOutput('counter-1', 'value')).toBe(1);
  });

  it('top-collect: timer ends the game with a loss after 30 s', () => {
    const { world, step } = start(samples[1]!.board);
    for (let i = 0; i < 31 * 60 && !world.ended; i++) step(keys());
    expect(world.ended?.result).toBe('lose');
  });

  it('3d-hop: falling loses', () => {
    const { world, step } = start(samples[2]!.board);
    for (let i = 0; i < 400 && !world.ended; i++) step(keys('KeyW'));
    expect(world.ended?.result).toBe('lose');
  });
});

describe('file names', () => {
  it('strips illegal characters and falls back when empty', () => {
    expect(safeFileName('a/b:c*')).toBe('a_b_c_');
    expect(safeFileName('Game mới')).toBe('Game mới');
    expect(safeFileName('  ..')).toBe('game');
  });
});
