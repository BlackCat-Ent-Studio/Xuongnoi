import { describe, expect, it } from 'vitest';
import { createWorld } from '../../src/world/world';
import { runNode } from '../nodes/fake-world';
import { carryNode } from '../../src/nodes/carry';
import { interactNode } from '../../src/nodes/interact';
import { itemNode } from '../../src/nodes/item';
import type { CharacterIntent, EntitySpec, ViewMode, World } from '../../src/engine/types';

const DT = 1 / 60;
const MODES: ViewMode[] = ['2d-side', '2d-top', '3d'];

const intent = (p: Partial<CharacterIntent> = {}): CharacterIntent => ({
  moveX: 0, moveY: 0, jump: false, speed: 5, jumpPower: 10, ...p,
});
const block = (x: number, y: number, z = 0, w = 1, h = 1): EntitySpec => ({
  kind: 'block', ownerNodeId: 'b', position: { x, y, z }, size: { x: w, y: h, z: 1 }, color: '#fff', solid: true,
});
const char = (x: number, y: number, z = 0): EntitySpec => ({
  kind: 'character', ownerNodeId: 'c', position: { x, y, z }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true,
});
const item = (x: number, y: number, z = 0, over: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'item', ownerNodeId: 'i', position: { x, y, z }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ff0', solid: false, ...over,
});
const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) w.step(DT);
};

/** Floor with top at y=0 plus a character standing at the origin (floor is a long strip along X, and Z in 3D). */
function scene(mode: ViewMode) {
  const w = createWorld(mode);
  if (mode === '2d-side') {
    for (let x = -10; x <= 10; x++) w.spawn(block(x, -0.5));
  } else if (mode === '3d') {
    for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) w.spawn(block(x, -0.5, z));
  }
  // 2d-top has no ground: everything lives in one plane.
  const y = mode === '2d-top' ? 0 : 0.5;
  const c = w.spawn(char(0, y));
  return { w, c, y };
}

