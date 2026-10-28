import { describe, expect, it } from 'vitest';
import type { SolidBox } from '../../src/engine/types';
import {
  MinHeap,
  buildPlaneGrid,
  buildSideGraph,
  findPlanePath,
  findSidePath,
  maxJumpRise,
  planeGridFor,
  sideGraphFor,
  type PlanePoint,
  type SideLimits,
} from '../../src/world/navigation';
import { createWorld } from '../../src/world/world';

const BODY = { halfWidth: 0.5, height: 1 };
const LIMITS: SideLimits = { speed: 5, jumpPower: 10 };

const box = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): SolidBox => ({
  position: { x, y, z },
  size: { x: sx, y: sy, z: sz },
});

/** ASCII map: every character is a `scale` x `scale` square; '#' is a wall. Origin at the top-left corner. */
function mazeBoxes(rows: readonly string[], scale = 2): SolidBox[] {
  const out: SolidBox[] = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '#') out.push(box((c + 0.5) * scale, 0.5, (r + 0.5) * scale, scale, 1, scale));
    });
  });
  return out;
}
const cellCenter = (c: number, r: number, scale = 2): PlanePoint => ({ x: (c + 0.5) * scale, z: (r + 0.5) * scale });

/** True when a body of half width `hw` sliding along the polyline never overlaps a box. */
function walkable(boxes: readonly SolidBox[], start: PlanePoint, points: readonly PlanePoint[], hw = 0.5): boolean {
  let prev = start;
  for (const p of points) {
    const len = Math.hypot(p.x - prev.x, p.z - prev.z);
    const n = Math.max(1, Math.ceil(len / 0.05));
    for (let i = 0; i <= n; i++) {
      const x = prev.x + ((p.x - prev.x) * i) / n;
      const z = prev.z + ((p.z - prev.z) * i) / n;
      for (const b of boxes) {
        const hitX = Math.abs(x - b.position.x) < b.size.x / 2 + hw - 0.02;
        const hitZ = Math.abs(z - b.position.z) < b.size.z / 2 + hw - 0.02;
        if (hitX && hitZ) return false;
      }
    }
    prev = p;
  }
  return true;
}

const MAZE = [
  '###########',
  '#S..#.....#',
  '#.#.#.###.#',
  '#.#...#...#',
  '#.#####.###',
  '#.......G.#',
  '###########',
];

describe('MinHeap', () => {
  it('pops by priority, then by smaller id', () => {
    const h = new MinHeap();
    h.push(2, 7);
    h.push(1, 9);
    h.push(1, 3);
    h.push(5, 1);
    expect([h.pop(), h.pop(), h.pop(), h.pop(), h.pop()]).toEqual([3, 9, 7, 1, -1]);
  });
});

