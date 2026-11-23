import { describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board, type EntityView, type InputSnapshot } from '../../src/engine/types';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

const keys = (...k: string[]): InputSnapshot => ({ keysDown: new Set(k) });
const board = (): Board => listSamples().find((s) => s.id === 'portal-camera')!.board;

function start() {
  registerAllNodes();
  const b = board();
  const world = createWorld(b.mode);
  const rt = createRuntime(b.graph, world, b.mode);
  const step = (input: InputSnapshot): void => {
    rt.tick(input);
    world.step(TICK_DT);
  };
  const find = (owner: string): EntityView => world.entities().find((e) => e.ownerNodeId === owner)!;
  return { world, rt, step, find };
}

describe('portal-camera sample', () => {
  it('stays put when idle; the far island is out of jumping reach', () => {
    const g = start();
    for (let i = 0; i < 300; i++) g.step(keys());
    expect(g.find('character-1').position.x).toBeCloseTo(-8, 0);
    expect(g.world.ended).toBeNull();
    expect(g.world.cameraCommand()?.zoom).toBe(1); // only the main camera is on
  });

  it('walking into the purple portal lands the player at the orange one, shakes and zooms the camera, and finishing wins', () => {
    const g = start();
    let shook = false;
    let crossed = false;
    for (let i = 0; i < 60 * 10 && !g.world.ended; i++) {
      g.step(keys('ArrowRight'));
      const cmd = g.world.cameraCommand();
      if (cmd && cmd.shake > 0) shook = true;
      if (g.find('character-1').position.x > 16) crossed = true;
    }
    expect(crossed).toBe(true);
    expect(shook).toBe(true);
    expect(g.world.ended?.result).toBe('win');
  });

  it('after crossing, the close-up camera wins; going back switches to the main camera again', () => {
    const g = start();
    for (let i = 0; i < 60 * 4; i++) {
      g.step(keys('ArrowRight'));
      if (g.find('character-1').position.x > 16) break;
    }
    g.step(keys());
    expect(g.find('character-1').position.x).toBeGreaterThan(16);
    expect(g.world.cameraCommand()?.zoom).toBe(1.6);
    // R sends the player home; the far-side camera switches off.
    g.step(keys('KeyR'));
    g.step(keys());
    g.step(keys());
    expect(g.find('character-1').position.x).toBeCloseTo(-8, 0);
    expect(g.world.cameraCommand()?.zoom).toBe(1);
  });

  it('does not bounce back through the arrival portal while idling there', () => {
    const g = start();
    for (let i = 0; i < 60 * 4; i++) {
      g.step(keys('ArrowRight'));
      if (g.find('character-1').position.x > 16) break;
    }
    for (let i = 0; i < 300; i++) g.step(keys());
    expect(g.find('character-1').position.x).toBeGreaterThan(16);
  });
});