describe.each(MODES)('items in %s', (mode) => {
  const itemY = (y: number): number => (mode === '2d-top' ? 0 : y);

  it('grabs the nearest item in reach, one per character, and carries it', () => {
    const { w, c } = scene(mode);
    const far = w.spawn(item(3, itemY(0.3)));
    const near = w.spawn(item(0.9, itemY(0.3)));
    const nearer = w.spawn(item(0.4, itemY(0.3)));
    const behind = w.spawn(item(-0.3, itemY(0.3)));
    run(w, 5);
    expect(w.grab(c, 1.2)).toBe(nearer);
    expect(w.isHeld(nearer)).toBe(true);
    expect(w.heldItem(c)).toBe(nearer);
    expect(w.isHeld(behind)).toBe(false);
    expect(w.grab(c, 1.2)).toBeNull(); // already holding
    run(w, 5);
    expect(w.isHeld(near)).toBe(false);
    expect(w.isHeld(far)).toBe(false);
  });

  it('prefers an item on the facing side when distances are close', () => {
    const { w, c } = scene(mode);
    const behind = w.spawn(item(-0.7, itemY(0.3)));
    const ahead = w.spawn(item(0.9, itemY(0.3)));
    run(w, 5);
    expect(w.grab(c, 1.2)).toBe(ahead);
    expect(w.isHeld(behind)).toBe(false);
  });

  it('ignores items out of reach, hidden items and non-carryable items', () => {
    const { w, c } = scene(mode);
    const farAway = w.spawn(item(2, itemY(0.3)));
    const fixed = w.spawn(item(0.5, itemY(0.3), 0, { carryable: false }));
    const gone = w.spawn(item(-0.5, itemY(0.3)));
    w.hide(gone);
    run(w, 5);
    expect(w.grab(c, 1.2)).toBeNull();
    expect(w.isHeld(farAway)).toBe(false);
    expect(w.isHeld(fixed)).toBe(false);
  });

  it('holds the item above the head (in front when seen from the top) and keeps following', () => {
    const { w, c } = scene(mode);
    const it = w.spawn(item(0.5, itemY(0.3)));
    run(w, 5);
    w.grab(c, 1.2);
    w.setCharacterIntent(c, intent({ moveX: 1 }));
    run(w, 30);
    const ch = w.getEntity(c)!.position;
    const held = w.getEntity(it)!.position;
    if (mode === '2d-top') {
      expect(held.x).toBeGreaterThan(ch.x + 0.5);
      expect(held.y).toBeCloseTo(ch.y, 6);
    } else {
      expect(held.x).toBeCloseTo(ch.x, 6);
      expect(held.y).toBeGreaterThan(ch.y + 0.5);
    }
    expect(ch.x).toBeGreaterThan(1);
  });

  it('the held item follows the facing direction', () => {
    const { w, c } = scene(mode);
    const it = w.spawn(item(0.4, itemY(0.3)));
    run(w, 5);
    w.grab(c, 1.2);
    w.setCharacterIntent(c, intent({ moveX: -1 }));
    run(w, 10);
    w.setCharacterIntent(c, intent());
    run(w, 5);
    const ch = w.getEntity(c)!.position;
    const held = w.getEntity(it)!.position;
    if (mode === '2d-top') expect(held.x).toBeLessThan(ch.x - 0.5);
    else expect(held.x).toBeCloseTo(ch.x, 6);
    // Drop goes to the facing (left) side.
    w.drop(c);
    run(w, 60);
    expect(w.getEntity(it)!.position.x).toBeLessThan(w.getEntity(c)!.position.x - 0.5);
  });

  it('drop puts the item in front, outside solids, and it settles on the floor', () => {
    const { w, c } = scene(mode);
    const it = w.spawn(item(0.3, itemY(0.3)));
    run(w, 5);
    w.grab(c, 1.2);
    run(w, 5);
    expect(w.drop(c)).toBe(it);
    expect(w.heldItem(c)).toBeNull();
    expect(w.drop(c)).toBeNull();
    run(w, 120);
    const p = w.getEntity(it)!.position;
    expect(p.x).toBeGreaterThan(0.5);
    if (mode !== '2d-top') expect(p.y).toBeCloseTo(0.3, 2);
  });

  it('drop next to a wall never leaves the item inside the wall', () => {
    const { w, c } = scene(mode);
    // A wall right in front of the character (facing +X), a gap behind is still free.
    for (let y = 0; y < 3; y++) w.spawn(block(1, mode === '2d-top' ? 0 : y + 0.5, 0, 1, 1));
    if (mode === '2d-top') w.spawn(block(1, 0, 0));
    const it = w.spawn(item(-0.5, itemY(0.3)));
    run(w, 5);
    w.grab(c, 1.2);
    run(w, 5);
    w.drop(c);
    run(w, 90);
    const p = w.getEntity(it)!.position;
    // Wall occupies x in [0.5, 1.5]; the item (half width 0.3) must not overlap it.
    expect(p.x + 0.3 <= 0.5 + 1e-6 || p.x - 0.3 >= 1.5 - 1e-6).toBe(true);
  });

  it('throw flies forward, lands and stops', () => {
    const { w, c } = scene(mode);
    const it = w.spawn(item(0.3, itemY(0.3)));
    run(w, 5);
    w.grab(c, 1.2);
    run(w, 5);
    const x0 = w.getEntity(it)!.position.x;
    expect(w.throwHeld(c, 8)).toBe(it);
    expect(w.isHeld(it)).toBe(false);
    run(w, 10);
    if (mode !== '2d-top') expect(w.getEntity(it)!.position.y).toBeGreaterThan(0.6); // still in the air
    run(w, 240);
    const a = w.getEntity(it)!.position;
    run(w, 60);
    const b = w.getEntity(it)!.position;
    expect(a.x).toBeGreaterThan(x0 + 1);
    expect(b.x).toBeCloseTo(a.x, 6); // came to rest
    if (mode !== '2d-top') expect(b.y).toBeCloseTo(0.3, 2);
    expect(w.throwHeld(c, 8)).toBeNull();
  });

  it('hiding a held item releases the holder; hiding the holder releases the item', () => {
    const { w, c } = scene(mode);
    const a = w.spawn(item(0.3, itemY(0.3)));
    run(w, 5);
    w.grab(c, 1.2);
    w.hide(a);
    expect(w.heldItem(c)).toBeNull();
    expect(w.isHeld(a)).toBe(false);
    const b = w.spawn(item(0.3, itemY(0.3)));
    run(w, 5);
    expect(w.grab(c, 1.2)).toBe(b);
    w.hide(c);
    expect(w.isHeld(b)).toBe(false);
    expect(w.heldItem(c)).toBeNull();
  });

  it('interact marks the nearest item for exactly one tick, not the carried one', () => {
    const { w, c } = scene(mode);
    const held = w.spawn(item(0.2, itemY(0.3)));
    const lock = w.spawn(item(1.2, itemY(0.3), 0, { carryable: false }));
    run(w, 5);
    w.grab(c, 1.2);
    expect(w.interact(c, 1.5)).toBe(lock);
    expect(w.wasInteracted(lock)).toBe(false); // visible after the next step
    w.step(DT);
    expect(w.wasInteracted(lock)).toBe(true);
    expect(w.wasInteracted(held)).toBe(false);
    w.step(DT);
    expect(w.wasInteracted(lock)).toBe(false);
    expect(w.interact(c, 0.1)).toBeNull();
  });

  it('contacts: a carried item touches a block it is held against, and a dropped item touches the block it rests on', () => {
    const { w, c } = scene(mode);
    const it = w.spawn(item(0.3, itemY(0.3)));
    // A tall pickup-style zone, so both a carried item (above the head) and one lying on the floor reach it.
    const zone = w.spawn({ ...block(2.5, mode === '2d-top' ? 0 : 1.5, 0, 1, 3), solid: false });
    run(w, 5);
    w.grab(c, 1.2);
    expect(w.isTouching(it, zone)).toBe(false);
    w.setCharacterIntent(c, intent({ moveX: 1, speed: 3 }));
    let touched = false;
    for (let i = 0; i < 120 && !touched; i++) {
      w.step(DT);
      touched = w.isTouching(it, zone);
    }
    expect(touched).toBe(true);
    // Dropped in front of the character, inside the zone, it still touches.
    w.setCharacterIntent(c, intent());
    run(w, 10);
    w.drop(c);
    run(w, 60);
    const p = w.getEntity(it)!.position;
    expect(Math.abs(p.x - 2.5)).toBeLessThan(0.9);
    // Seen from the top the carried item rides in front, so it reaches the zone earlier than the drop spot does.
    if (mode !== '2d-top') expect(w.isTouching(it, zone)).toBe(true);
  });

  it('is deterministic', () => {
    const play = (): string => {
      const { w, c } = scene(mode);
      const it = w.spawn(item(0.4, itemY(0.3)));
      run(w, 5);
      w.grab(c, 1.2);
      w.setCharacterIntent(c, intent({ moveX: 1, moveY: mode === '2d-side' ? 0 : 0.5 }));
      run(w, 40);
      w.throwHeld(c, 7);
      run(w, 200);
      return JSON.stringify(w.getEntity(it)) + JSON.stringify(w.getEntity(c));
    };
    expect(play()).toBe(play());
  });
});