describe('plane grid A* (top-down and 3D)', () => {
  const boxes = mazeBoxes(MAZE);
  const grid = buildPlaneGrid(boxes, BODY, 0)!;

  it('finds a route through the maze that a 1x1 body can really walk', () => {
    const start = cellCenter(1, 1);
    const res = findPlanePath(grid, start, cellCenter(8, 5))!;
    expect(res).not.toBeNull();
    expect(res.points.length).toBeGreaterThanOrEqual(2); // it has to turn a corner
    expect(walkable(boxes, start, [cellCenter(8, 5)])).toBe(false); // the straight line would hit walls
    expect(walkable(boxes, start, res.points)).toBe(true);
    const last = res.points[res.points.length - 1]!;
    expect(Math.hypot(last.x - cellCenter(8, 5).x, last.z - cellCenter(8, 5).z)).toBeLessThan(0.01);
  });

  it('the route is not absurdly long (octile-optimal on the grid, then straightened)', () => {
    const start = cellCenter(1, 1);
    const res = findPlanePath(grid, start, cellCenter(8, 5))!;
    let len = 0;
    let prev = start;
    for (const p of res.points) {
      len += Math.hypot(p.x - prev.x, p.z - prev.z);
      prev = p;
    }
    // Down the left corridor and along the bottom one: about 8 + 14 units of travel.
    expect(len).toBeLessThan(28);
  });

  it('goes straight when nothing is in the way', () => {
    const open = buildPlaneGrid([box(0, 0.5, 0), box(20, 0.5, 20)], BODY, 0)!;
    const res = findPlanePath(open, { x: 2, z: 2 }, { x: 15, z: 12 })!;
    expect(res.points).toEqual([{ x: 15, z: 12 }]);
  });

  it('leads to the closest reachable cell when the goal is sealed off', () => {
    const sealed = mazeBoxes(['###########', '#S..#.....#', '#.#.#.###.#', '#.#.#.#...#', '#.#####.###', '#.......G.#', '###########']);
    // Also close the bottom corridor.
    sealed.push(box(10, 0.5, 11, 2, 1, 2));
    const g = buildPlaneGrid(sealed, BODY, 0)!;
    expect(findPlanePath(g, cellCenter(1, 1), cellCenter(8, 5))?.partial).toBe(true); // unreachable: leads to the closest spot
  });

  it('moves a start or goal that sits inside a wall to the nearest free cell', () => {
    const inWall = { x: 9.0, z: 6.0 }; // inside the wall block at cell (4,3)
    const res = findPlanePath(grid, cellCenter(1, 1), { x: 8.9, z: 5.0 })!;
    expect(res).not.toBeNull();
    const fromWall = findPlanePath(grid, inWall, cellCenter(8, 5));
    expect(fromWall).not.toBeNull();
  });

  it('heads for the best cell so far when the search cap is hit', () => {
    expect(findPlanePath(grid, cellCenter(1, 1), cellCenter(8, 5), 5)?.partial).toBe(true); // unreachable: leads to the closest spot
  });

  it('is deterministic: fresh grids and repeated searches give identical routes', () => {
    const a = findPlanePath(buildPlaneGrid(boxes, BODY, 0)!, cellCenter(1, 1), cellCenter(8, 5));
    const b = findPlanePath(buildPlaneGrid(mazeBoxes(MAZE), BODY, 0)!, cellCenter(1, 1), cellCenter(8, 5));
    const c = findPlanePath(grid, cellCenter(1, 1), cellCenter(8, 5));
    const d = findPlanePath(grid, cellCenter(1, 1), cellCenter(8, 5));
    expect(a).toEqual(b);
    expect(c).toEqual(d);
    expect(a).toEqual(c);
  });

  it('ignores the floor but not walls in 3D bands, and builds nothing when there is nothing to avoid', () => {
    const floorOnly = [box(0, -0.5, 0, 40, 1, 40)];
    expect(buildPlaneGrid(floorOnly, BODY, 0)).toBeNull();
    expect(buildPlaneGrid([], BODY, 0)).toBeNull();
    expect(buildPlaneGrid([...floorOnly, box(3, 0.5, 3)], BODY, 0)).not.toBeNull();
    // A ledge the body stands below does not matter; the same block at the body's height does.
    expect(buildPlaneGrid([box(3, 3.5, 3)], BODY, 0)).toBeNull();
  });

  it('refuses levels too large to grid (the caller falls back to straight steering)', () => {
    expect(buildPlaneGrid([box(0, 0.5, 0), box(2000, 0.5, 2000)], BODY, 0)).toBeNull();
  });

  it('stays cheap: many replans on a big maze fit a small time budget', () => {
    const rows: string[] = [];
    for (let r = 0; r < 41; r++) {
      let row = '';
      for (let c = 0; c < 41; c++) row += r === 0 || c === 0 || r === 40 || c === 40 || (r % 4 === 0 && c % 10 !== (r / 4) % 10) ? '#' : '.';
      rows.push(row);
    }
    const big = buildPlaneGrid(mazeBoxes(rows), BODY, 0)!;
    const t0 = performance.now();
    let found = 0;
    for (let i = 0; i < 40; i++) {
      if (findPlanePath(big, cellCenter(1, 1), cellCenter(39, 39))) found++;
    }
    const ms = performance.now() - t0;
    expect(found).toBe(40);
    expect(ms).toBeLessThan(1500); // ~40 ms in practice; generous so slow CI does not flake
  });
});

// ---------- side view ----------

const slab = (x0: number, x1: number, top: number, thick = 0.5): SolidBox =>
  box((x0 + x1) / 2, top - thick / 2, 0, x1 - x0, thick, 1);

function sidePath(boxes: SolidBox[], from: [number, number], to: [number, number], limits = LIMITS) {
  const graph = buildSideGraph(boxes, BODY)!;
  return findSidePath(graph, { x: from[0], feetY: from[1] }, { x: to[0], feetY: to[1] }, limits);
}
const kinds = (p: ReturnType<typeof sidePath>): string[] => (p ? p.steps.map((s) => s.kind) : []);

