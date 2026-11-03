import { describe, expect, it } from 'vitest';
import { clearRegistry, getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { level07 } from '../../src/puzzle/levels/level-07';
import { buildPlayGraph } from '../../src/puzzle/run-level';
import { isSceneryNode, shownPortsOf } from '../../src/puzzle/ui/board-state';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import { createWorld } from '../../src/world/world';

/**
 * Level 7 runs on the same pieces the editor offers: no puzzle-only brain forces the robot's behaviour.
 */

const allKinds = (): string[] => [
  ...new Set([...level07.base.nodes, ...level07.solution.nodes].map((n) => n.kind).concat(level07.tray.map((t) => t.kind))),
];

describe('level 7 is made of editor pieces only', () => {
  it('every node kind of the level is registered by the editor registry alone', () => {
    clearRegistry();
    registerAllNodes();
    for (const kind of allKinds()) expect(getNodeDef(kind), `${kind} is an editor piece`).toBeDefined();
  });

  it('the board builds and plays with only the editor pieces registered (no puzzle-only nodes)', () => {
    clearRegistry();
    registerAllNodes();
    const world = createWorld(level07.mode, puzzleWorldOptions(level07.mode));
    const rt = createRuntime(buildPlayGraph(level07, level07.solution), world, level07.mode);
    for (let i = 0; i < 600; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.listEntities().some((e) => e.kind === 'character')).toBe(true);
  });

  it('uses none of the old puzzle-only brain kinds', () => {
    for (const kind of allKinds()) expect(['pad-patrol', 'pad-carry', 'slot-patrol', 'fetch-store']).not.toContain(kind);
  });
});

describe('level 7 shows only the robot and the store slot marks', () => {
  registerAllNodes();
  const SCENERY = [
    'floor', 'store-mark', 'red-store', 'slots-12', 'slots-all', 'slot-zone-1', 'slot-zone-2', 'slot-zone-3', 'cam', 'end',
    ...Array.from({ length: 6 }, (_, i) => [`pad-${i + 1}`, `crate-${i + 1}`]).flat(),
  ].sort();
  const visible = level07.base.nodes.filter((n) => !isSceneryNode(level07, n.id));
  const sizeOf = (id: string): { w: number; h: number } => {
    const sp = level07.shownPorts?.[id];
    return { w: 170, h: 34 + 26 * ((sp?.in?.length ?? 0) + (sp?.out?.length ?? 0)) };
  };

  it('only scenery is hidden: the floor, pads, crates, zones, win/lose plumbing and camera', () => {
    const hidden = level07.base.nodes.filter((n) => isSceneryNode(level07, n.id)).map((n) => n.id).sort();
    expect(hidden).toEqual(SCENERY);
  });

  it('the visible cards are the robot and the three slot marks, nothing else', () => {
    expect(visible.map((n) => n.id).sort()).toEqual(['robot', 'slot-1', 'slot-2', 'slot-3']);
    expect(visible.find((n) => n.id === 'robot')?.kind).toBe('character');
    expect(visible.filter((n) => n.id.startsWith('slot-')).map((n) => n.params.name)).toEqual(['Ô kho 1', 'Ô kho 2', 'Ô kho 3']);
  });

  it('the base has no logic of the robot: its only wires are the hidden win/lose plumbing', () => {
    const hiddenIds = new Set(level07.base.nodes.filter((n) => isSceneryNode(level07, n.id)).map((n) => n.id));
    for (const w of level07.base.wires) {
      expect(hiddenIds.has(w.from.node) && hiddenIds.has(w.to.node), `${w.id} joins hidden scenery only`).toBe(true);
    }
    const kinds = new Set(level07.base.nodes.map((n) => n.kind));
    for (const k of ['route-follow', 'go-to', 'carry', 'color-sensor', 'next-free-slot', 'math', 'speed-sensor', 'or', 'not']) expect(kinds.has(k), k).toBe(false);
  });

  it('every visible card shows exactly the ports the player needs', () => {
    for (const n of visible) {
      const shown = shownPortsOf(level07, n.id);
      const playerIn = new Set(level07.solution.wires.filter((w) => w.to.node === n.id).map((w) => w.to.port));
      const playerOut = new Set(level07.solution.wires.filter((w) => w.from.node === n.id).map((w) => w.from.port));
      expect([...(shown.in ?? [])].sort(), `${n.id} inputs`).toEqual([...playerIn].sort());
      expect([...(shown.out ?? [])].sort(), `${n.id} outputs`).toEqual([...playerOut].sort());
    }
  });

  it('the locked cards sit in the left part of the board and never overlap', () => {
    for (const n of visible) {
      const { w, h } = sizeOf(n.id);
      expect(n.pos.x + w, `${n.id} right edge`).toBeLessThanOrEqual(400);
      expect(n.pos.y + h, `${n.id} bottom edge`).toBeLessThanOrEqual(560);
    }
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i]!;
        const b = visible[j]!;
        const sa = sizeOf(a.id);
        const sb = sizeOf(b.id);
        const hit = a.pos.x < b.pos.x + sb.w && b.pos.x < a.pos.x + sa.w && a.pos.y < b.pos.y + sb.h && b.pos.y < a.pos.y + sa.h;
        expect(hit, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });
});
