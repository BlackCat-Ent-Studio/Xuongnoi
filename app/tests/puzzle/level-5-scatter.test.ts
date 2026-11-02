import { describe, expect, it } from 'vitest';
import type { BodySnapshot } from '../../src/engine/types';
import { PUZZLE_LEVELS } from '../../src/puzzle/levels';
import { runLevel } from '../../src/puzzle/run-level';
import { slotRects } from '../../src/puzzle/store-slots';

const level = PUZZLE_LEVELS.find((l) => l.order === 5)!;
const crates = level.base.nodes.filter((n) => n.kind === 'item');
const pos = (n: (typeof crates)[number]): { x: number; z: number } => n.params.position as { x: number; z: number };

describe('level 5: scattered crates', () => {
  it('has three crates, each at least 3 units from the others', () => {
    expect(crates).toHaveLength(3);
    for (let i = 0; i < crates.length; i++) {
      for (let j = i + 1; j < crates.length; j++) {
        const a = pos(crates[i]!);
        const b = pos(crates[j]!);
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('the reference solution wins', () => {
    expect(runLevel(level, level.solution).outcome).toBe('win');
  });

  it('each crate ends in its own slot, set down in the middle', () => {
    let bodies: BodySnapshot[] = [];
    const seconds = 60;
    const free = { ...level, base: { ...level.base, wires: level.base.wires.filter((w) => w.to.node !== 'end') } };
    runLevel(free, { ...level.solution, wires: level.solution.wires.filter((w) => w.to.node !== 'end') }, seconds, (world, tick) => {
      if (tick === seconds * 60 - 1) bodies = [...(world.debugBodies?.() ?? [])];
    });
    const items = bodies.filter((b) => b.kind === 'item' && b.visible && !b.carried);
    expect(items).toHaveLength(3);
    const used = new Set<number>();
    for (const b of items) {
      const idx = slotRects(level.storeSlots!).findIndex((s) => Math.abs(b.pos.x - s.x) < 0.1 && Math.abs(b.pos.z - s.z) < 0.1);
      expect(idx, `${b.owner} at ${b.pos.x.toFixed(2)},${b.pos.z.toFixed(2)}`).toBeGreaterThanOrEqual(0);
      used.add(idx);
    }
    expect(used.size).toBe(3);
  });
});
