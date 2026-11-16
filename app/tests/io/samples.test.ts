import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type InputSnapshot } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { pickFollowTarget } from '../../src/render/cameras';
import { findPlanePath, planeGridFor } from '../../src/world/navigation';
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

  it('lists the samples with distinct ids and the expected modes', () => {
    expect(samples.map((s) => s.id)).toEqual(['side-stars', 'top-collect', '3d-hop', 'key-door', 'pickaxe-rock', 'guard-patrol', 'cleaner-bot', 'maze-chase', 'platform-bot', 'arena', 'race', 'dice-zones', 'portal-camera', 'dodge-shoot', 'city-delivery', 'city-delivery-3d', 'robot-arm']);
    expect(samples.map((s) => s.board.mode)).toEqual(['2d-side', '2d-top', '3d', '2d-side', '2d-side', '2d-top', '2d-top', '2d-top', '2d-side', '2d-side', '2d-top', '2d-side', '2d-side', '2d-side', '2d-top', '3d', '2d-side']);
    for (const s of samples) expect(s.label.length).toBeGreaterThan(0);
  });

  it('returns independent copies', () => {
    listSamples()[0]!.board.name = 'changed';
    expect(listSamples()[0]!.board.name).not.toBe('changed');
  });

  for (const s of samples) {
    it(`${s.id}: parses and runs 600 idle ticks without error`, { timeout: 60_000 }, () => {
      const res = parseBoard(serializeBoard(s.board));
      expect(res.ok).toBe(true);
      const { world, step } = start(s.board);
      expect(() => {
        for (let i = 0; i < 600; i++) step(keys());
      }).not.toThrow();
      expect(world.entities().length).toBeGreaterThan(0);
      // The bot-only boards play themselves; the platform bot reaches its star within ten seconds and the arena bot beats an idle player.
      if (s.id !== 'platform-bot' && s.id !== 'arena' && s.id !== 'dodge-shoot') expect(world.ended).toBeNull();
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
    for (let i = 0; i < 3; i++) step(keys());
    expect(world.hudItems().find((h) => h.key === 'hint-1')!.hidden).toBe(true); // hint goes away once the door is open
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

describe('guard-patrol sample', () => {
  const board = () => listSamples().find((s) => s.id === 'guard-patrol')!.board;
  const withPlayerAt = (x: number, z: number) => {
    const b = board();
    b.graph.nodes.find((n) => n.id === 'player')!.params.position = { x, y: 0.5, z };
    return b;
  };
  const guardX = (g: ReturnType<typeof start>): number => Number(g.rt.getOutput('guard', 'x'));

  it('the guard walks its beat without noticing a far-away player', () => {
    const g = start(board());
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 60 * 14; i++) {
      g.step(keys());
      min = Math.min(min, guardX(g));
      max = Math.max(max, guardX(g));
    }
    expect(min).toBeLessThan(-3.5);
    expect(max).toBeGreaterThan(3.5);
    expect(g.rt.getOutput('chase-1', 'seeing')).toBe(false);
    expect(g.world.ended).toBeNull();
  });

  it('the guard chases and catches a player who stands still in its sight', () => {
    const g = start(withPlayerAt(-2, 3));
    for (let i = 0; i < 60 * 20 && !g.world.ended; i++) g.step(keys());
    expect(g.world.ended?.result).toBe('lose');
  });

  it('the camera follows the player, not the guard', () => {
    const g = start(board());
    g.step(keys());
    const followed = pickFollowTarget(g.world.entities())!;
    expect(followed.ownerNodeId).toBe('player');
    expect(g.world.entities().find((e) => e.ownerNodeId === 'guard')!.role).toBe('bot');
  });

  it('is won by: fetch the key along the wall, sneak past the guard, open the door, reach the goal', () => {
    const g = start(board());
    const hold = (n: number, ...k: string[]): void => {
      for (let i = 0; i < n && !g.world.ended; i++) g.step(keys(...k));
    };
    // Wait until the guard has gone to the far end, then run for the key up the left wall.
    for (let i = 0; i < 60 * 6 && guardX(g) < 3.5; i++) g.step(keys());
    hold(125, 'KeyW'); // z 4 -> against the north wall
    expect(g.world.entities().find((e) => e.ownerNodeId === 'door-1')!.visible).toBe(false);
    hold(190, 'KeyD'); // along the north wall, through the opened door
    hold(120, 'KeyS'); // down to the goal
    expect(g.world.ended?.result).toBe('win');
  });
});

describe('cleaner-bot sample', () => {
  const board = () => listSamples().find((s) => s.id === 'cleaner-bot')!.board;

  it('delivers all three crates unattended and wins', () => {
    const g = start(board());
    const counts: number[] = [];
    for (let i = 0; i < 60 * 90 && !g.world.ended; i++) {
      g.step(keys());
      const c = Number(g.rt.getOutput('counter-1', 'value'));
      if (counts[counts.length - 1] !== c) counts.push(c);
    }
    expect(counts).toEqual([0, 1, 2, 3]);
    expect(g.world.ended?.result).toBe('win');
    const crates = g.world.entities().filter((e) => e.kind === 'item');
    expect(crates).toHaveLength(3);
    expect(crates.every((e) => !e.visible)).toBe(true);
  });

  it('the camera falls back to the bot when there is no player', () => {
    const g = start(board());
    g.step(keys());
    expect(pickFollowTarget(g.world.entities())?.ownerNodeId).toBe('bot');
  });
});

describe('maze-chase sample', () => {
  const board = () => listSamples().find((s) => s.id === 'maze-chase')!.board;

  it('the bot finds its way through the walls and catches a player who stands still', () => {
    const g = start(board());
    for (let i = 0; i < 60 * 40 && !g.world.ended; i++) g.step(keys());
    expect(g.world.ended?.result).toBe('lose');
  });

  it('crosses the whole maze to a player waiting in the far corner', () => {
    const b = board();
    b.graph.nodes.find((n) => n.id === 'player')!.params.position = { x: 7.5, y: 0.5, z: 1.5 };
    b.graph.nodes.find((n) => n.id === 'bot')!.params.position = { x: -7.5, y: 0.5, z: -4.5 };
    const g = start(b);
    for (let i = 0; i < 60 * 40 && !g.world.ended; i++) g.step(keys());
    expect(g.world.ended?.result).toBe('lose');
  });

  it('can be won: running the maze route to the exit stays ahead of the bot', () => {
    const g = start(board());
    const find = (owner: string) => g.world.entities().find((e) => e.ownerNodeId === owner)!;
    const goal = find('goal-1').position;
    let keysNow: string[] = [];
    let route: { x: number; z: number }[] = [];
    for (let i = 0; i < 60 * 40 && !g.world.ended; i++) {
      const me = find('player');
      if (i % 30 === 0) {
        const grid = planeGridFor(g.world, { halfWidth: 0.5, height: 1 }, 0);
        route = grid ? (findPlanePath(grid, { x: me.position.x, z: me.position.z }, { x: goal.x, z: goal.z })?.points ?? []) : [];
      }
      while (route.length > 1 && Math.hypot(route[0]!.x - me.position.x, route[0]!.z - me.position.z) < 0.35) route.shift();
      const next = route[0] ?? { x: goal.x, z: goal.z };
      const dx = next.x - me.position.x;
      const dz = next.z - me.position.z;
      keysNow = [];
      if (dx > 0.1) keysNow.push('KeyD');
      else if (dx < -0.1) keysNow.push('KeyA');
      if (dz > 0.1) keysNow.push('KeyS');
      else if (dz < -0.1) keysNow.push('KeyW');
      g.step(keys(...keysNow));
    }
    expect(g.world.ended?.result).toBe('win');
  });
});

describe('platform-bot sample', () => {
  const board = () => listSamples().find((s) => s.id === 'platform-bot')!.board;

  it('the bot drops down, climbs the ledges, leaps the gap and takes the star', () => {
    const g = start(board());
    const bot = () => g.world.entities().find((e) => e.ownerNodeId === 'bot')!;
    let highest = 0;
    for (let i = 0; i < 60 * 40 && !g.world.ended; i++) {
      g.step(keys());
      highest = Math.max(highest, bot().position.y);
    }
    expect(g.world.ended?.result).toBe('win');
    expect(highest).toBeGreaterThan(4.4);
    expect(bot().position.x).toBeGreaterThan(10);
  });
});

describe('file names', () => {
  it('strips illegal characters and falls back when empty', () => {
    expect(safeFileName('a/b:c*')).toBe('a_b_c_');
    expect(safeFileName('Game mới')).toBe('Game mới');
    expect(safeFileName('  ..')).toBe('game');
  });
});

describe('key-door sample polish', () => {
  it('uses the padlock shape for the lock and floats a hint above it', () => {
    const board = listSamples().find((s) => s.id === 'key-door')!.board;
    const { world, step } = start(board);
    for (let i = 0; i < 5; i++) step(keys());
    const lock = world.entities().find((e) => e.ownerNodeId === 'lock-1')!;
    expect(lock.shape).toBe('lock');
    const hint = world.hudItems().find((h) => h.key === 'hint-1')!;
    expect(hint).toMatchObject({ text: 'Bấm F để mở', anchor: lock.id, hidden: false });
  });
});
