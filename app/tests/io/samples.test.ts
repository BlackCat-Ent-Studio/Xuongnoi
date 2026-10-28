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

  it('lists five samples with distinct ids and the expected modes', () => {
    expect(samples.map((s) => s.id)).toEqual(['side-stars', 'top-collect', '3d-hop', 'key-door', 'pickaxe-rock']);
    expect(samples.map((s) => s.board.mode)).toEqual(['2d-side', '2d-top', '3d', '2d-side', '2d-side']);
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

describe('key-door sample', () => {
  const board = () => listSamples().find((s) => s.id === 'key-door')!.board;

  it('is not won without opening the door', () => {
    const { world, step } = start(board());
    for (let i = 0; i < 600 && !world.ended; i++) step(keys('ArrowRight'));
    expect(world.ended).toBeNull();
  });

  it('is won by: walk to the key, pick it up, carry it to the lock, use it, walk to the goal', () => {
    const { world, rt, step } = start(board());
    const hold = (n: number, ...k: string[]): void => {
      for (let i = 0; i < n && !world.ended; i++) step(keys(...k));
    };
    for (let i = 0; i < 20; i++) step(keys());
    hold(25, 'ArrowRight'); // from x=-6 to about -3.9
    step(keys('KeyE'));
    step(keys());
    expect(rt.getOutput('carry-1', 'holding')).toBe(true);
    hold(70, 'ArrowRight'); // stops against the door
    step(keys('KeyF'));
    step(keys());
    step(keys());
    expect(world.entities().find((e) => e.ownerNodeId === 'door-1')!.visible).toBe(false);
    hold(200, 'ArrowRight');
    expect(world.ended?.result).toBe('win');
  });

  it('using the lock without holding the key does nothing', () => {
    const { world, step } = start(board());
    for (let i = 0; i < 20; i++) step(keys());
    for (let i = 0; i < 200; i++) step(keys('ArrowRight'));
    step(keys('KeyF'));
    for (let i = 0; i < 300; i++) step(keys('ArrowRight'));
    expect(world.ended).toBeNull();
  });
});

describe('pickaxe-rock sample', () => {
  const board = () => listSamples().find((s) => s.id === 'pickaxe-rock')!.board;

  function play() {
    const g = start(board());
    const hold = (n: number, ...k: string[]): void => {
      for (let i = 0; i < n && !g.world.ended; i++) g.step(keys(...k));
    };
    const walkTo = (x: number): void => {
      for (let i = 0; i < 400 && Number(g.rt.getOutput('character-1', 'x')) < x; i++) g.step(keys('ArrowRight'));
    };
    const tap = (code: string): void => {
      g.step(keys(code));
      g.step(keys());
      g.step(keys());
    };
    const rockVisible = (): boolean => g.world.entities().find((e) => e.ownerNodeId === 'rock-1')!.visible;
    for (let i = 0; i < 20; i++) g.step(keys());
    return { ...g, hold, walkTo, tap, rockVisible };
  }

  it('is not won without breaking the rock', () => {
    const { world, hold } = play();
    hold(900, 'ArrowRight');
    expect(world.ended).toBeNull();
  });

  it('is won by: take the pickaxe, walk to the rock, swing, walk to the goal', () => {
    const { world, rt, hold, walkTo, tap, rockVisible } = play();
    walkTo(-0.5);
    tap('KeyE');
    expect(rt.getOutput('hand-1', 'holding')).toBe(true);
    expect(rt.getOutput('pickaxe-item', 'inHand')).toBe(true);
    hold(120, 'ArrowRight'); // stops against the rock
    expect(rockVisible()).toBe(true);
    tap('KeyF');
    expect(rockVisible()).toBe(false);
    hold(300, 'ArrowRight');
    expect(world.ended?.result).toBe('win');
  });

  it('the sword cannot break the rock', () => {
    const { world, rt, hold, walkTo, tap, rockVisible } = play();
    walkTo(-4.6);
    tap('KeyE');
    expect(rt.getOutput('hand-1', 'tool')).toBe(world.entities().find((e) => e.ownerNodeId === 'sword-item')!.id);
    hold(200, 'ArrowRight'); // stops against the rock, still holding the sword
    tap('KeyF');
    expect(rockVisible()).toBe(true);
    hold(300, 'ArrowRight');
    expect(world.ended).toBeNull();
  });

  it('swinging an empty hand at the rock does nothing', () => {
    const { world, hold, tap, rockVisible } = play();
    hold(200, 'ArrowRight');
    tap('KeyF');
    expect(rockVisible()).toBe(true);
    hold(100, 'ArrowRight');
    expect(world.ended).toBeNull();
  });
});

describe('file names', () => {
  it('strips illegal characters and falls back when empty', () => {
    expect(safeFileName('a/b:c*')).toBe('a_b_c_');
    expect(safeFileName('Game mới')).toBe('Game mới');
    expect(safeFileName('  ..')).toBe('game');
  });
});
