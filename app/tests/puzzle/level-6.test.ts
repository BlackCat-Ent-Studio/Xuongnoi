import { describe, expect, it } from 'vitest';
import { clearRegistry, getNodeDef } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { canConnect } from '../../src/engine/wiring';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Wire } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { CAT_ARRIVE, CRATE_SIZE, GUARD_EYES, GUARD_LANE, LAYOUT, level06, routeOf, stealthBase } from '../../src/puzzle/levels/level-06';
import { buildPlayGraph, piecesUsed, runLevel } from '../../src/puzzle/run-level';
import { isSceneryNode, shownPortsOf } from '../../src/puzzle/ui/board-state';
import { puzzleWorldOptions } from '../../src/puzzle/world-options';
import type { PuzzleAnswer } from '../../src/puzzle/types';
import { segmentClear } from '../../src/world/line-of-sight';
import { createWorld } from '../../src/world/world';

const EMPTY: PuzzleAnswer = { nodes: [], wires: [] };
const sol = level06.solution;
const wire = (id: string, from: [string, string], to: [string, string]): Wire => ({ id, from: { node: from[0], port: from[1] }, to: { node: to[0], port: to[1] } });
const piece = (id: string, kind: string, params: GraphNode['params'] = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });

/** The cat's walking brain every attempt shares: the route run one leg at a time, and the forecast watching the cat's next leg. */
const BRAIN_NODES = sol.nodes.filter((n) => ['s-route', 's-fore'].includes(n.id));
const BRAIN_WIRES = sol.wires.filter((w) => ['sw1', 'sw2', 'sw3', 'sw4', 'sw5', 'sw9', 'sw10', 'sw11'].includes(w.id));
const withBrain = (extra: PuzzleAnswer): PuzzleAnswer => ({ nodes: [...BRAIN_NODES, ...extra.nodes], wires: [...BRAIN_WIRES, ...extra.wires] });

/** Things a player might try instead of the reference answer. */
const GOES_WHEN_NOT_LOOKING_NOW: PuzzleAnswer = withBrain({
  nodes: [piece('c', 'compare', { op: 'gt' })],
  wires: [wire('x1', ['s-fore', 'window'], ['c', 'a']), wire('x2', ['c', 'out'], ['s-route', 'go'])],
});
const GOES_WHEN_SAFE: PuzzleAnswer = withBrain({ nodes: [], wires: [wire('x1', ['s-fore', 'safe'], ['s-route', 'go'])] });
const GOES_AT_GUARD_TURN: PuzzleAnswer = withBrain({ nodes: [], wires: [wire('x1', ['patrol', 'atEnd'], ['s-route', 'go'])] });
const byDistance = (threshold: number): PuzzleAnswer =>
  withBrain({
    nodes: [piece('d', 'distance', { threshold }), piece('n', 'not')],
    wires: [wire('x1', ['hero', 'self'], ['d', 'a']), wire('x2', ['guard', 'self'], ['d', 'b']), wire('x3', ['d', 'within'], ['n', 'in']), wire('x4', ['n', 'out'], ['s-route', 'go'])],
  });

interface Watch {
  outcome: string;
  seconds: number;
  /** Seconds the cat stood still within the cover radius of each cover spot. */
  stillAtCover: number[];
  /** Ticks the cat stood still anywhere else except the start and the goal. */
  stillInOpen: number;
  /** Longest run of ticks the guard's line to the cat was open while the cat was within the cover radius of a cover spot. */
  exposedAtCover: number;
}

