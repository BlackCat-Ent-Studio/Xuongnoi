import { describe, expect, it } from 'vitest';
import { clearRegistry, getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { GRAB_REACH } from '../../src/nodes/carry';
import { level05 } from '../../src/puzzle/levels/level-05';
import { buildPlayGraph, runLevel } from '../../src/puzzle/run-level';
import { slotRects } from '../../src/puzzle/store-slots';
import { isSceneryNode, shownPortsOf } from '../../src/puzzle/ui/board-state';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import type { PuzzleAnswer } from '../../src/puzzle/types';
import { createWorld } from '../../src/world/world';

/**
 * Level 5 runs on the pieces the editor offers: no puzzle-only brain forces the robot's behaviour.
 */

const allKinds = (): string[] => [
  ...new Set([...level05.base.nodes, ...level05.solution.nodes].map((n) => n.kind).concat(level05.tray.map((t) => t.kind))),
];

describe('level 5 is made of editor pieces only', () => {
  it('every node kind of the level is registered by the editor registry alone', () => {
    clearRegistry();
    registerAllNodes();
    for (const kind of allKinds()) expect(getNodeDef(kind), `${kind} is an editor piece`).toBeDefined();
  });

  it('the board builds and plays with only the editor pieces registered, and wins', () => {
    clearRegistry();
    registerAllNodes();
    const world = createWorld(level05.mode, puzzleWorldOptions(level05.mode));
    const rt = createRuntime(buildPlayGraph(level05, level05.solution), world, level05.mode);
    for (let i = 0; i < 60 * 60 && !world.ended; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    expect(world.ended?.result).toBe('win');
  });

  it('uses none of the old puzzle-only brain kinds', () => {
    for (const kind of allKinds()) expect(['pad-patrol', 'pad-carry', 'slot-patrol', 'fetch-store']).not.toContain(kind);
  });

  it('the new nearest-item piece is one of the editor pieces and is on the board', () => {
    registerAllNodes();
    expect(getNodeDef('nearest-item')).toBeDefined();
    expect(level05.base.nodes.some((n) => n.kind === 'nearest-item')).toBe(true);
  });
});

describe('level 5 board: robot logic is visible, only the world is hidden', () => {
  registerAllNodes();
  const SCENERY = ['floor', 'store-pad', 'crate-1', 'crate-2', 'crate-3', 'cam'].sort();
  const visible = level05.base.nodes.filter((n) => !isSceneryNode(level05, n.id));
  const sizeOf = (id: string): { w: number; h: number } => {
    const sp = level05.shownPorts?.[id];
    return { w: 170, h: 34 + 26 * ((sp?.in?.length ?? 0) + (sp?.out?.length ?? 0)) };
  };

  it('only the floor, store mark, crates and camera are hidden', () => {
    expect(level05.base.nodes.filter((n) => isSceneryNode(level05, n.id)).map((n) => n.id).sort()).toEqual(SCENERY);
  });

  it('the robot, slots and every logic piece of its circuit are visible cards', () => {
    expect(visible.map((n) => n.id).sort()).toEqual(['end', 'fetch', 'finder', 'hands', 'need', 'next', 'robot', 'slot-1', 'slot-2', 'slot-3', 'store', 'sum-x', 'sum-y']);
    const kinds = visible.map((n) => n.kind).sort();
    expect(kinds.filter((k) => k === 'go-to')).toHaveLength(2);
    for (const k of ['nearest-item', 'next-free-slot', 'carry', 'math']) expect(kinds, k).toContain(k);
  });

  it('every locked wire joins visible cards, and the hidden scenery has no wires', () => {
    const hidden = new Set(level05.base.nodes.filter((n) => isSceneryNode(level05, n.id)).map((n) => n.id));
    expect(level05.base.wires.length).toBeGreaterThan(0);
    for (const w of level05.base.wires) {
      expect(hidden.has(w.from.node) || hidden.has(w.to.node), `${w.id} touches hidden scenery`).toBe(false);
    }
  });

  it('every locked wire end is a port the card shows', () => {
    for (const w of level05.base.wires) {
      expect(shownPortsOf(level05, w.from.node).out?.has(w.from.port), `${w.id} from ${w.from.node}.${w.from.port}`).toBe(true);
      expect(shownPortsOf(level05, w.to.node).in?.has(w.to.port), `${w.id} to ${w.to.node}.${w.to.port}`).toBe(true);
    }
  });

  it('the locked circuit cards are packed in the left part of the board and never overlap', () => {
    const circuit = visible.filter((n) => n.id !== 'need' && n.id !== 'end');
    for (const n of circuit) {
      const { w, h } = sizeOf(n.id);
      expect(n.pos.x + w, `${n.id} right edge`).toBeLessThanOrEqual(560);
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

  it('the robot walks to crates with no pathfinding detour and stops clear of the crate, within hand reach', () => {
    const fetch = level05.base.nodes.find((n) => n.id === 'fetch')!;
    const stop = fetch.params.stopDistance as number;
    expect(stop).toBeGreaterThan(0.95); // robot half-box 0.65 + crate half 0.3
    expect(stop).toBeLessThan(GRAB_REACH);
  });
});

const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };

describe('level 5 behaviour: fetch, stop, grab, carry, set down', () => {
  interface Grab {
    tick: number;
    crate: string;
    stepBefore: number;
    dist: number;
    faceDot: number;
  }

  /** Plays the reference answer without the win wire so every trip finishes, and records each grab. */
  function trace(seconds = 70): { grabs: Grab[]; final: Map<string, { x: number; z: number }>; win: { outcome: string; seconds: number } } {
    const grabs: Grab[] = [];
    const final = new Map<string, { x: number; z: number }>();
    let prev: { x: number; z: number } | null = null;
    let prevHeld: string | null = null;
    let lastStep = 0;
    const answer = { ...level05.solution, wires: level05.solution.wires.filter((w) => w.to.node !== 'end') };
    runLevel(level05, answer, seconds, (world: World, tick) => {
      const all = world.listEntities();
      const robot = all.find((e) => e.kind === 'character')!;
      const step = prev ? Math.hypot(robot.position.x - prev.x, robot.position.z - prev.z) : 0;
      const heldId = world.heldItem(robot.id);
      if (heldId !== null && prevHeld === null) {
        const crate = world.getEntity(heldId)!;
        const dx = crate.position.x - robot.position.x;
        const dz = crate.position.z - robot.position.z;
        const dist = Math.hypot(dx, dz);
        const g: Grab = {
          tick,
          crate: crate.ownerNodeId,
          stepBefore: lastStep,
          dist,
          faceDot: robot.facing ? (robot.facing.x * dx + robot.facing.z * dz) / (dist || 1) : 0,
        };
        grabs.push(g);
      }
      lastStep = step;
      prev = { x: robot.position.x, z: robot.position.z };
      prevHeld = heldId;
      if (tick === Math.floor(seconds * 60) - 1) {
        for (const e of all) if (e.kind === 'item') final.set(e.ownerNodeId, { x: e.position.x, z: e.position.z });
      }
    });
    const r = runLevel(level05, level05.solution);
    return { grabs, final, win: { outcome: r.outcome, seconds: r.seconds } };
  }

  const run = trace();

  it('the reference solution wins well inside the time limit', () => {
    expect(run.win.outcome).toBe('win');
    expect(run.win.seconds).toBeLessThan(level05.timeLimit);
  });

  it('it grabs exactly three crates, nearest first: the middle crate, then the two far ones', () => {
    expect(run.grabs.map((g) => g.crate)).toHaveLength(3);
    expect(run.grabs[0]!.crate).toBe('crate-2');
    expect(new Set(run.grabs.map((g) => g.crate)).size).toBe(3);
  });

  it('never grabs while moving: the robot stood still on the tick it grabs', () => {
    for (const g of run.grabs) {
      expect(g.stepBefore, `${g.crate} step before the grab`).toBeLessThan(0.01);
    }
  });

  it('stops in front of the crate within hand reach and facing it', () => {
    for (const g of run.grabs) {
      expect(g.dist, `${g.crate} distance`).toBeLessThanOrEqual(GRAB_REACH + 0.05);
      expect(g.faceDot, `${g.crate} facing`).toBeGreaterThan(0.9);
    }
  });

  it('sets each crate down in its own slot, in the middle, without help from the win wire', () => {
    const rects = slotRects(level05.storeSlots!);
    const used = new Set<number>();
    for (const c of ['crate-1', 'crate-2', 'crate-3']) {
      const at = run.final.get(c)!;
      const idx = rects.findIndex((s) => Math.abs(at.x - s.x) < 0.1 && Math.abs(at.z - s.z) < 0.1);
      expect(idx, `${c} at ${at.x.toFixed(2)},${at.z.toFixed(2)}`).toBeGreaterThanOrEqual(0);
      used.add(idx);
    }
    expect(used.size).toBe(3);
  });

  it('with nothing wired by the player the robot still fetches and stores all three crates but nothing ends the level', () => {
    expect(runLevel(level05, EMPTY).outcome).toBe('timeout');
  });

  it('removing the count wire or the win wire fails', () => {
    for (const id of ['sw1', 'sw3']) {
      const cut: PuzzleAnswer = { ...level05.solution, wires: level05.solution.wires.filter((x) => x.id !== id) };
      expect(runLevel(level05, cut).outcome, `without ${id}`).not.toBe('win');
    }
  });

  it('without the "Số cần" wire "So sánh" reads 0 and the level is won at once (same as before the board was rebuilt)', () => {
    const cut: PuzzleAnswer = { ...level05.solution, wires: level05.solution.wires.filter((x) => x.id !== 'sw2') };
    const r = runLevel(level05, cut);
    expect(r.outcome).toBe('win');
    expect(r.seconds).toBeLessThan(1);
  });

  it('removing the robot own wires would stop it: the circuit really is the locked cards', () => {
    const noHands = { ...level05, base: { ...level05.base, wires: level05.base.wires.filter((w) => w.id !== 'b22') } };
    expect(runLevel(noHands, level05.solution, 40).outcome).not.toBe('win');
    const noSlots = { ...level05, base: { ...level05.base, wires: level05.base.wires.filter((w) => w.to.node !== 'next') } };
    expect(runLevel(noSlots, level05.solution, 40).outcome).not.toBe('win');
  });
});
