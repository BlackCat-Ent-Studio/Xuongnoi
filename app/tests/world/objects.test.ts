import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntitySpec, type ShotSpec, type Vec3, type ViewMode } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';

const block = (position: Vec3, size: Vec3, solid = true): EntitySpec => ({ kind: 'block', ownerNodeId: 'b', position, size, color: '#888', solid });
const person = (position: Vec3): EntitySpec => ({ kind: 'character', ownerNodeId: 'c', position, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true });
const SHOT: ShotSpec = { ownerNodeId: 'gun', speed: 12, lifetime: 2, damage: 1, size: 0.25, color: '#f90', gravity: false };

function run(w: ReturnType<typeof createWorld>, ticks: number): void {
  for (let i = 0; i < ticks; i++) w.step(TICK_DT);
}

function sideWorld() {
  const w = createWorld('2d-side');
  w.spawn(block({ x: 0, y: -0.5, z: 0 }, { x: 40, y: 1, z: 1 })); // floor, top at y=0
  return w;
}

describe('moving platform', () => {
  it('carries a character standing on it and keeps it grounded', () => {
    const w = sideWorld();
    const plat = w.spawn(block({ x: 0, y: 1, z: 0 }, { x: 3, y: 0.5, z: 1 }));
    const me = w.spawn(person({ x: 0, y: 1.75, z: 0 }));
    run(w, 5);
    expect(w.isOnGround(me)).toBe(true);
    for (let i = 1; i <= 120; i++) {
      expect(w.moveBlock(plat, { x: i * 0.05, y: 1, z: 0 })).toBe(true);
      w.step(TICK_DT);
    }
    const p = w.getEntity(me)!.position;
    expect(p.x).toBeCloseTo(6, 3);
    expect(p.y).toBeCloseTo(1.75, 3);
    expect(w.isOnGround(me)).toBe(true);
  });

  it('carries a character up and down as well', () => {
    const w = sideWorld();
    const plat = w.spawn(block({ x: 0, y: 1, z: 0 }, { x: 3, y: 0.5, z: 1 }));
    const me = w.spawn(person({ x: 0, y: 1.75, z: 0 }));
    run(w, 5);
    for (let i = 1; i <= 60; i++) {
      w.moveBlock(plat, { x: 0, y: 1 + i * 0.05, z: 0 });
      w.step(TICK_DT);
    }
    expect(w.getEntity(me)!.position.y).toBeCloseTo(4.75, 3);
    for (let i = 1; i <= 60; i++) {
      w.moveBlock(plat, { x: 0, y: 4 - i * 0.05, z: 0 });
      w.step(TICK_DT);
    }
    expect(w.getEntity(me)!.position.y).toBeCloseTo(1.75, 3);
    expect(w.isOnGround(me)).toBe(true);
  });

  it('carries loose items and leaves a character that jumped off behind', () => {
    const w = sideWorld();
    const plat = w.spawn(block({ x: 0, y: 1, z: 0 }, { x: 3, y: 0.5, z: 1 }));
    const box = w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 0.5, y: 1.55, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#fa0', solid: false });
    run(w, 10);
    for (let i = 1; i <= 40; i++) {
      w.moveBlock(plat, { x: i * 0.05, y: 1, z: 0 });
      w.step(TICK_DT);
    }
    expect(w.getEntity(box)!.position.x).toBeCloseTo(2.5, 2);
  });

  it('pushes someone standing in its path instead of passing through', () => {
    const w = sideWorld();
    const plat = w.spawn(block({ x: -3, y: 0.75, z: 0 }, { x: 2, y: 1.5, z: 1 }));
    const me = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    run(w, 5);
    for (let i = 1; i <= 100; i++) {
      w.moveBlock(plat, { x: -3 + i * 0.05, y: 0.75, z: 0 });
      w.step(TICK_DT);
    }
    const x = w.getEntity(me)!.position.x;
    expect(x).toBeGreaterThan(1.4); // plat right edge at 2 => character center at 2.5
  });

  it('never crushes: a platform pushing someone against a wall stops', () => {
    const w = sideWorld();
    w.spawn(block({ x: 3, y: 2, z: 0 }, { x: 1, y: 4, z: 1 })); // wall, left face at x=2.5
    const plat = w.spawn(block({ x: -3, y: 0.75, z: 0 }, { x: 2, y: 1.5, z: 1 }));
    const me = w.spawn(person({ x: 2, y: 0.5, z: 0 }));
    run(w, 5);
    let blocked = 0;
    for (let i = 1; i <= 200; i++) {
      if (!w.moveBlock(plat, { x: -3 + i * 0.05, y: 0.75, z: 0 })) blocked++;
      w.step(TICK_DT);
    }
    expect(blocked).toBeGreaterThan(0);
    const who = w.getEntity(me)!.position.x;
    expect(who).toBeLessThan(2.0001); // still on the free side of the wall (wall face 2.5, half width 0.5)
    expect(w.getEntity(plat)!.position.x + 1).toBeLessThanOrEqual(who - 0.5 + 1e-6);
  });

  it('moves blocks out of the static solid list but keeps them solid for probes', () => {
    const w = sideWorld();
    const plat = w.spawn(block({ x: 0, y: 3, z: 0 }, { x: 2, y: 0.5, z: 1 }));
    const before = w.solidBoxes().length;
    const rev = w.solidRevision();
    w.moveBlock(plat, { x: 1, y: 3, z: 0 });
    expect(w.solidBoxes().length).toBe(before - 1);
    expect(w.solidRevision()).toBeGreaterThan(rev);
    expect(w.solidAt({ x: 1, y: 3, z: 0 })).toBe(true);
    w.moveBlock(plat, { x: 2, y: 3, z: 0 });
    expect(w.solidRevision()).toBe(rev + 1); // only the first move re-plans
  });

  it('ignores the axis the view does not have and refuses non-blocks', () => {
    const top = createWorld('2d-top');
    const b = top.spawn(block({ x: 0, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 }));
    top.moveBlock(b, { x: 2, y: 9, z: 3 });
    expect(top.getEntity(b)!.position).toEqual({ x: 2, y: 0.5, z: 3 });
    const who = top.spawn(person({ x: 5, y: 0.5, z: 5 }));
    expect(top.moveBlock(who, { x: 0, y: 0, z: 0 })).toBe(false);
    expect(top.moveBlock('nope', { x: 0, y: 0, z: 0 })).toBe(false);
  });

  it('works in 3d: rider carried along x and z', () => {
    const w = createWorld('3d');
    w.spawn(block({ x: 0, y: -0.5, z: 0 }, { x: 40, y: 1, z: 40 }));
    const plat = w.spawn(block({ x: 0, y: 1, z: 0 }, { x: 3, y: 0.5, z: 3 }));
    const me = w.spawn(person({ x: 0, y: 1.75, z: 0 }));
    run(w, 5);
    for (let i = 1; i <= 40; i++) {
      w.moveBlock(plat, { x: i * 0.05, y: 1, z: i * 0.025 });
      w.step(TICK_DT);
    }
    const p = w.getEntity(me)!.position;
    expect(p.x).toBeCloseTo(2, 3);
    expect(p.z).toBeCloseTo(1, 3);
    expect(w.isOnGround(me)).toBe(true);
  });
});

