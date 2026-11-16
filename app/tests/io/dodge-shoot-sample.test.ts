import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView, type InputSnapshot } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });

function play() {
  registerAllNodes();
  const board = listAllSamples().find((s) => s.id === 'dodge-shoot')!.board;
  const world = createWorld(board.mode);
  const rt = createRuntime(board.graph, world, board.mode);
  const step = (...k: string[]): void => {
    rt.tick(keys(...k));
    world.step(TICK_DT);
  };
  const find = (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!;
  const num = (node: string, port: string): number => Number(rt.getOutput(node, port));
  return { world, rt, step, find, num };
}

type Game = ReturnType<typeof play>;

/**
 * A scripted player: wait for the lift, ride it across, stand on the far bank, shoot, and sidestep falling rocks
 * (never off the platform or the bank edge).
 */
function autopilot(g: Game, ticks: number): void {
  for (let i = 0; i < ticks && !g.world.ended; i++) {
    const me = g.find('player');
    const lift = g.find('lift');
    const rocks = g.world.entities().filter((e) => e.ownerNodeId === 'rocks' && e.visible);
    const onLift = Math.abs(me.position.x - lift.position.x) < 1.5 && me.position.y < 1 && me.position.y > 0.3 && Math.abs(lift.position.x) < 3;
    const onRight = me.position.x > 3.5 && !onLift;
    const lo = onLift ? lift.position.x - 1.1 : onRight ? 4.2 : -11;
    const hi = onLift ? lift.position.x + 1.1 : onRight ? 7.1 : -4.6;

    let want: -1 | 0 | 1 = 0;
    const threat = rocks.find((r) => Math.abs(r.position.x - me.position.x) < 1.5);
    if (threat) {
      // Step to whichever side of the rock has room for a clear gap, preferring the side we are already on.
      const leftRoom = threat.position.x - 0.95 - 0.5 >= lo;
      const rightRoom = threat.position.x + 0.95 + 0.5 <= hi;
      const preferLeft = me.position.x < threat.position.x;
      want = preferLeft ? (leftRoom || !rightRoom ? -1 : 1) : rightRoom || !leftRoom ? 1 : -1;
    } else {
      const target = onLift ? lift.position.x : onRight ? 4.8 : lift.position.x < -2.3 ? -2.5 : -5.5;
      const dx = target - me.position.x;
      want = Math.abs(dx) < 0.15 ? 0 : dx > 0 ? 1 : -1;
      if (onLift && lift.position.x > 2.3) want = 1; // dismount at the far end
    }
    const shooting = me.position.x > -1 && g.rt.tickIndex % 24 === 0;
    g.step(...[want > 0 || shooting ? 'ArrowRight' : '', want < 0 ? 'ArrowLeft' : '', shooting ? 'KeyF' : ''].filter(Boolean));
  }
}

describe('dodge-shoot sample', () => {
  it('has all four object kinds', () => {
    const board = listAllSamples().find((s) => s.id === 'dodge-shoot')!.board;
    const kinds = new Set(board.graph.nodes.map((n) => n.kind));
    for (const k of ['moving-platform', 'rotating-platform', 'shooter', 'spawner']) expect(kinds.has(k)).toBe(true);
  });

  it('an idle player loses: a rock lands on them', () => {
    const g = play();
    for (let i = 0; i < 60 * 12 && !g.world.ended; i++) g.step();
    expect(g.world.ended?.result).toBe('lose');
    expect(g.world.ended?.message).toContain('đá');
  });

  it('walking into the pit loses', () => {
    const g = play();
    for (let i = 0; i < 60 * 6 && !g.world.ended; i++) g.step('ArrowRight');
    expect(g.world.ended?.result).toBe('lose');
  });

  it('the lift carries the player across the pit', () => {
    const g = play();
    let crossed = false;
    for (let i = 0; i < 60 * 20 && !g.world.ended && !crossed; i++) {
      autopilot(g, 1);
      crossed = g.find('player').position.x > 4;
    }
    expect(crossed).toBe(true);
    expect(g.world.ended).toBeNull();
  });

  it('the shield turns a quarter every three seconds', () => {
    const g = play();
    const sizes: number[] = [];
    for (let i = 0; i < 60 * 10; i++) {
      g.step();
      const s = g.find('shield').size;
      if (sizes[sizes.length - 1] !== s.x) sizes.push(s.x);
    }
    expect(sizes.slice(0, 3)).toEqual([0.5, 4, 0.5]);
  });

  it('can be won: ride the lift, dodge rocks, land three hits on the target', () => {
    const g = play();
    autopilot(g, 60 * 90);
    expect(g.world.ended?.result).toBe('win');
    expect(g.num('dummy-health', 'hp')).toBe(0);
  });

  it('is deterministic', () => {
    const run = (): string => {
      const g = play();
      autopilot(g, 60 * 20);
      return JSON.stringify(g.world.entities());
    };
    expect(run()).toBe(run());
  });
});