describe('item physics', () => {
  it('2d-side/3d: a free item falls with gravity and lands on solids; 2d-top: floats in place', () => {
    for (const mode of MODES) {
      const { w } = scene(mode);
      const it = w.spawn(item(4, 3));
      run(w, 120);
      const y = w.getEntity(it)!.position.y;
      if (mode === '2d-top') expect(y).toBe(3);
      else expect(y).toBeCloseTo(0.3, 3);
    }
  });

  it('items never block characters', () => {
    const { w, c } = scene('2d-side');
    w.spawn(item(1.2, 0.3));
    run(w, 5);
    w.setCharacterIntent(c, intent({ moveX: 1 }));
    run(w, 60);
    expect(w.getEntity(c)!.position.x).toBeGreaterThan(3);
  });

  it('item spawned as solid is still non-solid and only items report the shape', () => {
    const w = createWorld('2d-side');
    const id = w.spawn(item(0, 0, 0, { solid: true, shape: 'key' }));
    expect(w.getEntity(id)!.shape).toBe('key');
    const b = w.spawn(block(0, 5));
    expect(w.getEntity(b)!.shape).toBeUndefined();
  });

  it('actions on unknown or non-character ids do nothing', () => {
    const w = createWorld('3d');
    const b = w.spawn(block(0, 0));
    expect(w.grab('nope', 1)).toBeNull();
    expect(w.grab(b, 1)).toBeNull();
    expect(w.drop('nope')).toBeNull();
    expect(w.throwHeld(b, 5)).toBeNull();
    expect(w.interact('nope', 1)).toBeNull();
    expect(w.heldItem('nope')).toBeNull();
  });
});