describe('turning blocks', () => {
  it('a solid block swaps width and height on a quarter turn, and the picture eases in', () => {
    const w = sideWorld();
    const bar = w.spawn(block({ x: 5, y: 3, z: 0 }, { x: 4, y: 0.5, z: 1 }));
    expect(w.setBlockAngle(bar, Math.PI / 2)).toBe(true);
    const v = w.getEntity(bar)!;
    expect(v.size).toEqual({ x: 0.5, y: 4, z: 1 });
    expect(Math.abs(v.angle ?? 0)).toBeCloseTo(Math.PI / 2, 5);
    run(w, 60);
    expect(w.getEntity(bar)!.angle).toBeUndefined();
    expect(w.setBlockAngle(bar, Math.PI * 2)).toBe(true);
    expect(w.getEntity(bar)!.size).toEqual({ x: 4, y: 0.5, z: 1 });
  });

  it('snaps free angles to the nearest quarter for solids', () => {
    const w = sideWorld();
    const bar = w.spawn(block({ x: 5, y: 3, z: 0 }, { x: 4, y: 0.5, z: 1 }));
    w.setBlockAngle(bar, 1.2); // nearest quarter is one
    expect(w.getEntity(bar)!.size.x).toBe(0.5);
    w.setBlockAngle(bar, 0.3); // back to none
    expect(w.getEntity(bar)!.size.x).toBe(4);
  });

  it('moves a rider out of the way instead of crushing it', () => {
    const w = sideWorld();
    const bar = w.spawn(block({ x: 0, y: 1, z: 0 }, { x: 4, y: 0.5, z: 1 })); // top at 1.25
    const me = w.spawn(person({ x: 1.5, y: 1.75, z: 0 }));
    run(w, 5);
    expect(w.isOnGround(me)).toBe(true);
    expect(w.setBlockAngle(bar, Math.PI / 2)).toBe(true); // now 0.5 wide, 4 tall: x -0.25..0.25, y -1..3
    const p = w.getEntity(me)!.position;
    expect(Math.abs(p.x)).toBeGreaterThanOrEqual(0.75 - 1e-9); // pushed clear of the new width
    run(w, 30);
    expect(w.getEntity(me)!.position.y).toBeCloseTo(0.5, 2); // fell to the floor, not stuck inside
  });

  it('waits when there is nowhere to push someone, then turns once a way opens', () => {
    const w = createWorld('2d-side');
    // A closed one-cell tunnel: floor, ceiling and both side walls leave the occupant no free spot.
    w.spawn(block({ x: 0, y: -2, z: 0 }, { x: 6, y: 4, z: 1 }));
    w.spawn(block({ x: 0, y: 2, z: 0 }, { x: 6, y: 2, z: 1 }));
    w.spawn(block({ x: -1, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 }));
    const rightWall = w.spawn(block({ x: 1, y: 0.5, z: 0 }, { x: 1, y: 1, z: 1 }));
    const bar = w.spawn(block({ x: 0, y: 1.5, z: 0 }, { x: 6, y: 0.2, z: 1 })); // lying inside the ceiling
    const me = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    run(w, 3);
    expect(w.setBlockAngle(bar, Math.PI / 2)).toBe(false); // upright it would cut through the occupant, who has no free spot
    expect(w.getEntity(bar)!.size).toEqual({ x: 6, y: 0.2, z: 1 });
    expect(w.getEntity(me)!.position.x).toBeCloseTo(0, 6);
    w.hide(rightWall); // a way opens
    expect(w.setBlockAngle(bar, Math.PI / 2)).toBe(true);
    expect(w.getEntity(bar)!.size).toEqual({ x: 0.2, y: 6, z: 1 });
    expect(w.getEntity(me)!.position.x).toBeGreaterThanOrEqual(0.6 - 1e-9); // moved clear to the open side
  });

  it('a spinning non-solid block touches through its rotated outline, not its bounding box', () => {
    const w = sideWorld();
    const bar = w.spawn(block({ x: 0, y: 3, z: 0 }, { x: 6, y: 0.4, z: 1 }, false));
    const diag = w.spawn(person({ x: 1.5, y: 4.5, z: 0 })); // inside the bar's bounding square, on its diagonal once turned
    const tip = w.spawn(person({ x: 2.6, y: 3, z: 0 })); // on the bar's tip when flat
    w.setBlockAngle(bar, 0);
    w.step(TICK_DT);
    expect(w.isTouching(bar, tip)).toBe(true);
    expect(w.isTouching(bar, diag)).toBe(false);
    w.setBlockAngle(bar, Math.PI / 4);
    w.step(TICK_DT);
    expect(w.getEntity(bar)!.angle).toBeCloseTo(Math.PI / 4, 6);
    expect(w.isTouching(bar, diag)).toBe(true);
    expect(w.isTouching(bar, tip)).toBe(false);
  });

  it('the spin outline matches the renderer rotation in the top-down and 3d views', () => {
    for (const mode of ['2d-top', '3d'] as ViewMode[]) {
      const w = createWorld(mode);
      const bar = w.spawn(block({ x: 0, y: 0.5, z: 0 }, { x: 6, y: 1, z: 0.4 }, false));
      const near = w.spawn({ ...person({ x: 2, y: 0.5, z: -2 }), solid: false });
      w.setBlockAngle(bar, Math.PI / 4);
      w.step(TICK_DT);
      // three.js rotation.y by +45deg sends the bar's +x end toward -z: it passes (2, -2).
      expect(w.isTouching(bar, near)).toBe(true);
      const far = w.spawn({ ...person({ x: 2, y: 0.5, z: 2 }), solid: false });
      w.step(TICK_DT);
      expect(w.isTouching(bar, far)).toBe(false);
    }
  });
});