function watch(answer: PuzzleAnswer): Watch {
  const spots = LAYOUT.spots;
  const stillAtCover = spots.map(() => 0);
  let stillInOpen = 0;
  let exposedAtCover = 0;
  let prev: { x: number; z: number } | null = null;
  const r = runLevel(level06, answer, level06.timeLimit, (world) => {
    const hero = world.entities().find((e) => e.ownerNodeId === 'hero')!;
    const guard = world.entities().find((e) => e.ownerNodeId === 'guard')!;
    if (prev) {
      const speed = Math.hypot(hero.position.x - prev.x, hero.position.z - prev.z) / TICK_DT;
      if (speed < 0.05) {
        const k = spots.findIndex((s) => Math.hypot(s.x - hero.position.x, s.z - hero.position.z) <= 0.6);
        if (k >= 0) stillAtCover[k]! += TICK_DT;
        else if (Math.hypot(LAYOUT.start.x - hero.position.x, LAYOUT.start.z - hero.position.z) > 0.6 && Math.hypot(LAYOUT.goal.x - hero.position.x, LAYOUT.goal.z - hero.position.z) > 1.2) stillInOpen++;
      }
    }
    prev = { x: hero.position.x, z: hero.position.z };
    if (spots.some((s) => Math.hypot(s.x - hero.position.x, s.z - hero.position.z) <= CAT_ARRIVE + 0.1) && world.lineOfSight(guard.id, hero.id)) exposedAtCover++;
  });
  return { outcome: r.outcome, seconds: r.seconds, stillAtCover, stillInOpen, exposedAtCover };
}

describe('level 6: ne-linh-gac, the reference answer', () => {
  const run = watch(sol);

  it('wins well inside the time limit', () => {
    expect(run.outcome).toBe('win');
    expect(run.seconds).toBeLessThan(level06.timeLimit * 0.75);
  });

  it('waits behind at least one crate and runs straight past at least one', () => {
    const waited = run.stillAtCover.filter((s) => s >= 0.3).length;
    const chained = run.stillAtCover.filter((s) => s < 0.05).length;
    expect(waited).toBeGreaterThanOrEqual(1);
    expect(chained).toBeGreaterThanOrEqual(1);
  });

  it('never stands still in the open: it only stops behind a crate (or at the start and goal)', () => {
    expect(run.stillInOpen).toBe(0);
  });

  it('is never in the guard line of sight when it is at a cover spot', () => {
    expect(run.exposedAtCover).toBe(0);
  });

  it('keeps winning when the guard begins elsewhere on its lane', () => {
    for (const guardZ of [-3.6, -3.3, -2.6, -2.2, -1.4]) {
      const level = { ...level06, base: stealthBase({ ...LAYOUT, guardZ }) };
      expect(runLevel(level, sol).outcome, `guard starts at z=${guardZ}`).toBe('win');
    }
  });

  it('has 3 pieces and 11 wires, within the tray and par', () => {
    expect(piecesUsed(sol)).toBe(3);
    expect(sol.wires).toHaveLength(11);
    expect(level06.par).toBe(3);
    expect(level06.freeHints).toBe(4);
    for (const n of sol.nodes) expect(level06.tray.find((t) => t.kind === n.kind), n.kind).toBeDefined();
  });
});

