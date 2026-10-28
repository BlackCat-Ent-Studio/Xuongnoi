import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type EntityView, type SolidBox, type Vec3, type ViewMode, type World } from '../../src/engine/types';
import { MIN_REPLAN_GAP, REPLAN_INTERVAL, pathStep } from '../../src/nodes/path-follower';
import { followPath, nextWaypoint } from '../../src/nodes/steering';
import { createWorld } from '../../src/world/world';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

interface Rig {
  world: World;
  id: EntityId;
  memo: Record<string, unknown>;
  self(): EntityView;
  /** Runs up to `ticks` ticks toward `goal()`; stops early when within `stop` of it. Returns the tick count used. */
  run(goal: () => Vec3, ticks: number, opts?: { straight?: boolean; stop?: number; onTick?: (rig: Rig, tick: number) => void }): number;
}

function rig(mode: ViewMode, blocks: SolidBox[], start: Vec3, drive = { speed: 5, jumpPower: 10 }): Rig {
  const world = createWorld(mode);
  blocks.forEach((b, i) =>
    world.spawn({ kind: 'block', ownerNodeId: `b${i}`, position: b.position, size: b.size, color: '#777', solid: true }),
  );
  const id = world.spawn({ kind: 'character', ownerNodeId: 'bot', position: start, size: v(1, 1, 1), color: '#f00', role: 'bot', solid: true });
  const memo: Record<string, unknown> = {};
  const r: Rig = {
    world,
    id,
    memo,
    self: () => world.getEntity(id)!,
    run(goal, ticks, opts = {}) {
      for (let t = 0; t < ticks; t++) {
        const self = r.self();
        const g = goal();
        const planar = Math.hypot(g.x - self.position.x, mode === '2d-side' ? 0 : g.z - self.position.z);
        if (planar <= (opts.stop ?? 0.3) && (mode === '2d-top' || Math.abs(g.y - self.position.y) < 1.5)) return t;
        opts.onTick?.(r, t);
        const steer = followPath({ world, self, goal: g, dt: TICK_DT, memo, straight: opts.straight });
        world.setCharacterIntent(id, { moveX: steer.moveX, moveY: steer.moveY, jump: steer.jump, ...drive });
        world.step(TICK_DT);
      }
      return ticks;
    },
  };
  return r;
}

const box = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): SolidBox => ({ position: v(x, y, z), size: v(sx, sy, sz) });
const slab = (x0: number, x1: number, top: number, thick = 0.5): SolidBox => box((x0 + x1) / 2, top - thick / 2, 0, x1 - x0, thick, 1);

/** A U-shaped pocket: the goal is inside, the opening faces away from the bot. */
function pocketLevel(): SolidBox[] {
  return [
    box(10, 0.5, -4, 1, 1, 8), // west wall between the bot and the goal
    box(14, 0.5, -8, 9, 1, 1), // north
    box(14, 0.5, 0, 9, 1, 1), // south
    box(18.5, 0.5, -4, 1, 1, 9), // east
    box(10, 0.5, -12, 20, 1, 1), // outer frame
    box(10, 0.5, 4, 20, 1, 1),
  ];
}