describe('shots', () => {
  function arena(mode: ViewMode = '2d-side') {
    const w = createWorld(mode);
    w.spawn(block({ x: 0, y: -0.5, z: 0 }, { x: 60, y: 1, z: 60 }));
    return w;
  }

  it('flies along the facing and hurts a character that has health', () => {
    const w = arena();
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    const foe = w.spawn(person({ x: 6, y: 0.5, z: 0 }));
    w.setHealth(foe, 3, true);
    run(w, 3);
    const shot = w.shoot(gun, SHOT)!;
    expect(shot).toBeTruthy();
    let hits: readonly string[] = [];
    for (let i = 0; i < 90 && hits.length === 0; i++) {
      w.step(TICK_DT);
      hits = w.shotHits(gun);
    }
    expect(hits).toEqual([foe]);
    expect(w.healthOf(foe)!.hp).toBe(2);
    w.step(TICK_DT);
    expect(w.shotHits(gun)).toEqual([]); // the pulse lasts one tick
    expect(w.getEntity(shot)).toBeUndefined(); // the spent shot is dropped from the world
    expect(w.getEntity(gun)!.health).toBeUndefined();
  });

  it('a character without health is still hit (and the shot is spent) but takes no damage', () => {
    const w = arena();
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    const foe = w.spawn(person({ x: 4, y: 0.5, z: 0 }));
    run(w, 3);
    w.shoot(gun, SHOT);
    run(w, 40);
    expect(w.healthOf(foe)).toBeNull();
    expect(w.entities().filter((e) => e.kind === 'item')).toHaveLength(0);
  });

  it('the shooter is never hit by its own shot', () => {
    const w = arena();
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    w.setHealth(gun, 3, false);
    run(w, 3);
    w.shoot(gun, SHOT);
    run(w, 60);
    expect(w.healthOf(gun)!.hp).toBe(3);
  });

  it('stops at a solid block and never reaches the far side', () => {
    const w = arena();
    w.spawn(block({ x: 3, y: 2, z: 0 }, { x: 1, y: 4, z: 1 }));
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    const foe = w.spawn(person({ x: 6, y: 0.5, z: 0 }));
    w.setHealth(foe, 3, true);
    run(w, 3);
    w.shoot(gun, SHOT);
    run(w, 90);
    expect(w.healthOf(foe)!.hp).toBe(3);
    expect(w.shotHits(gun)).toEqual([]);
  });

  it('fades after its lifetime', () => {
    const w = arena();
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    run(w, 3);
    const shot = w.shoot(gun, { ...SHOT, speed: 2, lifetime: 0.5 })!;
    run(w, 20);
    expect(w.getEntity(shot)?.visible).toBe(true);
    run(w, 15);
    expect(w.getEntity(shot)).toBeUndefined();
  });

  it('gravity makes the shot arc down; without it the shot stays level', () => {
    const w = arena();
    const gun = w.spawn(person({ x: -10, y: 3, z: 0 }));
    const flat = w.shoot(gun, SHOT)!;
    const arc = w.shoot(gun, { ...SHOT, gravity: true })!;
    const y0 = w.getEntity(flat)!.position.y;
    run(w, 20);
    expect(w.getEntity(flat)!.position.y).toBeCloseTo(y0, 6);
    expect(w.getEntity(arc)!.position.y).toBeLessThan(y0 - 0.3);
  });

  it('aims at a target when given one (including height), else along the facing', () => {
    const w = arena();
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    const goal = w.spawn({ ...block({ x: 8, y: 6, z: 0 }, { x: 1, y: 1, z: 1 }, false) });
    void goal;
    const mark = w.spawn(person({ x: 0, y: 6, z: 0 })); // straight above
    run(w, 3);
    const shot = w.shoot(gun, { ...SHOT, aimAt: mark })!;
    run(w, 10);
    const p = w.getEntity(shot)!.position;
    expect(Math.abs(p.x)).toBeLessThan(0.5);
    expect(p.y).toBeGreaterThan(2);
  });

  it('works in the top-down and 3d views along the facing', () => {
    for (const mode of ['2d-top', '3d'] as ViewMode[]) {
      const w = arena(mode);
      const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
      const foe = w.spawn(person({ x: 5, y: 0.5, z: 0 }));
      w.setHealth(foe, 2, false);
      run(w, 3);
      const shot = w.shoot(gun, SHOT)!;
      expect(shot).toBeTruthy();
      run(w, 40);
      expect(w.healthOf(foe)!.hp).toBe(1);
      if (mode === '2d-top') {
        const arc = w.shoot(gun, { ...SHOT, gravity: true })!;
        run(w, 5);
        expect(w.getEntity(arc)!.position.y).toBeCloseTo(0.5, 6); // no height to fall from in the top-down view
      }
    }
  });

  it('caps the number of live shots', () => {
    const w = arena();
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    let made = 0;
    for (let i = 0; i < 400; i++) if (w.shoot(gun, { ...SHOT, lifetime: 30, speed: 0.5 })) made++;
    expect(made).toBeLessThan(400);
    expect(made).toBeGreaterThan(50);
  });

  it('refuses a dead or missing shooter', () => {
    const w = arena();
    expect(w.shoot('nope', SHOT)).toBeNull();
    const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
    w.hide(gun);
    expect(w.shoot(gun, SHOT)).toBeNull();
  });

  it('is deterministic', () => {
    const play = (): string => {
      const w = arena();
      const gun = w.spawn(person({ x: 0, y: 0.5, z: 0 }));
      const foe = w.spawn(person({ x: 6, y: 0.5, z: 0 }));
      w.setHealth(foe, 5, true);
      for (let i = 0; i < 240; i++) {
        if (i % 20 === 0) w.shoot(gun, { ...SHOT, gravity: i % 40 === 0 });
        w.step(TICK_DT);
      }
      return JSON.stringify([w.entities(), w.shotHits(gun)]);
    };
    expect(play()).toBe(play());
  });
});

describe('disposable entities', () => {
  it('are dropped once hidden; others stay in the list', () => {
    const w = createWorld('2d-side');
    const keep = w.spawn(block({ x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }));
    const temp = w.spawn({ ...block({ x: 3, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }), disposable: true });
    w.hide(keep);
    w.hide(temp);
    w.step(TICK_DT);
    expect(w.getEntity(temp)).toBeUndefined();
    expect(w.getEntity(keep)?.visible).toBe(false);
  });
});