describe('side-view platform graph', () => {
  it('walks along flat ground', () => {
    const p = sidePath([slab(0, 12, 0, 1)], [1, 0], [9, 0]);
    expect(p).not.toBeNull();
    expect(new Set(kinds(p))).toEqual(new Set(['walk']));
  });

  it('jumps up onto a ledge one unit high', () => {
    const p = sidePath([slab(-5, 15, 0, 1), slab(5, 8, 1)], [0, 0], [6.5, 1]);
    expect(kinds(p)).toContain('jump');
    const jump = p!.steps.find((s) => s.kind === 'jump')!;
    expect(jump.y).toBeCloseTo(1, 5);
    expect(jump.srcY).toBeCloseTo(0, 5);
  });

  it('derives the rise limit from the jump power: 2 high needs more than the default', () => {
    expect(maxJumpRise(10)).toBeGreaterThan(1.4);
    expect(maxJumpRise(10)).toBeLessThan(1.667); // the continuous apex v^2 / 2g
    const level = [slab(-5, 15, 0, 1), slab(5, 8, 2)];
    expect(sidePath(level, [0, 0], [6.5, 2])?.partial).toBe(true); // unreachable: leads to the closest spot
    expect(kinds(sidePath(level, [0, 0], [6.5, 2], { speed: 5, jumpPower: 14 }))).toContain('jump');
    expect(sidePath(level, [0, 0], [6.5, 2], { speed: 5, jumpPower: 5 })?.partial).toBe(true); // unreachable: leads to the closest spot
  });

  it('climbs a staircase of ledges one hop at a time', () => {
    const level = [slab(-5, 20, 0, 1), slab(2, 4, 1), slab(6, 8, 2), slab(10, 12, 3)];
    const p = sidePath(level, [0, 0], [11, 3]);
    expect(kinds(p).filter((k) => k === 'jump').length).toBeGreaterThanOrEqual(3);
    expect(p!.steps[p!.steps.length - 1]!.y).toBeCloseTo(3, 5);
  });

  it('jumps across a gap, and the reach comes from speed and jump power', () => {
    const gap = (width: number) => [slab(-6, 4, 0, 1), slab(4 + width, 20, 0, 1)];
    expect(kinds(sidePath(gap(2), [0, 0], [10, 0]))).toContain('jump');
    expect(sidePath(gap(6), [0, 0], [12, 0])?.partial).toBe(true); // unreachable: leads to the closest spot
    expect(kinds(sidePath(gap(6), [0, 0], [12, 0], { speed: 12, jumpPower: 10 }))).toContain('jump');
    // A gap exactly as wide as the body is still a jump: nothing holds the body up halfway across.
    expect(kinds(sidePath(gap(1), [0, 0], [10, 0]))).toContain('jump');
  });

  it('an unreachable goal leads to the spot nearest to it (the brink of the gap) and is marked partial', () => {
    const gap6 = [slab(-6, 4, 0, 1), slab(10, 20, 0, 1)];
    const p = sidePath(gap6, [0, 0], [14, 0])!;
    expect(p.partial).toBe(true);
    const last = p.steps[p.steps.length - 1]!;
    expect(last.x).toBeGreaterThan(3);
    expect(last.x).toBeLessThan(4.5);
    // Already standing at the closest spot: nothing to walk.
    const here = sidePath(gap6, [4.25, 0], [14, 0])!;
    expect(here).toEqual({ steps: [], partial: true });
  });

  it('drops down from a high ledge but cannot climb back up', () => {
    const level = [slab(-5, 20, 0, 1), slab(-3, 1, 5)];
    expect(kinds(sidePath(level, [-2, 5], [10, 0]))).toContain('drop');
    expect(sidePath(level, [10, 0], [-2, 5])?.partial).toBe(true); // unreachable: leads to the closest spot
  });

  it('does not plan a jump through a low ceiling', () => {
    const open = [slab(-5, 15, 0, 1), slab(5, 8, 1)];
    expect(sidePath(open, [0, 0], [6.5, 1])).not.toBeNull();
    // A slab just above the ledge leaves no room to arc up onto it from the left or to stand on it.
    const ceiling = [...open, slab(3, 9, 2.2)];
    expect(sidePath(ceiling, [0, 0], [6.5, 1])?.partial).toBe(true); // unreachable: leads to the closest spot
  });

  it('reports an empty route when start and goal share a spot, and null for a missing floor', () => {
    expect(sidePath([slab(0, 12, 0, 1)], [3, 0], [3.1, 0])!.steps).toEqual([]);
    expect(sidePath([slab(0, 12, 0, 1)], [30, 0], [3, 0])).toBeNull();
    expect(buildSideGraph([], BODY)).toBeNull();
  });

  it('stays cheap on a long level with many ledges, and a second search reuses the edges', () => {
    const level: SolidBox[] = [slab(-10, 200, 0, 1)];
    for (let i = 0; i < 60; i++) {
      const top = 1 + (i % 3) * 0.5;
      level.push(slab(2 + i * 3, 4 + i * 3, top, top)); // solid blocks standing on the ground
    }
    const graph = buildSideGraph(level, BODY)!;
    const t0 = performance.now();
    const first = findSidePath(graph, { x: 0, feetY: 0 }, { x: 170, feetY: 0 }, LIMITS);
    const t1 = performance.now();
    const second = findSidePath(graph, { x: 0, feetY: 0 }, { x: 170, feetY: 0 }, LIMITS);
    const t2 = performance.now();
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(t1 - t0).toBeLessThan(1500);
    expect(t2 - t1).toBeLessThan(t1 - t0 + 50);
  });

  it('is deterministic and caches edges per limits', () => {
    const level = [slab(-5, 20, 0, 1), slab(2, 4, 1), slab(6, 8, 2)];
    const a = sidePath(level, [0, 0], [7, 2]);
    const b = sidePath(level, [0, 0], [7, 2]);
    expect(a).toEqual(b);
    const graph = buildSideGraph(level, BODY)!;
    const q = (l: SideLimits) => findSidePath(graph, { x: 0, feetY: 0 }, { x: 7, feetY: 2 }, l);
    expect(q(LIMITS)).toEqual(q(LIMITS));
    expect(graph.edges.size).toBe(1);
    q({ speed: 6, jumpPower: 11 });
    expect(graph.edges.size).toBe(2);
  });
});