describe('top-down path following', () => {
  it('walks around a wall to a goal that straight steering cannot reach', () => {
    // A wall at x=8 from z=-3 to z=5 between two frame walls: the only way round is the opening in the north.
    const level = [box(8, 0.5, 1, 1, 1, 8), box(8, 0.5, -6, 20, 1, 1), box(8, 0.5, 6, 20, 1, 1)];
    const goal = v(14, 0.5, 2);

    const straight = rig('2d-top', level, v(2, 0.5, 2));
    straight.run(() => goal, 600, { straight: true });
    expect(straight.self().position.x).toBeLessThan(8); // stuck on the wall

    const routed = rig('2d-top', level, v(2, 0.5, 2));
    const used = routed.run(() => goal, 900);
    expect(used).toBeLessThan(900);
    expect(routed.self().position.x).toBeGreaterThan(13);
  });

  it('threads a maze to the exit', () => {
    const rows = ['###########', '#S..#.....#', '#.#.#.###.#', '#.#...#...#', '#.#####.###', '#.......G.#', '###########'];
    const level: SolidBox[] = [];
    rows.forEach((row, r) => [...row].forEach((ch, c) => ch === '#' && level.push(box((c + 0.5) * 2, 0.5, (r + 0.5) * 2, 2, 1, 2))));
    const r = rig('2d-top', level, v(3, 0.5, 3));
    const used = r.run(() => v(17, 0.5, 11), 60 * 40, { stop: 0.4 });
    expect(used).toBeLessThan(60 * 40);
    expect(Math.hypot(r.self().position.x - 17, r.self().position.z - 11)).toBeLessThan(0.5);
  });

  it('works in 3D too, whatever the camera yaw', () => {
    for (const yaw of [0, 1.1, -2.4]) {
      const level = [box(5, 0.5, 0, 1, 1, 6), box(5, -0.5, 0, 40, 1, 40)]; // wall plus the floor
      const r = rig('3d', level, v(0, 0.5, 0));
      r.world.setCameraYaw(yaw);
      const used = r.run(() => v(10, 0.5, 0), 60 * 20, { stop: 0.4 });
      expect(used).toBeLessThan(60 * 20);
    }
  });

  it('is deterministic: two identical runs walk identical tracks', () => {
    const track = (): string => {
      const r = rig('2d-top', pocketLevel(), v(2, 0.5, -4));
      const pts: string[] = [];
      r.run(() => v(14, 0.5, -4), 600, {
        onTick: (rr, t) => {
          if (t % 10 === 0) pts.push(`${rr.self().position.x.toFixed(4)},${rr.self().position.z.toFixed(4)}`);
        },
      });
      return pts.join(';');
    };
    expect(track()).toBe(track());
  });

  it('opens a new way when a block is hidden mid-run', () => {
    // A sealed room split by one wall (block #0).
    const level = [
      box(8, 0.5, 0, 1, 1, 14),
      box(8, 0.5, -7.5, 22, 1, 1),
      box(8, 0.5, 7.5, 22, 1, 1),
      box(-2.5, 0.5, 0, 1, 1, 16),
      box(18.5, 0.5, 0, 1, 1, 16),
    ];
    const r = rig('2d-top', level, v(2, 0.5, 0));
    // The wall seals the level (it is block #0); a goal behind it has no route, so the bot heads for the closest reachable cell.
    const first = pathStep({ world: r.world, self: r.self(), goal: v(14, 0.5, 0), dt: TICK_DT, memo: r.memo }).waypoint;
    expect(first.x).toBeLessThan(8);
    expect((r.memo.nav as { partial: boolean }).partial).toBe(true);
    const used = r.run(() => v(14, 0.5, 0), 120, {
      onTick: (rr, t) => {
        if (t === 30) rr.world.hide(rr.world.entities().find((e) => e.ownerNodeId === 'b0')!.id);
      },
    });
    expect(used).toBeLessThan(120 + 1);
    expect(r.self().position.x).toBeGreaterThan(8);
  });
});

