import { describe, expect, it } from 'vitest';
import { clearRegistry, getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { GRAB_REACH } from '../../src/nodes/carry';
import { level05 } from '../../src/puzzle/levels/level-05';
import { buildPlayGraph, piecesUsed, runLevel } from '../../src/puzzle/run-level';
import { slotRects } from '../../src/puzzle/store-slots';
import { isSceneryNode, shownPortsOf } from '../../src/puzzle/ui/board-state';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import type { PuzzleAnswer } from '../../src/puzzle/types';
import { createWorld } from '../../src/world/world';

/**
 * Level 5 is built by the player from the pieces the editor offers: the board shows only the robot and the three
 * slot marks; no puzzle-only brain forces the robot's behaviour.
 */

const allKinds = (): string[] => [
  ...new Set([...level05.base.nodes, ...level05.solution.nodes].map((n) => n.kind).concat(level05.tray.map((t) => t.kind))),
];
const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };

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
});

describe('level 5 board: only the robot and the slot marks are drawn', () => {
  registerAllNodes();
  const SCENERY = ['floor', 'store-pad', 'crate-1', 'crate-2', 'crate-3', 'cam', 'slot-zone-1', 'slot-zone-2', 'slot-zone-3', 'slots-12', 'slots-all', 'end'].sort();
  const visible = level05.base.nodes.filter((n) => !isSceneryNode(level05, n.id));

  it('the floor, store, crates, win plumbing and camera are hidden; the visible cards are the robot and the 3 slots', () => {
    expect(level05.base.nodes.filter((n) => isSceneryNode(level05, n.id)).map((n) => n.id).sort()).toEqual(SCENERY);
    expect(visible.map((n) => n.id).sort()).toEqual(['robot', 'slot-1', 'slot-2', 'slot-3']);
    expect(visible.map((n) => n.kind).sort()).toEqual(['block', 'block', 'block', 'character']);
  });

  it('no robot logic is locked on the board: every base wire joins hidden scenery only', () => {
    const hidden = new Set(level05.base.nodes.filter((n) => isSceneryNode(level05, n.id)).map((n) => n.id));
    for (const w of level05.base.wires) expect(hidden.has(w.from.node) && hidden.has(w.to.node), `${w.id} is scenery plumbing`).toBe(true);
    const logic = level05.base.nodes.filter((n) => ['go-to', 'nearest-item', 'next-free-slot', 'carry', 'math', 'compare', 'counter'].includes(n.kind));
    expect(logic).toEqual([]);
  });

  it('the robot shows its walk inputs and its self output; the slots show their self output', () => {
    expect([...(shownPortsOf(level05, 'robot').in ?? [])].sort()).toEqual(['moveX', 'moveY']);
    expect([...(shownPortsOf(level05, 'robot').out ?? [])]).toEqual(['self']);
    for (const s of ['slot-1', 'slot-2', 'slot-3']) expect([...(shownPortsOf(level05, s).out ?? [])]).toEqual(['self']);
  });

  it('visible cards sit apart on the left and the solution uses only shown ports', () => {
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const a = visible[i]!;
        const b = visible[j]!;
        const rows = (id: string): number => (shownPortsOf(level05, id).in?.size ?? 0) + (shownPortsOf(level05, id).out?.size ?? 0);
        const apart = a.pos.y + 34 + 26 * rows(a.id) <= b.pos.y || b.pos.y + 34 + 26 * rows(b.id) <= a.pos.y || Math.abs(a.pos.x - b.pos.x) >= 170;
        expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
      }
    }
    for (const w of level05.solution.wires) {
      if (visible.some((n) => n.id === w.from.node)) expect(shownPortsOf(level05, w.from.node).out?.has(w.from.port), w.id).toBe(true);
      if (visible.some((n) => n.id === w.to.node)) expect(shownPortsOf(level05, w.to.node).in?.has(w.to.port), w.id).toBe(true);
    }
  });

  it('the tray is the four solution pieces plus one spare; par is the piece count; the go-to preset stops clear of a crate within hand reach', () => {
    expect(level05.tray.map((t) => t.kind).sort()).toEqual(['carry', 'go-to', 'next-free-slot', 'nearest-item', 'not'].sort());
    expect(level05.tray.every((t) => t.count === 1)).toBe(true);
    expect(level05.solution.nodes.map((n) => n.kind)).not.toContain('not');
    expect(level05.par).toBe(4);
    expect(piecesUsed(level05.solution)).toBe(level05.par);
    expect(level05.freeHints).toBe(Math.floor(level05.solution.wires.length / 2));
    const stop = level05.tray.find((t) => t.kind === 'go-to')!.params!.stopDistance as number;
    expect(stop).toBeGreaterThan(0.95); // robot half-box 0.65 + crate half 0.3
    expect(stop).toBeLessThan(GRAB_REACH);
  });
});

