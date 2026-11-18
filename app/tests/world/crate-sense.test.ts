import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type EntityView, type World } from '../../src/engine/types';
import { touchNode } from '../../src/nodes/touch';
import { zoneSensorNode } from '../../src/nodes/zone-sensor';
import { pickEntities } from '../../src/render/ui-input';
import type { Entity } from '../../src/world/entity';
import { massOn } from '../../src/world/material';
import { touching } from '../../src/world/physics';
import { SceneView } from '../../src/render/scene-view';
import { runNode } from '../nodes/fake-world';
import { block, crate, crateWorld, floor, run, tipDegrees, view } from './crate-helpers';

/**
 * Everything that senses or measures a loose crate reads its real, turned shape: contacts, the proximity ("grow") test of the touch
 * card, the zone card, the scale, clicking in the play view. Numbers are worked out by hand in the comments.
 */

const S = Math.SQRT1_2;
/** Quarter turn about z: a 0.4 x 2 x 0.4 crate (long side up) lies along x. */
const Z90 = { x: 0, y: 0, z: S, w: S };
/** Eighth turn about z (45 degrees): the long crate leans toward -x. */
const Z45 = { x: 0, y: 0, z: Math.sin(Math.PI / 8), w: Math.cos(Math.PI / 8) };
const LONG = { x: 0.4, y: 2, z: 0.4 };

function ent(over: Partial<Entity> & Pick<Entity, 'id' | 'kind' | 'pos' | 'size'>): Entity {
  return {
    ownerNodeId: 't',
    vel: { x: 0, y: 0, z: 0 },
    color: '#fff',
    solid: false,
    visible: true,
    onGround: false,
    intent: null,
    facing: { x: 1, y: 0, z: 0 },
    holding: null,
    handHolding: null,
    swingTime: -1,
    heldBy: null,
    inHand: false,
    carryable: true,
    holdStyle: 'head',
    seatedIn: null,
    ...over,
  };
}