describe('route bookkeeping', () => {
  const openLevel = () => rig('2d-top', [box(8, 0.5, 0, 1, 1, 6), box(8, 0.5, -10, 30, 1, 1), box(8, 0.5, 10, 30, 1, 1)], v(2, 0.5, 6));
  const nav = (r: Rig) => r.memo.nav as { wps: { pos: Vec3 }[]; age: number; routed: boolean; partial: boolean };

  it('heads for the closest reachable cell and then stays put when the goal is walled in', () => {
    // Fully walled-in goal.
    const level = [box(10, 0.5, 0, 6, 1, 1), box(10, 0.5, 6, 6, 1, 1), box(7, 0.5, 3, 1, 1, 5), box(13, 0.5, 3, 1, 1, 5), box(8, 0.5, 14, 30, 1, 1)];
    const r = rig('2d-top', level, v(0, 0.5, 3));
    const goal = v(10, 0.5, 3);
    const wp = nextWaypoint({ world: r.world, self: r.self(), goal, dt: TICK_DT, memo: r.memo });
    expect(wp).not.toBe(goal);
    expect(wp.z).toBeGreaterThan(6.5); // outside the south wall, the closest spot to the goal
    expect(nav(r).routed).toBe(true);
    expect((r.memo.nav as { partial: boolean }).partial).toBe(true);
    const used = r.run(() => goal, 600);
    expect(used).toBe(600); // never arrives
    expect(Math.abs(r.self().position.x - 10)).toBeLessThan(0.6);
    expect(r.self().position.z).toBeGreaterThan(6.5);
    // Settled: no more creeping into the wall.
    const before = { ...r.self().position };
    r.run(() => goal, 60);
    expect(Math.hypot(r.self().position.x - before.x, r.self().position.z - before.z)).toBeLessThan(0.05);
  });

  it('replans when the goal moves to another cell, at most every MIN_REPLAN_GAP, and otherwise on the timer', () => {
    const r = openLevel();
    const self = r.self();
    pathStep({ world: r.world, self, goal: v(14, 0.5, -6), dt: TICK_DT, memo: r.memo });
    const first = nav(r).wps.at(-1)!.pos;
    expect(first.x).toBeCloseTo(14, 5);
    // The goal jumps; too soon to replan, so the old route stays.
    pathStep({ world: r.world, self, goal: v(14, 0.5, 8), dt: TICK_DT, memo: r.memo });
    expect(nav(r).wps.at(-1)!.pos.z).toBeCloseTo(-6, 5);
    // After the gap, the new goal cell triggers a replan.
    for (let t = 0; t < Math.ceil(MIN_REPLAN_GAP / TICK_DT); t++) pathStep({ world: r.world, self, goal: v(14, 0.5, 8), dt: TICK_DT, memo: r.memo });
    expect(nav(r).wps.at(-1)!.pos.z).toBeCloseTo(8, 5);
  });

  it('never replans more often than the gap while a target keeps moving, and replans on the timer when it stands still', () => {
    const r = openLevel();
    const self = r.self();
    let replans = 0;
    let lastAge = Infinity;
    const seconds = 3;
    for (let t = 0; t < seconds * 60; t++) {
      const moving = v(12 + (t % 40) * 0.1, 0.5, -6 + (t % 7));
      pathStep({ world: r.world, self, goal: moving, dt: TICK_DT, memo: r.memo });
      const age = nav(r).age;
      if (age < lastAge) replans++;
      lastAge = age;
    }
    expect(replans).toBeLessThanOrEqual(Math.ceil(seconds / MIN_REPLAN_GAP) + 1);
    expect(replans).toBeGreaterThan(seconds / REPLAN_INTERVAL - 1);

    const still = openLevel();
    let timed = 0;
    lastAge = Infinity;
    for (let t = 0; t < seconds * 60; t++) {
      pathStep({ world: still.world, self: still.self(), goal: v(14, 0.5, -6), dt: TICK_DT, memo: still.memo });
      const age = nav(still).age;
      if (age < lastAge) timed++;
      lastAge = age;
    }
    expect(timed).toBeLessThanOrEqual(Math.ceil(seconds / REPLAN_INTERVAL) + 1);
  });

  it('flee style (straight) never touches the planner', () => {
    const r = openLevel();
    const goal = v(14, 0.5, -6);
    expect(pathStep({ world: r.world, self: r.self(), goal, dt: TICK_DT, memo: r.memo, straight: true }).waypoint).toBe(goal);
    expect(r.memo.nav).toBeUndefined();
  });
});

