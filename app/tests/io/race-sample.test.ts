import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView, type InputSnapshot } from '../../src/engine/types';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { pickFollowTarget } from '../../src/render/cameras';
import { findPlanePath, planeGridFor } from '../../src/world/navigation';
import { createWorld } from '../../src/world/world';

const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });
const board = (): Board => listSamples().find((s) => s.id === 'race')!.board;

function start(b: Board) {
  registerAllNodes();
  const world = createWorld(b.mode);
  const rt = createRuntime(b.graph, world, b.mode);
  const step = (input: InputSnapshot): void => {
    rt.tick(input);
    world.step(TICK_DT);
  };
  const find = (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!;
  return { world, rt, step, find };
}

/** WASD keys that point the player's stick toward a world point (top view: up = -z). */
function keysToward(from: { x: number; z: number }, to: { x: number; z: number }): string[] {
  const out: string[] = [];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (dx > 0.15) out.push('KeyD');
  else if (dx < -0.15) out.push('KeyA');
  if (dz > 0.15) out.push('KeyS');
  else if (dz < -0.15) out.push('KeyW');
  return out;
}

describe('race sample', () => {
  it('has a car for the player, a seated bot racer and a finish line', () => {
    const g = start(board());
    g.step(keys());
    const kinds = g.world.entities().map((e) => e.kind);
    expect(kinds.filter((k) => k === 'vehicle')).toHaveLength(2);
    expect(g.find('bot-driver').seatedIn).toBe(g.find('car-bot').id);
    expect(g.find('player').seatedIn).toBeUndefined();
  });

  it('the bot racer reaches the finish unattended through the S-shaped track (and the player loses)', () => {
    const g = start(board());
    let seconds = 0;
    for (let i = 0; i < 60 * 60 && !g.world.ended; i++) {
      g.step(keys());
      seconds = i / 60;
    }
    expect(g.world.ended?.result).toBe('lose');
    expect(seconds).toBeGreaterThan(10); // the idle-run sample test relies on this
    expect(seconds).toBeLessThan(45);
  });

  it('pressing E far from the car does nothing; near it, the player boards and the camera follows the car', () => {
    const g = start(board());
    // Walk to the south wall, away from the car, and press E: nothing in reach (the bot's car is taken).
    for (let i = 0; i < 90; i++) g.step(keys('KeyS'));
    g.step(keys('KeyE'));
    g.step(keys());
    expect(g.find('player').seatedIn).toBeUndefined();
    for (let i = 0; i < 90; i++) g.step(keys('KeyW'));
    g.step(keys('KeyE'));
    g.step(keys());
    const me = g.find('player');
    expect(me.seatedIn).toBe(g.find('car-player').id);
    const target = pickFollowTarget(g.world.entities());
    expect(target?.ownerNodeId).toBe('player');
    for (let i = 0; i < 60; i++) g.step(keys('KeyD'));
    expect(g.find('car-player').position.x).toBeGreaterThan(-17 + 3);
    expect(g.find('player').position.x).toBeCloseTo(g.find('car-player').position.x, 5);
  });

  it('can be won: board the car, follow the planned route, cross the finish line first', () => {
    const g = start(board());
    g.step(keys('KeyE'));
    g.step(keys());
    expect(g.find('player').seatedIn).toBeDefined();

    const goal = g.find('finish').position;
    let route: { x: number; z: number }[] = [];
    for (let i = 0; i < 60 * 40 && !g.world.ended; i++) {
      const car = g.find('car-player');
      if (i % 20 === 0) {
        const grid = planeGridFor(g.world, { halfWidth: 0.75, height: 0.8 }, 0);
        route = grid ? (findPlanePath(grid, { x: car.position.x, z: car.position.z }, { x: goal.x, z: goal.z })?.points ?? []) : [];
      }
      while (route.length > 1 && Math.hypot(route[0]!.x - car.position.x, route[0]!.z - car.position.z) < 1) route.shift();
      const next = route[0] ?? { x: goal.x, z: goal.z };
      g.step(keys(...keysToward(car.position, next)));
    }
    expect(g.world.ended?.result).toBe('win');
  });

  it('getting out lands the player beside the car on free ground', () => {
    const g = start(board());
    g.step(keys('KeyE'));
    g.step(keys());
    expect(g.find('player').seatedIn).toBeDefined();
    for (let i = 0; i < 20; i++) g.step(keys());
    g.step(keys('KeyE'));
    g.step(keys());
    const me = g.find('player');
    expect(me.seatedIn).toBeUndefined();
    const car = g.find('car-player');
    expect(Math.hypot(me.position.x - car.position.x, me.position.z - car.position.z)).toBeLessThan(2.5);
    for (const b of g.world.solidBoxes()) {
      const overlapX = Math.abs(me.position.x - b.position.x) < (me.size.x + b.size.x) / 2 - 1e-6;
      const overlapZ = Math.abs(me.position.z - b.position.z) < (me.size.z + b.size.z) / 2 - 1e-6;
      expect(overlapX && overlapZ).toBe(false);
    }
  });
});