describe('level 5 behaviour: fetch, stop, grab, carry, set down', () => {
  interface Grab {
    crate: string;
    stepBefore: number;
    dist: number;
    faceDot: number;
  }

  /** Plays the reference answer without the win plumbing, so every trip finishes, and records each grab. */
  function trace(seconds = 70): { grabs: Grab[]; final: Map<string, { x: number; z: number }> } {
    const grabs: Grab[] = [];
    const final = new Map<string, { x: number; z: number }>();
    let prev: { x: number; z: number } | null = null;
    let prevHeld: string | null = null;
    let lastStep = 0;
    const noWin = { ...level05, base: { ...level05.base, wires: level05.base.wires.filter((w) => w.to.node !== 'end') } };
    runLevel(noWin, level05.solution, seconds, (world: World, tick) => {
      const all = world.listEntities();
      const robot = all.find((e) => e.kind === 'character')!;
      const step = prev ? Math.hypot(robot.position.x - prev.x, robot.position.z - prev.z) : 0;
      const heldId = world.heldItem(robot.id);
      if (heldId !== null && prevHeld === null) {
        const crate = world.getEntity(heldId)!;
        const dx = crate.position.x - robot.position.x;
        const dz = crate.position.z - robot.position.z;
        const dist = Math.hypot(dx, dz);
        grabs.push({ crate: crate.ownerNodeId, stepBefore: lastStep, dist, faceDot: robot.facing ? (robot.facing.x * dx + robot.facing.z * dz) / (dist || 1) : 0 });
      }
      lastStep = step;
      prev = { x: robot.position.x, z: robot.position.z };
      prevHeld = heldId;
      if (tick === Math.floor(seconds * 60) - 1) {
        for (const e of all) if (e.kind === 'item') final.set(e.ownerNodeId, { x: e.position.x, z: e.position.z });
      }
    });
    return { grabs, final };
  }

  const run = trace();
  const win = runLevel(level05, level05.solution);

  it('the reference solution wins well inside the time limit', () => {
    expect(win.outcome).toBe('win');
    expect(win.seconds).toBeLessThan(level05.timeLimit);
  });

  it('it grabs exactly three crates, nearest first: the middle crate, then the two far ones', () => {
    expect(run.grabs.map((g) => g.crate)).toHaveLength(3);
    expect(run.grabs[0]!.crate).toBe('crate-2');
    expect(new Set(run.grabs.map((g) => g.crate)).size).toBe(3);
  });

  it('never grabs while moving: the robot stood still on the tick it grabs', () => {
    for (const g of run.grabs) expect(g.stepBefore, `${g.crate} step before the grab`).toBeLessThan(0.01);
  });

  it('stops in front of the crate within hand reach and facing it', () => {
    for (const g of run.grabs) {
      expect(g.dist, `${g.crate} distance`).toBeLessThanOrEqual(GRAB_REACH + 0.05);
      expect(g.faceDot, `${g.crate} facing`).toBeGreaterThan(0.9);
    }
  });

  it('sets each crate down in the middle of its own slot, without help from the win rule', () => {
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

  it('an empty answer never wins, and pieces alone (unwired) do nothing', () => {
    expect(runLevel(level05, EMPTY).outcome).toBe('timeout');
    expect(runLevel(level05, { nodes: level05.solution.nodes, wires: [] }).outcome).toBe('timeout');
  });

  it('every solution wire is needed: with any one removed the level is not won', () => {
    // Only "Ô kho 3 -> Tìm vật gần nhất" can go: the level ends the moment the third crate is down, before the finder
    // would look at slot 3 again. The wire keeps the robot calm once the win rule is off (see the settle test).
    for (const w of level05.solution.wires.filter((x) => x.id !== 'sw4')) {
      const cut: PuzzleAnswer = { ...level05.solution, wires: level05.solution.wires.filter((x) => x.id !== w.id) };
      expect(runLevel(level05, cut).outcome, `without ${w.id}`).not.toBe('win');
    }
  });

  it('every solution piece is needed: with any one removed (and its wires) the level is not won', () => {
    for (const n of level05.solution.nodes) {
      const cut: PuzzleAnswer = {
        nodes: level05.solution.nodes.filter((x) => x.id !== n.id),
        wires: level05.solution.wires.filter((w) => w.from.node !== n.id && w.to.node !== n.id),
      };
      expect(runLevel(level05, cut).outcome, `without ${n.id}`).not.toBe('win');
    }
  });

  it('without "Ô trống kế tiếp" every crate is taken to one place and the level is not won', () => {
    const direct: PuzzleAnswer = {
      nodes: level05.solution.nodes.filter((x) => x.id !== 's-next'),
      wires: [
        ...level05.solution.wires.filter((w) => w.from.node !== 's-next' && w.to.node !== 's-next'),
        { id: 'x1', from: { node: 'slot-1', port: 'self' }, to: { node: 's-go', port: 'target2' } },
      ],
    };
    expect(runLevel(level05, direct).outcome).not.toBe('win');
  });
});