describe('side-view path following', () => {
  it('climbs a staircase of ledges to a star', () => {
    const level = [slab(-8, 20, 0, 1), slab(1, 3, 1), slab(5, 7, 2), slab(9, 11, 3)];
    const r = rig('2d-side', level, v(-3, 0.5, 0));
    const used = r.run(() => v(10, 3.5, 0), 60 * 20, { stop: 0.4 });
    expect(used).toBeLessThan(60 * 20);
    expect(r.self().position.y).toBeGreaterThan(3.4);
    expect(Math.abs(r.self().position.x - 10)).toBeLessThan(0.7);
  });

  it('leaps a gap wider than the straight-steering hop can cope with', () => {
    const level = [slab(-8, 3, 0, 1), slab(6, 20, 0, 1)]; // 3 wide
    const r = rig('2d-side', level, v(-3, 0.5, 0));
    const used = r.run(() => v(12, 0.5, 0), 60 * 15, { stop: 0.4 });
    expect(used).toBeLessThan(60 * 15);
    expect(r.self().position.y).toBeGreaterThan(0.4);
  });

  it('drops off a high ledge, crosses the ground and climbs the far ledge', () => {
    const level = [slab(-8, 20, 0, 1), slab(-9, -5, 3), slab(8, 12, 1)];
    const r = rig('2d-side', level, v(-7, 3.5, 0));
    const used = r.run(() => v(10, 1.5, 0), 60 * 20, { stop: 0.4 });
    expect(used).toBeLessThan(60 * 20);
    expect(r.self().position.y).toBeGreaterThan(1.4);
  });

  it('uses the character own jump power: a 2-high ledge needs a stronger jump', () => {
    const level = [slab(-8, 20, 0, 1), slab(3, 8, 2)];
    const weak = rig('2d-side', level, v(-3, 0.5, 0), { speed: 5, jumpPower: 10 });
    weak.run(() => v(6, 2.5, 0), 60 * 6, { stop: 0.4 });
    expect(weak.self().position.y).toBeLessThan(1); // no route: it stays on the ground
    const strong = rig('2d-side', level, v(-3, 0.5, 0), { speed: 5, jumpPower: 14 });
    const used = strong.run(() => v(6, 2.5, 0), 60 * 10, { stop: 0.4 });
    expect(used).toBeLessThan(60 * 10);
    expect(strong.self().position.y).toBeGreaterThan(2.4);
  });

  it('only jumps when the route says so: walking flat ground never leaves it', () => {
    const r = rig('2d-side', [slab(-8, 30, 0, 1)], v(-3, 0.5, 0));
    let maxY = 0;
    r.run(() => v(20, 0.5, 0), 60 * 8, { onTick: (rr) => void (maxY = Math.max(maxY, rr.self().position.y)) });
    expect(maxY).toBeLessThan(0.55);
  });

  it('replans after the goal moves to another ledge', () => {
    const level = [slab(-8, 20, 0, 1), slab(1, 3, 1), slab(5, 7, 2), slab(9, 11, 3)];
    const r = rig('2d-side', level, v(-3, 0.5, 0));
    let goal = v(2, 1.5, 0);
    r.run(() => goal, 60 * 6, { stop: 0.4 });
    expect(r.self().position.y).toBeGreaterThan(1.4);
    goal = v(10, 3.5, 0);
    const used = r.run(() => goal, 60 * 15, { stop: 0.4 });
    expect(used).toBeLessThan(60 * 15);
    expect(r.self().position.y).toBeGreaterThan(3.4);
  });

  it('is deterministic', () => {
    const track = (): string => {
      const r = rig('2d-side', [slab(-8, 20, 0, 1), slab(1, 3, 1), slab(5, 7, 2)], v(-3, 0.5, 0));
      const pts: string[] = [];
      r.run(() => v(6, 2.5, 0), 60 * 8, {
        onTick: (rr, t) => {
          if (t % 5 === 0) pts.push(`${rr.self().position.x.toFixed(4)},${rr.self().position.y.toFixed(4)}`);
        },
      });
      return pts.join(';');
    };
    expect(track()).toBe(track());
  });
});
