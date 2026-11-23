import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type Vec3, type World } from '../../src/engine/types';
import { createWorld } from '../../src/world/world';
import { block, crate, crateWorld, floor, view } from './crate-helpers';

/**
 * Two rules of moving solid blocks:
 *  - a block that only slides along a loose crate (the crate rests against a face that runs along the way) does not push it;
 *  - several blocks can be moved as one body with `moveBlocks`: all of them make each step or none does, they never push, stop
 *    or crush each other, and towards everything else they do what one moving block does.
 */

const at = (w: World, id: EntityId): Vec3 => w.getEntity(id)!.position;

/** A loose item of the plain rules (no crate engine): a moving block carries it or sets it flush ahead of itself. */
function item(w: World, x: number, y: number, z: number, side = 0.4): EntityId {
  return w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x, y, z }, size: { x: side, y: side, z: side }, color: '#fa0', solid: false });
}

describe('a block that slides along a crate does not push it', () => {
  /** A crate on the floor, a long wall beside it that the crate leans `into` (m), and a stop standing past the end of that wall. */
  async function leaning(into: number): Promise<{ w: World; wall: EntityId; box: EntityId }> {
    const w = await crateWorld();
    floor(w);
    const box = crate(w, 0, 0.2, 0);
    expect(w.isRigidCrate(box)).toBe(true);
    const wall = block(w, 0, 0.3, -0.25 + into, 1, 0.6, 0.1);
    block(w, 0.7, 0.3, 0, 0.2, 0.6, 0.6);
    return { w, wall, box };
  }

  it('a wall moves along a crate that leans on it, whatever stands past the end of the wall', async () => {
    const { w, wall, box } = await leaning(0.0005);
    const before = { ...at(w, box) };
    for (let k = 1; k <= 4; k++) expect(w.moveBlock(wall, { x: k * 0.05, y: 0.3, z: -0.2495 })).toBe(true);
    expect(at(w, wall).x).toBeCloseTo(0.2, 9);
    expect(at(w, box)).toEqual(before);
  });

  it('a crate that sits deeper in the wall than a touch is in its way as before', async () => {
    const { w, wall } = await leaning(0.02);
    expect(w.moveBlock(wall, { x: 0.05, y: 0.3, z: -0.23 })).toBe(false);
    expect(at(w, wall).x).toBe(0);
  });

  it('a block that meets a crate head-on still stops when the crate has a wall behind it', async () => {
    const w = await crateWorld();
    floor(w);
    crate(w, 0, 0.2, 0);
    block(w, 0.31, 0.5, 0, 0.2, 1, 1);
    // The pusher already touches the crate (5 mm in); behind the crate there is 10 mm of room and the step is 30 mm.
    const pusher = block(w, -0.295, 0.2, 0, 0.2, 0.4, 0.6);
    expect(w.moveBlock(pusher, { x: -0.265, y: 0.2, z: 0 })).toBe(false);
    expect(at(w, pusher).x).toBe(-0.295);
  });

  it('a lift goes down past a crate that touches its side', async () => {
    const w = await crateWorld();
    floor(w);
    const box = crate(w, 0, 0.2, 0);
    const lift = block(w, 0.3995, 0.5, 0, 0.4, 0.2, 0.4);
    expect(w.moveBlock(lift, { x: 0.3995, y: 0.45, z: 0 })).toBe(true);
    expect(at(w, lift).y).toBeCloseTo(0.45, 9);
    expect(at(w, box)).toEqual({ x: 0, y: 0.2, z: 0 });
  });
});

/** A floor plate and four walls round `x` (inside 0.8 m, walls 0.6 m high, 0.1 m thick), the plate first. */
function box5(w: World, x: number): { ids: EntityId[]; offsets: Vec3[] } {
  const parts: [Vec3, Vec3][] = [
    [{ x: 0, y: 0.05, z: 0 }, { x: 1, y: 0.1, z: 1 }],
    [{ x: -0.45, y: 0.4, z: 0 }, { x: 0.1, y: 0.6, z: 1 }],
    [{ x: 0.45, y: 0.4, z: 0 }, { x: 0.1, y: 0.6, z: 1 }],
    [{ x: 0, y: 0.4, z: -0.45 }, { x: 0.8, y: 0.6, z: 0.1 }],
    [{ x: 0, y: 0.4, z: 0.45 }, { x: 0.8, y: 0.6, z: 0.1 }],
  ];
  return { ids: parts.map(([p, s]) => block(w, x + p.x, p.y, p.z, s.x, s.y, s.z)), offsets: parts.map(([p]) => p) };
}

