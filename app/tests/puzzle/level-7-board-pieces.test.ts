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

describe('level 7 script cards are visible and packed on the left', () => {
  registerAllNodes();
  const SCENERY = ['floor', 'store-mark', 'blue-store', 'red-store', 'need', 'enough', 'cam', 'end', ...Array.from({ length: 6 }, (_, i) => [`pad-${i + 1}`, `crate-${i + 1}`]).flat()].sort();
  const visible = level07.base.nodes.filter((n) => !isSceneryNode(level07, n.id));
  const sizeOf = (id: string): { w: number; h: number } => {
    const sp = level07.shownPorts?.[id];
    return { w: 170, h: 34 + 26 * ((sp?.in?.length ?? 0) + (sp?.out?.length ?? 0)) };
  };

  it('only scenery is hidden: the floor, pads, crates, store marks, win/lose plumbing and camera', () => {
    const hidden = level07.base.nodes.filter((n) => isSceneryNode(level07, n.id)).map((n) => n.id).sort();
    expect(hidden).toEqual(SCENERY);
    expect(visible.map((n) => n.kind).sort()).toEqual(
      ['and', 'block', 'block', 'block', 'carry', 'character', 'go-to', 'math', 'next-free-slot', 'or', 'route-follow', 'speed-sensor'].sort(),
    );
  });

  it('every visible card shows exactly the ports that are wired on it', () => {
    for (const n of visible) {
      const shown = shownPortsOf(level07, n.id);
      const wiredIn = new Set(level07.base.wires.filter((w) => w.to.node === n.id).map((w) => w.to.port));
      const wiredOut = new Set(level07.base.wires.filter((w) => w.from.node === n.id).map((w) => w.from.port));
      const playerIn = new Set(level07.solution.wires.filter((w) => w.to.node === n.id).map((w) => w.to.port));
      const playerOut = new Set(level07.solution.wires.filter((w) => w.from.node === n.id).map((w) => w.from.port));
      for (const p of wiredIn) expect(shown.in?.has(p), `${n.id} shows input ${p}`).toBe(true);
      for (const p of wiredOut) expect(shown.out?.has(p), `${n.id} shows output ${p}`).toBe(true);
      for (const p of playerIn) expect(shown.in?.has(p), `${n.id} shows the player's input ${p}`).toBe(true);
      for (const p of playerOut) expect(shown.out?.has(p), `${n.id} shows the player's output ${p}`).toBe(true);
    }
  });

  it('the locked cards sit in the left part of the board and never overlap', () => {
    for (const n of visible) {
      const { w, h } = sizeOf(n.id);
      expect(n.pos.x + w, `${n.id} right edge`).toBeLessThanOrEqual(700);
      expect(n.pos.y + h, `${n.id} bottom edge`).toBeLessThanOrEqual(560);
    }
    for (const n of level07.solution.nodes) expect(n.pos.x, `${n.id} stays on the right`).toBeGreaterThanOrEqual(600);
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
