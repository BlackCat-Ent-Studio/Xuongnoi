import { beforeAll, describe, expect, it } from 'vitest';
import { listSamples } from '../../src/io';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Board } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { AUTO_ARM } from '../../src/samples/auto-arm-board';
import { WEIGHT_SORTER } from '../../src/samples/weight-sorter-board';
import { worldOptionsForGraph } from '../../src/world/graph-world-options';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';

/**
 * The two shipped machines whose pushers are a piston (weight sorter) and an arm with a gripper (auto arm) still do their job
 * with "Vật lý thật" on and the crate engine loaded: the same success conditions as their tests with the switch off.
 */

let rapier: RapierModule;
beforeAll(async () => {
  registerAllNodes();
  rapier = await loadRapier();
});

const sample = (id: string): Board => structuredClone(listSamples().find((s) => s.id === id)!.board);

function playOn(board: Board) {
  const graph = { ...board.graph, settings: { ...board.graph.settings, realPhysics: true } };
  const world = createWorld(board.mode, { ...(worldOptionsForGraph(graph) ?? {}), rapier });
  const rt = createRuntime(graph, world, board.mode);
  return {
    world,
    rt,
    watch(seconds: number, each: () => void): void {
      for (let i = 0; i < Math.round(seconds / TICK_DT); i++) {
        rt.tick({ keysDown: new Set() });
        world.step(TICK_DT);
        each();
      }
    },
    out: (id: string, port: string) => rt.getOutput(id, port),
  };
}

describe('weight sorter with real physics on', () => {
  it('every heavy crate ends in the side bin, every light one in the end bin, the piston never overloaded', { timeout: 180_000 }, () => {
    const p = playOn(sample('weight-sorter'));
    const seen = new Map<string, { kg: number; bin: 'side' | 'end' | 'elsewhere' }>();
    let overloaded = false;
    let peakForce = 0;
    p.watch(80, () => {
      if (p.out('piston', 'overloaded') === true) overloaded = true;
      peakForce = Math.max(peakForce, p.out('piston', 'force') as number);
      for (const e of p.world.entities()) {
        if (e.ownerNodeId !== 'maker') continue;
        const known = seen.get(e.id) ?? { kg: p.world.materialOf(e.id)!.massKg, bin: 'elsewhere' as const };
        const { x, z } = e.position;
        known.bin = z > 5 && x > 0 && x < 4 ? 'side' : x > 8 && Math.abs(z) < 1 ? 'end' : 'elsewhere';
        seen.set(e.id, known);
      }
    });
    const done = [...seen.values()].filter((c) => c.bin !== 'elsewhere');
    expect(done.length).toBeGreaterThanOrEqual(8);
    for (const c of done) expect(c.bin, `${c.kg} kg`).toBe(c.kg >= WEIGHT_SORTER.thresholdKg ? 'side' : 'end');
    expect(done.some((c) => c.bin === 'side')).toBe(true);
    expect(done.some((c) => c.bin === 'end')).toBe(true);
    expect(overloaded).toBe(false);
    expect(peakForce).toBeLessThanOrEqual(0.5 * WEIGHT_SORTER.maxKg * 9.81 + 0.1);
    p.world.dispose?.();
  });
});

describe('auto arm with real physics on', () => {
  it('places every crate, none slipped, none crushed, joints never overloaded', { timeout: 180_000 }, () => {
    const p = playOn(sample('auto-arm'));
    let overloaded = false;
    p.watch(60, () => {
      for (const j of ['shoulder', 'elbow', 'swing']) if (p.out(j, 'overloaded') === true) overloaded = true;
    });
    expect(p.out('placed', 'value')).toBe(AUTO_ARM.fragile.length);
    expect(p.out('slips', 'value')).toBe(0);
    expect(p.out('crushes', 'value')).toBe(0);
    expect(overloaded).toBe(false);
    p.world.dispose?.();
  });
});