/** Largest distance (m) a block of the body stands off its place against the first one. */
function tear(w: World, body: { ids: EntityId[]; offsets: Vec3[] }): number {
  const lead = at(w, body.ids[0]!);
  const o0 = body.offsets[0]!;
  let worst = 0;
  body.ids.forEach((id, k) => {
    const p = at(w, id);
    const o = body.offsets[k]!;
    worst = Math.max(worst, Math.abs(p.x - lead.x - (o.x - o0.x)), Math.abs(p.y - lead.y - (o.y - o0.y)), Math.abs(p.z - lead.z - (o.z - o0.z)));
  });
  return worst;
}

describe('blocks moved as one body (plain rules, nothing loose is a crate)', () => {
  it('all of them make the step or none does: a body is never left half moved', () => {
    for (const together of [true, false]) {
      const w = createWorld('3d');
      const a = block(w, 0, 0.5, 0, 1, 1, 1);
      const b = block(w, 0, 0.5, 2, 1, 1, 1);
      // In front of the second block: an item with a wall right behind it.
      const thing = item(w, 0.7, 0.2, 2);
      block(w, 1.4, 0.5, 2, 1, 1, 1);
      if (together) {
        expect(w.moveBlocks([a, b], { x: 0.1, y: 0.5, z: 0 })).toBe(false);
        expect(at(w, a).x).toBe(0);
      } else {
        // Sent one by one, the first goes and the second stays: the body has come apart.
        expect(w.moveBlock(a, { x: 0.1, y: 0.5, z: 0 })).toBe(true);
        expect(w.moveBlock(b, { x: 0.1, y: 0.5, z: 2 })).toBe(false);
        expect(at(w, a).x).toBe(0.1);
      }
      expect(at(w, b).x).toBe(0);
      expect(at(w, thing).x).toBe(0.7);
    }
  });

  it('the blocks keep their places against each other; what stands on any of them rides, what is in the way is pushed', () => {
    const w = createWorld('3d');
    const body = box5(w, 0);
    const onPlate = item(w, 0.1, 0.3, 0.1);
    const onWall = item(w, 0.45, 0.9, 0);
    const ahead = item(w, 0.75, 0.4, 0, 0.4);
    for (let k = 1; k <= 60; k++) expect(w.moveBlocks(body.ids, { x: k * 0.05, y: 0.05, z: 0 })).toBe(true);
    expect(at(w, body.ids[0]!).x).toBeCloseTo(3, 9);
    expect(tear(w, body)).toBeLessThan(1e-9);
    expect(at(w, onPlate).x).toBeCloseTo(3.1, 9);
    expect(at(w, onWall).x).toBeCloseTo(3.45, 9);
    // Flush against the outer face of the wall ahead (3.5), as one moving block would set it.
    expect(at(w, ahead).x).toBeCloseTo(3.7, 9);
    // Up and sideways the same.
    expect(w.moveBlocks(body.ids, { x: 3, y: 0.55, z: -0.4 })).toBe(true);
    expect(tear(w, body)).toBeLessThan(1e-9);
    expect(at(w, onPlate)).toEqual({ x: expect.closeTo(3.1, 9), y: expect.closeTo(0.8, 9), z: expect.closeTo(-0.3, 9) });
  });

  it('a far jump is made in small steps, so nobody on the way is skipped', () => {
    const w = createWorld('3d');
    const a = block(w, 0, 0.5, 0, 1, 1, 1);
    const b = block(w, 0, 0.5, 1, 1, 1, 1);
    const thing = item(w, 2, 0.2, 1);
    expect(w.moveBlocks([a, b], { x: 5, y: 0.5, z: 0 })).toBe(true);
    expect(at(w, b)).toEqual({ x: expect.closeTo(5, 9), y: 0.5, z: 1 });
    expect(at(w, thing).x).toBeCloseTo(5.7, 9);
  });

  it('no block is a wall to the body: it passes a fixed block exactly as one moving block does', () => {
    const w = createWorld('3d');
    block(w, 1, 0.5, 0, 0.2, 1, 3);
    const alone = block(w, 0, 0.5, -1, 0.5, 1, 0.5);
    const a = block(w, 0, 0.5, 0.5, 0.5, 1, 0.5);
    const b = block(w, -0.5, 0.5, 1, 0.5, 1, 0.5);
    expect(w.moveBlock(alone, { x: 2, y: 0.5, z: -1 })).toBe(true);
    expect(w.moveBlocks([a, b], { x: 2, y: 0.5, z: 0.5 })).toBe(true);
    expect(at(w, b).x).toBeCloseTo(1.5, 9);
  });

  it('a body pushed by one block into another block of the same body has no room: the body stays', () => {
    const w = createWorld('2d-top');
    const rear = block(w, 0, 0.5, 0, 0.2, 1, 1);
    const front = block(w, 0.5, 0.5, 0, 0.2, 1, 1);
    // 0.3 m between the two, and an item 0.4 m wide standing deep in the one behind: set clear of it, it would stand in the other.
    const thing = item(w, 0.05, 0.5, 0);
    expect(w.moveBlocks([rear, front], { x: 0.05, y: 0.5, z: 0 })).toBe(false);
    expect([at(w, rear).x, at(w, front).x, at(w, thing).x]).toEqual([0, 0.5, 0.05]);
  });

  it('a block that is not solid goes along and pushes nothing; a body of such blocks goes straight there', () => {
    const w = createWorld('3d');
    const solid = block(w, 0, 0.5, 0, 1, 1, 1);
    const ghost = block(w, 0, 0.5, 2, 1, 1, 1, { solid: false });
    const thing = item(w, 0.6, 0.2, 2);
    expect(w.moveBlocks([solid, ghost], { x: 0.3, y: 0.5, z: 0 })).toBe(true);
    expect(at(w, ghost)).toEqual({ x: expect.closeTo(0.3, 9), y: 0.5, z: 2 });
    expect(at(w, thing).x).toBe(0.6);
    const other = block(w, 5, 0.5, 2, 1, 1, 1, { solid: false });
    expect(w.moveBlocks([ghost, other], { x: 1.3, y: 1.5, z: 2 })).toBe(true);
    expect(at(w, other)).toEqual({ x: expect.closeTo(6, 9), y: 1.5, z: 2 });
    expect(at(w, thing).x).toBe(0.6);
  });

  it('an id that is not a visible block moves nothing; one block alone is `moveBlock`; a block named twice counts once', () => {
    const w = createWorld('3d');
    const a = block(w, 0, 0.5, 0, 1, 1, 1);
    const b = block(w, 0, 0.5, 2, 1, 1, 1);
    const thing = item(w, 3, 0.2, 0);
    expect(w.moveBlocks([], { x: 1, y: 0.5, z: 0 })).toBe(false);
    expect(w.moveBlocks([a, 'nobody' as EntityId, b], { x: 1, y: 0.5, z: 0 })).toBe(false);
    expect(w.moveBlocks([a, thing], { x: 1, y: 0.5, z: 0 })).toBe(false);
    w.hide(b);
    expect(w.moveBlocks([a, b], { x: 1, y: 0.5, z: 0 })).toBe(false);
    expect([at(w, a).x, at(w, b).x, at(w, thing).x]).toEqual([0, 0, 3]);
    w.show(b);
    expect(w.moveBlocks([a], { x: 1, y: 0.5, z: 0 })).toBe(true);
    expect(at(w, a).x).toBe(1);
    expect(w.moveBlocks([a, b, a, b], { x: 1.25, y: 0.5, z: 0 })).toBe(true);
    expect([at(w, a).x, at(w, b).x]).toEqual([1.25, 0.25]);
  });

  it('the list of entities shows the blocks and what they took along where they are now', () => {
    const w = createWorld('3d');
    const a = block(w, 0, 0.5, 0, 1, 1, 1);
    const b = block(w, 0, 0.5, 2, 1, 1, 1);
    const rider = item(w, 0, 1.2, 2);
    const first = w.listEntities();
    expect(w.moveBlocks([a, b], { x: 0.2, y: 0.5, z: 0 })).toBe(true);
    const now = w.listEntities();
    const x = (list: readonly { id: EntityId; position: Vec3 }[], id: EntityId): number => list.find((e) => e.id === id)!.position.x;
    expect([x(now, a), x(now, b), x(now, rider)]).toEqual([0.2, 0.2, 0.2]);
    // The list handed out before is not written again.
    expect([x(first, a), x(first, b), x(first, rider)]).toEqual([0, 0, 0]);
  });
});