describe('item / carry / interact nodes', () => {
  it('item node spawns a non-solid item and reports held/interacted from the world', () => {
    const w = createWorld('2d-side');
    const out = runNode(itemNode, [{}, {}], { shape: 'ball', carryable: 'no' }, w);
    const e = w.entities()[0]!;
    expect(e.kind).toBe('item');
    expect(e.shape).toBe('ball');
    expect(out[0]).toMatchObject({ self: e.id, held: false, interacted: false });
  });

  it('carry: toggle mode picks up then puts down on successive presses; throw wins', () => {
    const w = createWorld('2d-side');
    for (let x = -3; x <= 3; x++) w.spawn(block(x, -0.5));
    const c = w.spawn(char(0, 0.5));
    const it = w.spawn(item(0.5, 0.3));
    for (let i = 0; i < 5; i++) w.step(DT);
    const press = (grab: boolean, drop = false, thr = false) => ({ inputs: { character: c, grab, drop, throw: thr } });
    const out = runNode(
      carryNode,
      [press(false), press(true), press(true), press(false), press(true), press(true, false, true)],
      { mode: 'toggle' },
      w,
    );
    // tick1 press -> grab; tick2 held (no new edge); tick4 press -> drop
    expect(out.map((o) => o.holding)).toEqual([false, true, true, true, false, false]);
    expect(out[1]!.heldItem).toBe(it);
  });

  it('carry: separate mode needs the drop input; held-down keys fire once', () => {
    const w = createWorld('2d-side');
    for (let x = -3; x <= 3; x++) w.spawn(block(x, -0.5));
    const c = w.spawn(char(0, 0.5));
    w.spawn(item(0.5, 0.3));
    for (let i = 0; i < 5; i++) w.step(DT);
    const s = (grab: boolean, drop: boolean) => ({ inputs: { character: c, grab, drop, throw: false } });
    const out = runNode(carryNode, [s(true, false), s(true, false), s(false, false), s(true, false), s(false, true)], {}, w);
    expect(out.map((o) => o.holding)).toEqual([true, true, true, true, false]);
  });

  it('interact fires once per press and reports the target', () => {
    const w = createWorld('2d-side');
    for (let x = -3; x <= 3; x++) w.spawn(block(x, -0.5));
    const c = w.spawn(char(0, 0.5));
    const it = w.spawn(item(1, 0.3));
    for (let i = 0; i < 5; i++) w.step(DT);
    const p = (press: boolean) => ({ inputs: { character: c, press } });
    const out = runNode(interactNode, [p(false), p(true), p(true), p(false), p(true)], {}, w);
    expect(out.map((o) => o.fired)).toEqual([false, true, false, false, true]);
    expect(out[1]!.target).toBe(it);
    expect(out[2]!.target).toBeNull();
  });

  it('nodes with nothing connected stay inert', () => {
    const w = createWorld('2d-side');
    expect(runNode(carryNode, [{}], {}, w)[0]).toEqual({ holding: false, heldItem: null });
    expect(runNode(interactNode, [{ inputs: { press: true } }], {}, w)[0]).toEqual({ fired: false, target: null });
  });
});