describe('level 6: ways that must not win', () => {
  it('an empty answer: the cat never leaves the start and the time runs out', () => {
    expect(runLevel(level06, EMPTY).outcome).toBe('timeout');
  });

  it('"Đo khoảng cách" (the old answer) loses or times out for every threshold', () => {
    for (let t = 0.5; t <= 14; t += 0.5) {
      const r = runLevel(level06, byDistance(t));
      expect(r.outcome, `threshold ${t}`).not.toBe('win');
    }
    expect(runLevel(level06, byDistance(3)).outcome).toBe('lose');
  }, 120_000);

  it('running whenever the guard is not looking at the leg right now is seen', () => {
    expect(runLevel(level06, GOES_WHEN_NOT_LOOKING_NOW).outcome).toBe('lose');
  });

  it('other shortcuts on the shown ports do not win', () => {
    for (const [name, a] of [['An toàn', GOES_WHEN_SAFE], ['guard turns', GOES_AT_GUARD_TURN]] as const) {
      expect(runLevel(level06, a).outcome, name).not.toBe('win');
    }
  });

  it('removing any one wire of the reference answer fails', () => {
    for (const w of sol.wires) {
      const r = runLevel(level06, { ...sol, wires: sol.wires.filter((x) => x.id !== w.id) });
      expect(r.outcome, 'without ' + w.id).not.toBe('win');
    }
  }, 120_000);

  it('removing any one piece fails', () => {
    for (const n of sol.nodes) {
      const r = runLevel(level06, { nodes: sol.nodes.filter((m) => m.id !== n.id), wires: sol.wires.filter((w) => w.from.node !== n.id && w.to.node !== n.id) });
      expect(r.outcome, 'without ' + n.id).not.toBe('win');
    }
  });

  it('no cheaper answer wins: the forecast and route with any single extra wire into Chạy, or the decoys, never win', () => {
    for (const a of [GOES_WHEN_SAFE, GOES_AT_GUARD_TURN, GOES_WHEN_NOT_LOOKING_NOW, byDistance(3)]) expect(runLevel(level06, a).outcome).not.toBe('win');
  });

  it('a loss is the guard really seeing the cat: inside range, inside the cone, no crate between', () => {
    let seenLoss = 0;
    for (const a of [GOES_WHEN_NOT_LOOKING_NOW, byDistance(3), byDistance(6)]) {
      let last: { hero: EntityView; guard: EntityView; clear: boolean } | null = null;
      const r = runLevel(level06, a, level06.timeLimit, (world) => {
        const hero = world.entities().find((e) => e.ownerNodeId === 'hero')!;
        const guard = world.entities().find((e) => e.ownerNodeId === 'guard')!;
        last = { hero, guard, clear: world.lineOfSight(guard.id, hero.id) };
      });
      if (r.outcome !== 'lose') continue;
      seenLoss++;
      const { hero, guard, clear } = last!;
      const dx = hero.position.x - guard.position.x;
      const dz = hero.position.z - guard.position.z;
      const dist = Math.hypot(dx, hero.position.y - guard.position.y, dz);
      const off = Math.acos((dx * guard.facing!.x + dz * guard.facing!.z) / Math.hypot(dx, dz));
      expect(dist).toBeLessThanOrEqual(GUARD_EYES.range);
      expect(off).toBeLessThanOrEqual((GUARD_EYES.angle / 2) * (Math.PI / 180) + 1e-3);
      expect(clear).toBe(true);
    }
    expect(seenLoss).toBeGreaterThan(0);
  });
});