describe('blocks moved as one body among loose crates ("Vật lý thật")', () => {
  it('two blocks of one body never crush a crate between them, however little room it has', async () => {
    for (const together of [true, false]) {
      const w = await crateWorld();
      floor(w);
      // 0.41 m between the two walls and a 0.4 m crate that the wall behind already reaches 5 mm into.
      const rear = block(w, -0.3, 0.3, 0, 0.2, 0.6, 1);
      const front = block(w, 0.31, 0.3, 0, 0.2, 0.6, 1);
      crate(w, -0.005, 0.2, 0);
      if (together) {
        expect(w.moveBlocks([rear, front], { x: -0.25, y: 0.3, z: 0 })).toBe(true);
        expect([at(w, rear).x, at(w, front).x]).toEqual([expect.closeTo(-0.25, 9), expect.closeTo(0.36, 9)]);
      } else {
        // Sent alone, the wall behind takes the wall ahead for a wall the crate is squeezed against.
        expect(w.moveBlock(rear, { x: -0.25, y: 0.3, z: 0 })).toBe(false);
      }
    }
  });

  /** Two walls 0.9 m apart standing on the floor, as one body, driven along x at 0.6 m/s for `seconds`. */
  async function drive(seconds: number, build: (w: World) => EntityId, how: 'body' | 'rear alone' | 'front alone'): Promise<{ w: World; rear: EntityId; front: EntityId; box: EntityId; refused: number }> {
    const w = await crateWorld();
    floor(w);
    const box = build(w);
    // A wall that is not driven is not there at all: left standing, it would be one more fixed wall.
    const far = { x: 0, y: 50, z: 0 };
    const rear = how === 'front alone' ? block(w, far.x, far.y, far.z, 0.1, 0.6, 1) : block(w, -0.5, 0.3, 0, 0.1, 0.6, 1);
    const front = how === 'rear alone' ? block(w, far.x, far.y, far.z, 0.1, 0.6, 1) : block(w, 0.5, 0.3, 0, 0.1, 0.6, 1);
    for (let k = 0; k < 30; k++) w.step(TICK_DT);
    let refused = 0;
    let x = -0.5;
    for (let k = 0; k < Math.round(seconds / TICK_DT); k++) {
      x += 0.6 * TICK_DT;
      const went = how === 'body' ? w.moveBlocks([rear, front], { x, y: 0.3, z: 0 }) : how === 'rear alone' ? w.moveBlock(rear, { x, y: 0.3, z: 0 }) : w.moveBlock(front, { x: x + 1, y: 0.3, z: 0 });
      if (!went) {
        refused++;
        x = at(w, how === 'front alone' ? front : rear).x - (how === 'front alone' ? 1 : 0);
      }
      w.step(TICK_DT);
    }
    return { w, rear, front, box, refused };
  }

  it('with a crate inside, a body driven into a fixed wall stops as a whole where one block pushing that crate stops', async () => {
    // A fixed wall 2 m ahead; the crate stands between the two walls of the body.
    const build = (w: World): EntityId => {
      block(w, 2.1, 0.5, 0, 0.2, 1, 3);
      return crate(w, 0, 0.2, 0, undefined, { mass: 2 });
    };
    const body = await drive(6, build, 'body');
    const alone = await drive(6, build, 'rear alone');
    expect(body.refused).toBeGreaterThan(0);
    // The two walls are still exactly 1 m apart, and stand still.
    expect(at(body.w, body.front).x - at(body.w, body.rear).x).toBeCloseTo(1, 9);
    expect(at(body.w, body.rear).x).toBeLessThan(1.6);
    const rearFace = at(body.w, body.rear).x + 0.05;
    const crateX = view(body.w, body.box).position.x;
    // The crate lies between the wall behind and the fixed wall (face at 2.0), not squeezed into either beyond the 20 mm rule.
    expect(crateX - 0.2).toBeGreaterThan(rearFace - 0.02);
    expect(crateX + 0.2).toBeLessThan(2.0 + 0.02);
    expect(Math.abs(at(body.w, body.rear).x - at(alone.w, alone.rear).x)).toBeLessThan(0.02);
    expect(Math.abs(crateX - view(alone.w, alone.box).position.x)).toBeLessThan(0.02);
  });

  it('a crate outside the body in its way is pushed along, as by one moving block', async () => {
    const build = (w: World): EntityId => crate(w, 1.2, 0.2, 0, undefined, { mass: 2 });
    const body = await drive(3, build, 'body');
    const alone = await drive(3, build, 'front alone');
    expect(body.refused).toBe(0);
    const crateX = view(body.w, body.box).position.x;
    // The wall ahead went from 0.5 to 2.3: the crate lies ahead of its outer face.
    expect(at(body.w, body.front).x).toBeCloseTo(2.3, 6);
    expect(crateX - 0.2).toBeGreaterThan(2.35 - 0.02);
    expect(crateX).toBeCloseTo(view(alone.w, alone.box).position.x, 3);
  });

  it('a crate outside the body with a fixed wall behind it stops the whole body, as it stops one moving block', async () => {
    const build = (w: World): EntityId => {
      block(w, 2.1, 0.5, 0, 0.2, 1, 3);
      return crate(w, 1.2, 0.2, 0, undefined, { mass: 2 });
    };
    const body = await drive(5, build, 'body');
    const alone = await drive(5, build, 'front alone');
    expect(body.refused).toBeGreaterThan(0);
    expect(at(body.w, body.front).x - at(body.w, body.rear).x).toBeCloseTo(1, 9);
    // The wall ahead stopped with the crate between its outer face and the fixed wall (face at 2.0).
    expect(at(body.w, body.front).x + 0.05).toBeLessThan(1.6 + 0.02);
    expect(view(body.w, body.box).position.x + 0.2).toBeLessThan(2.0 + 0.02);
    expect(at(body.w, body.front).x).toBeCloseTo(at(alone.w, alone.front).x, 3);
  });
});