describe('contact: a turned crate touches through its real outline', () => {
  // The long crate stands upright centred at (0, 1, 0): old box x -0.2..0.2, y 0..2. Leaning 45 degrees toward -x its outline is a
  // diagonal bar: ends at (-0.5657, 0.8485) / (-0.8485, 0.5657) from the centre (top) and the mirror ones below.
  const leaning = ent({ id: 'c', kind: 'item', pos: { x: 0, y: 1, z: 0 }, size: LONG, rot: Z45 });

  it('a box touching the tip of the bar is a contact, although the old upright box is 0.6 m away', () => {
    // Tip corner at x = -0.8485, y = 1.5657. A 0.2 cube centred at x = -0.9485 has its right face right on it.
    const robot = ent({ id: 'r', kind: 'robot', pos: { x: -0.9485, y: 1.5657, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 }, solid: true });
    expect(touching(leaning, robot)).toBe(true);
    expect(touching({ ...leaning, rot: undefined }, robot)).toBe(false);
  });

  it('a box in the empty corner of the old upright box is no contact', () => {
    // 0.3 cube at (0.25, 1.9): overlaps the old box (x <= 0.2, y <= 2) but the bar leans away; its nearest corner (0.1, 1.75) is
    // (0.85 x 0.7071) - 0.2 = 0.40 m from the bar's side.
    const robot = ent({ id: 'r', kind: 'robot', pos: { x: 0.25, y: 1.9, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, solid: true });
    expect(touching({ ...leaning, rot: undefined }, robot)).toBe(true);
    expect(touching(leaning, robot)).toBe(false);
  });

  it('a rolling ball is sensed by its box, which does not turn with it', () => {
    const ball = ent({ id: 'b', kind: 'item', shape: 'ball', pos: { x: 0, y: 1, z: 0 }, size: LONG, rot: Z45 });
    const robot = ent({ id: 'r', kind: 'robot', pos: { x: -0.9485, y: 1.5657, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 }, solid: true });
    expect(touching(ball, robot)).toBe(touching({ ...ball, rot: undefined }, robot));
    expect(touching(ball, robot)).toBe(false);
  });

  it('is symmetric: the box listed first or second gives the same answer', () => {
    const robot = ent({ id: 'r', kind: 'robot', pos: { x: -0.9485, y: 1.5657, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 }, solid: true });
    expect(touching(robot, leaning)).toBe(touching(leaning, robot));
  });
});

describe('scale: what a turned crate loads is decided by the surface under it', () => {
  // Scale: top face at y = 0.2, x and z from -0.5 to 0.5. The crate lies along x (quarter turn), 2 long, 0.4 across, 5 kg.
  const scale = ent({ id: 's', kind: 'block', pos: { x: 0, y: 0.1, z: 0 }, size: { x: 1, y: 0.2, z: 1 }, solid: true });
  const lying = (x: number, y: number): Entity => ent({ id: 'c', kind: 'item', pos: { x, y, z: 0 }, size: LONG, rot: Z90, mass: 5 });

  it('lying on the scale (lowest side at the top face, long side across it) reads its full mass', () => {
    expect(massOn([scale, lying(0, 0.4)], scale)).toBe(5);
  });

  it('half on it (the middle is over the edge, the end still over the top face) still reads the whole mass', () => {
    // Crate spans x -0.1..1.9, the scale ends at 0.5: overlap 0.6 m.
    expect(massOn([scale, lying(0.9, 0.4)], scale)).toBe(5);
  });

  it('slid off (no overlap) or fallen to the floor (0.2 m below the top face) reads 0', () => {
    // Spans 0.9..2.9: clear of the scale.
    expect(massOn([scale, lying(1.9, 0.4)], scale)).toBe(0);
    // On the floor beside the scale: lowest point 0, the scale top 0.2: gap 0.2 > 0.05.
    expect(massOn([scale, lying(0, 0.2)], scale)).toBe(0);
  });

  it('a crate balanced on its edge (a cube turned 45 degrees) is held by the two lowest corners', () => {
    const cube = (x: number): Entity => ent({ id: 'c', kind: 'item', pos: { x, y: 0.2 + 0.2 * Math.SQRT2, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, rot: Z45, mass: 3 });
    expect(massOn([scale, cube(0.3)], scale)).toBe(3);
    // Edge at x = 0.6: past the scale's end (0.5).
    expect(massOn([scale, cube(0.6)], scale)).toBe(0);
  });

  it('crates stacked on a lying crate load the scale too', () => {
    const top = ent({ id: 'd', kind: 'item', pos: { x: 0, y: 0.8, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 2 });
    expect(massOn([scale, lying(0, 0.4), top], scale)).toBe(7);
  });

  it('an upright crate is weighed exactly as before', () => {
    const upright = ent({ id: 'c', kind: 'item', pos: { x: 0, y: 0.4, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 4 });
    expect(massOn([scale, upright], scale)).toBe(4);
  });
});

describe('zone and touch cards read a crate that tipped over in a running world', () => {
  /** A 0.4 x 1.2 x 0.4 crate (10 kg) pushed over at 1.1 m by a block: it ends up lying along x. Returns the world and the crate's place. */
  async function tippedCrate(base?: { y: number }): Promise<{ w: World; c: EntityId; x: number; y: number; z: number }> {
    const w = await crateWorld();
    floor(w);
    if (base) block(w, 0, base.y - 0.1, 0, 6, 0.2, 6);
    const lift = base ? base.y : 0;
    const c = crate(w, 0, lift + 0.6, 0, { x: 0.4, y: 1.2, z: 0.4 }, { mass: 10, mu: 0.5 });
    const pusher = block(w, -1.5, lift + 1.1, 0, 0.2, 0.2, 0.6);
    let px = -1.5;
    for (let i = 0; i < 480; i++) {
      px = Math.min(0.6, px + 0.3 * TICK_DT);
      w.moveBlock(pusher, { x: px, y: lift + 1.1, z: 0 });
      w.step(TICK_DT);
    }
    w.hide(pusher);
    run(w, 3);
    const v = view(w, c);
    expect(tipDegrees(v)).toBeGreaterThan(85);
    return { w, c, x: v.position.x, y: v.position.y, z: v.position.z };
  }

  it('it lies along x: 1.2 m long and 0.4 m high, centre 0.2 above the floor', async () => {
    const { w, c, y } = await tippedCrate();
    expect(y).toBeCloseTo(0.2, 1);
    expect(w.entities().find((e) => e.id === c)!.rotation).toBeDefined();
  });

  it('the proximity test of the touch card (grow) finds it at its real near face, 0.6 m from the middle, not 0.2 m', async () => {
    const { w, c, x, z } = await tippedCrate();
    // A 0.4 cube whose right face is 0.5 m before the near face (centre x - 0.6 - 0.5 - 0.2).
    const probe = w.spawn({ kind: 'block', ownerNodeId: 'probe', position: { x: x - 1.3, y: 0.2, z }, size: { x: 0.4, y: 0.4, z: 0.4 }, color: '#f00', solid: false });
    const reads = (grow: number): boolean => runNode(touchNode, [{ inputs: { a: probe, b: c } }], { grow, mode: 'edge' }, w)[0]!.touching as boolean;
    // A gap of 0.5 m: a 0.4 m reach is short of it, a 0.6 m reach is past it. The upright box would put the face 0.9 m away.
    expect(reads(0.4)).toBe(false);
    expect(reads(0.6)).toBe(true);
    // The same read taken from the other end of the crate gives the same.
    const other = w.spawn({ kind: 'block', ownerNodeId: 'probe2', position: { x: x + 1.3, y: 0.2, z }, size: { x: 0.4, y: 0.4, z: 0.4 }, color: '#f00', solid: false });
    const readsOther = (grow: number): boolean => runNode(touchNode, [{ inputs: { a: other, b: c } }], { grow, mode: 'edge' }, w)[0]!.touching as boolean;
    expect(readsOther(0.4)).toBe(false);
    expect(readsOther(0.6)).toBe(true);
  });

  it('a contact card fires for a box beside the crate end and not for a box in the old upright space', async () => {
    const { w, c, x, z } = await tippedCrate();
    // Right at the near face (gap 0.005, inside the 0.01 contact skin): the crate end is at x - 0.6, the old box only reached x - 0.2.
    const at = w.spawn({ kind: 'block', ownerNodeId: 'at', position: { x: x - 0.6 - 0.005 - 0.1, y: 0.2, z }, size: { x: 0.2, y: 0.2, z: 0.2 }, color: '#f00', solid: false });
    // Over the crate where the upright box once stood (y 0.75..1.05, the crate top is at 0.4).
    const above = w.spawn({ kind: 'block', ownerNodeId: 'above', position: { x, y: 0.9, z }, size: { x: 0.3, y: 0.3, z: 0.3 }, color: '#f00', solid: false });
    w.step(TICK_DT);
    expect(w.isTouching(at, c)).toBe(true);
    expect(w.isTouching(above, c)).toBe(false);
  });

  it('a zone counts the crate by its footprint: a zone past the old box but under the lying end counts it, one over the old box does not', async () => {
    const { w, x, z } = await tippedCrate();
    // Zone A: x from (x + 0.3) to (x + 1.3). The crate reaches x + 0.6; the upright box only x + 0.2.
    const a = runNode(zoneSensorNode, [{}], { center: { x: x + 0.8, y: 0.5, z }, size: { x: 1, y: 1, z: 1 }, filter: 'item', rule: 'touch' }, w)[0]!;
    expect(a.count).toBe(1);
    // Zone B: 0.6 m cube centred 0.9 above the floor, over the middle: the crate top is 0.4, so it misses.
    const b = runNode(zoneSensorNode, [{}], { center: { x, y: 0.9, z }, size: { x: 0.6, y: 0.6, z: 0.6 }, filter: 'item', rule: 'touch' }, w)[0]!;
    expect(b.count).toBe(0);
    // "Whole inside": a 2 m wide zone (1.4 m tall, so the floor skin is inside) holds the 1.2 m long lying crate; a 1 m wide one does not.
    const inside = (width: number): number => runNode(zoneSensorNode, [{}], { center: { x, y: 0.5, z }, size: { x: width, y: 1.4, z: 1 }, filter: 'item', rule: 'inside' }, w)[0]!.count as number;
    expect(inside(2)).toBe(1);
    expect(inside(1)).toBe(0);
  });

  it('the scale reads the lying crate, and 0 once it is not on it any more', async () => {
    const lift = 3;
    const { w, c } = await tippedCrate({ y: lift });
    const plate = w.entities().find((e) => e.kind === 'block' && Math.abs(e.position.y - (lift - 0.1)) < 1e-6)!;
    expect(w.massOn(plate.id)).toBe(10);
    // Take it away: setting it down on the floor beside the plate keeps its turn and the plate reads nothing.
    w.teleport(c, { x: 8, y: 0.2, z: 0 }, false);
    run(w, 1);
    expect(tipDegrees(view(w, c))).toBeGreaterThan(85);
    expect(w.massOn(plate.id)).toBe(0);
  });
});

describe('clicking in the play view', () => {
  /** Perspective camera 8 m away on the z axis, looking at the middle of the scene along -z. */
  function sideCamera(): THREE.PerspectiveCamera {
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    cam.position.set(0, 0.8, 8);
    cam.lookAt(0, 0.8, 0);
    cam.updateMatrixWorld(true);
    return cam;
  }
  const ndcOf = (cam: THREE.Camera, x: number, y: number): THREE.Vector2 => {
    const p = new THREE.Vector3(x, y, 0).project(cam);
    return new THREE.Vector2(p.x, p.y);
  };
  const lying: EntityView = { id: 'c', kind: 'item', ownerNodeId: 'c', position: { x: 0, y: 0.2, z: 0 }, size: LONG, color: '#c80', visible: true, rotation: Z90 };

  it('hits the lying crate at its end (1 m from the middle, where the upright box never was) and misses the space above it', () => {
    const cam = sideCamera();
    expect(pickEntities(ndcOf(cam, 0.8, 0.2), cam, [lying], true)).toEqual(['c']);
    // 0.9 m up, over the middle: inside the upright box (y 0..2 at x +-0.2) but nothing of the lying crate (top at 0.4).
    expect(pickEntities(ndcOf(cam, 0, 0.9), cam, [lying], true)).toEqual([]);
    const upright: EntityView = { ...lying, rotation: undefined };
    delete upright.rotation;
    expect(pickEntities(ndcOf(cam, 0, 0.9), cam, [{ ...upright, position: { x: 0, y: 1, z: 0 } }], true)).toEqual(['c']);
  });

  it('the picture the editor and the play view click on is the turned crate too', () => {
    const cam = sideCamera();
    const scene = new SceneView();
    scene.sync([lying], 0);
    scene.scene.updateMatrixWorld(true);
    expect(scene.pick(ndcOf(cam, 0.8, 0.2), cam)).toBe('c');
    expect(scene.pick(ndcOf(cam, 0, 0.9), cam)).toBeNull();
    scene.dispose();
  });
});