describe('level 6 is made of editor pieces only', () => {
  const kinds = (): string[] => [...new Set([...level06.base.nodes, ...level06.solution.nodes].map((n) => n.kind).concat(level06.tray.map((t) => t.kind)))];

  it('every node kind is registered by the editor registry alone', () => {
    clearRegistry();
    registerAllNodes();
    for (const kind of kinds()) expect(getNodeDef(kind), `${kind} is an editor piece`).toBeDefined();
  });

  it('the board builds and plays with only the editor pieces registered (no puzzle-only nodes)', () => {
    clearRegistry();
    registerAllNodes();
    const world = createWorld(level06.mode, puzzleWorldOptions(level06.mode));
    const rt = createRuntime(buildPlayGraph(level06, level06.solution), world, level06.mode);
    for (let i = 0; i < 1500; i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
    const bots = world.listEntities().filter((e) => e.kind === 'character');
    expect(bots).toHaveLength(2);
    expect(bots.some((b) => b.look === 'robot-legs')).toBe(true);
    expect(bots.some((b) => b.look === 'cat-chibi')).toBe(true);
  });

  it('uses none of the old puzzle-only brain kinds', () => {
    for (const kind of kinds()) expect(['pad-patrol', 'pad-carry', 'slot-patrol', 'fetch-store']).not.toContain(kind);
  });

  it('solution wires pass the same connect rule the board uses, one by one', () => {
    registerAllNodes();
    let graph: Graph = { nodes: [...level06.base.nodes, ...sol.nodes], wires: [...level06.base.wires] };
    for (const w of sol.wires) {
      const res = canConnect(graph, w.from, w.to);
      expect(res.ok, `${w.id}: ${res.ok ? '' : res.reason}`).toBe(true);
      graph = { ...graph, wires: [...graph.wires, w] };
    }
  });
});

describe('level 6 board: logic cards are visible and locked, scenery is hidden', () => {
  const visible = level06.base.nodes.filter((n) => !isSceneryNode(level06, n.id));

  it('the visible cards are only the cat and the guard with its walk: the cat has no brain until the player builds it', () => {
    // The locked "Khi bắt đầu" card is what switches the guard's walk on; the cat's walk takes the same signal from it.
    expect(visible.map((n) => n.id).sort()).toEqual(['guard', 'hero', 'patrol', 'start']);
    expect(visible.find((n) => n.id === 'guard')?.params.look).toBe('robot-legs');
    expect(visible.find((n) => n.id === 'hero')?.params.look).toBe('cat-chibi');
    const kinds = new Set(level06.base.nodes.map((n) => n.kind));
    for (const k of ['route-follow', 'sight-forecast', 'compare', 'math', 'const', 'distance', 'go-to']) expect(kinds.has(k), k).toBe(false);
  });

  it('floor, goal tile, crates, camera, the guard eyes and win/lose plumbing are the hidden scenery', () => {
    const hidden = level06.base.nodes.filter((n) => isSceneryNode(level06, n.id)).map((n) => n.id).sort();
    expect(hidden).toEqual(['arrive', 'cam', 'crate-1', 'crate-2', 'crate-3', 'end', 'eyes', 'floor', 'goal']);
  });

  it('every wire of the player lands on a port the card shows, and the locked wires cannot be taken', () => {
    for (const w of sol.wires) {
      for (const [node, port, dir] of [[w.from.node, w.from.port, 'out'], [w.to.node, w.to.port, 'in']] as const) {
        if (!level06.base.nodes.some((n) => n.id === node)) continue;
        const shown = shownPortsOf(level06, node)[dir];
        expect(shown?.has(port), `${w.id} ${node}.${port}`).toBe(true);
      }
    }
  });

  it('cards sit in a left column without overlapping', () => {
    const rows = (id: string): number => (level06.shownPorts![id]!.in?.length ?? 0) + (level06.shownPorts![id]!.out?.length ?? 0);
    const boxes = visible.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, h: 34 + 26 * rows(n.id) }));
    for (const b of boxes) expect(b.x).toBeLessThan(100);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        expect(a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('the tuning is locked in the safe band', () => {
    const lane = Math.round((GUARD_LANE.z2 - GUARD_LANE.z1) * 100) / 100;
    expect(lane).toBeGreaterThanOrEqual(3.2);
    expect(lane).toBeLessThanOrEqual(3.4);
    expect(GUARD_LANE.speed).toBeGreaterThanOrEqual(1.3);
    expect(GUARD_LANE.speed).toBeLessThanOrEqual(1.6);
    expect(GUARD_EYES.range).toBeGreaterThanOrEqual(8);
    expect(GUARD_EYES.range).toBeLessThanOrEqual(12);
    const cat = level06.base.nodes.find((n) => n.id === 'hero')!.params.speed as number;
    expect(cat).toBeGreaterThanOrEqual(3);
    expect(cat).toBeLessThanOrEqual(3.4);
  });

  it('every cover spot is hidden from every point of the guard lane, and the crates block sight (2.2 high)', () => {
    expect(CRATE_SIZE.y).toBeGreaterThanOrEqual(2);
    const boxes = LAYOUT.crates.map((c) => ({ position: { x: c.x, y: CRATE_SIZE.y / 2, z: c.z }, size: CRATE_SIZE }));
    for (const [k, s] of LAYOUT.spots.entries()) {
      for (let z = GUARD_LANE.z1; z <= GUARD_LANE.z2 + 1e-6; z += 0.05) {
        expect(segmentClear(boxes, '3d', { x: GUARD_LANE.x, y: 0.5, z }, { x: s.x, y: 0.5, z: s.z }), `spot ${k + 1} from lane z=${z.toFixed(2)}`).toBe(false);
      }
    }
    expect(routeOf(LAYOUT)).toHaveLength(5);
  });
});