// ---------- per-world cache ----------

describe('navigation cache', () => {
  function levelWithDoor() {
    const world = createWorld('2d-top');
    const spawn = (b: SolidBox) =>
      world.spawn({ kind: 'block', ownerNodeId: 'b', position: b.position, size: b.size, color: '#999', solid: true });
    // A wall across x=10 from z=-10 to z=10 (a door piece at the middle).
    spawn(box(10, 0.5, -6, 1, 1, 8));
    spawn(box(10, 0.5, 6, 1, 1, 8));
    const door = spawn(box(10, 0.5, 0, 1, 1, 4));
    // A frame so the level has bounds.
    spawn(box(10, 0.5, -11, 24, 1, 1));
    spawn(box(10, 0.5, 11, 24, 1, 1));
    return { world, door };
  }

  it('reuses the grid while nothing changes and rebuilds when a block is hidden', () => {
    const { world, door } = levelWithDoor();
    const g1 = planeGridFor(world, BODY, 0);
    expect(planeGridFor(world, BODY, 0)).toBe(g1);
    expect(findPlanePath(g1!, { x: 2, z: 0 }, { x: 18, z: 0 })).not.toBeNull(); // around the wall ends

    world.hide(door);
    const g2 = planeGridFor(world, BODY, 0);
    expect(g2).not.toBe(g1);
    const through = findPlanePath(g2!, { x: 2, z: 0 }, { x: 18, z: 0 })!;
    expect(through.points).toEqual([{ x: 18, z: 0 }]); // straight through the opened door
  });

  it('keeps separate entries per body size and bumps the revision only for solid blocks', () => {
    const { world } = levelWithDoor();
    const rev = world.solidRevision();
    world.spawn({ kind: 'block', ownerNodeId: 'p', position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: false });
    world.spawn({ kind: 'character', ownerNodeId: 'c', position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true });
    expect(world.solidRevision()).toBe(rev);
    const small = planeGridFor(world, { halfWidth: 0.25, height: 0.5 }, 0);
    expect(small).not.toBe(planeGridFor(world, BODY, 0));
    expect(sideGraphFor(world, BODY)).toBe(sideGraphFor(world, BODY));
  });
});
