import { describe, expect, it } from 'vitest';
import { createWorld, SWING_SECONDS } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld, runNode } from '../nodes/fake-world';
import { blockNode } from '../../src/nodes/block';
import { handToolNode } from '../../src/nodes/hand-tool';
import { itemNode } from '../../src/nodes/item';
import { swingAngle, swingLunge } from '../../src/render/character-motion';
import type { CharacterIntent, EntitySpec, ViewMode, World, WorldApi } from '../../src/engine/types';

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
const tool = (x: number, y: number, z = 0, over: Partial<EntitySpec> = {}): EntitySpec =>
  item(x, y, z, { shape: 'pickaxe', holdStyle: 'hand', ...over });
const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) w.step(DT);
};

function scene(mode: ViewMode) {
  const w = createWorld(mode);
  if (mode === '2d-side') {
    for (let x = -10; x <= 10; x++) w.spawn(block(x, -0.5));
  } else if (mode === '3d') {
    for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) w.spawn(block(x, -0.5, z));
  }
  const y = mode === '2d-top' ? 0 : 0.5;
  const c = w.spawn(char(0, y));
  return { w, c, y };
}

describe.each(MODES)('hand tools in %s', (mode) => {
  const itemY = (y: number): number => (mode === '2d-top' ? 0 : y);

  it('equips the nearest free hand item and ignores head items', () => {
    const { w, c } = scene(mode);
    const head = w.spawn(item(0.3, itemY(0.3)));
    const far = w.spawn(tool(3, itemY(0.3)));
    const near = w.spawn(tool(0.9, itemY(0.3)));
    run(w, 5);
    expect(w.equip(c, 1.3)).toBe(near);
    expect(w.isInHand(near)).toBe(true);
    expect(w.handItem(c)).toBe(near);
    expect(w.isInHand(head)).toBe(false);
    expect(w.isInHand(far)).toBe(false);
    expect(w.equip(c, 1.3)).toBeNull(); // hand already full
  });

  it('carry (above head) only grabs head items and leaves the hand slot alone', () => {
    const { w, c } = scene(mode);
    const sword = w.spawn(tool(0.4, itemY(0.3), 0, { shape: 'sword' }));
    const box = w.spawn(item(0.8, itemY(0.3)));
    run(w, 5);
    expect(w.grab(c, 1.2)).toBe(box);
    expect(w.isHeld(sword)).toBe(false);
    expect(w.equip(c, 1.3)).toBe(sword);
    expect(w.heldItem(c)).toBe(box);
    expect(w.handItem(c)).toBe(sword);
    expect(w.isHeld(box)).toBe(true);
    expect(w.isHeld(sword)).toBe(false); // "held" means the above-head slot only
    expect(w.isInHand(box)).toBe(false);
    // Dropping the head item leaves the tool in hand, and the other way round.
    expect(w.drop(c)).toBe(box);
    expect(w.handItem(c)).toBe(sword);
    expect(w.grab(c, 1.2)).toBe(box);
    expect(w.unequip(c)).toBe(sword);
    expect(w.heldItem(c)).toBe(box);
    expect(w.handItem(c)).toBeNull();
  });

  it('never equips head-style, fixed or hidden tools', () => {
    const { w, c } = scene(mode);
    w.spawn(tool(0.5, itemY(0.3), 0, { carryable: false }));
    const gone = w.spawn(tool(-0.5, itemY(0.3)));
    w.hide(gone);
    run(w, 5);
    expect(w.equip(c, 1.3)).toBeNull();
  });

  it('the tool in hand follows the character and is reported on its view', () => {
    const { w, c } = scene(mode);
    const t = w.spawn(tool(0.5, itemY(0.3), 0, { shape: 'sword', color: '#123456' }));
    run(w, 5);
    w.equip(c, 1.3);
    w.setCharacterIntent(c, intent({ moveX: 1 }));
    run(w, 30);
    const ch = w.getEntity(c)!;
    const view = w.getEntity(t)!;
    expect(Math.abs(view.position.x - ch.position.x)).toBeLessThan(1);
    expect(view.inHand).toBe(true);
    expect(ch.tool).toEqual({ shape: 'sword', color: '#123456' });
    expect(ch.swing).toBeUndefined();
  });

  it('unequip puts the tool down in front and it can be picked up again', () => {
    const { w, c } = scene(mode);
    const t = w.spawn(tool(0.5, itemY(0.3)));
    run(w, 5);
    w.equip(c, 1.3);
    run(w, 3);
    expect(w.unequip(c)).toBe(t);
    expect(w.handItem(c)).toBeNull();
    expect(w.getEntity(t)!.inHand).toBeUndefined();
    expect(w.getEntity(c)!.tool).toBeUndefined();
    run(w, 30);
    expect(w.getEntity(t)!.position.x).toBeGreaterThan(0.5);
    expect(w.unequip(c)).toBeNull();
    expect(w.equip(c, 1.3)).toBe(t);
  });

  it('use hits the front target once per swing and pulses usedOn for one tick', () => {
    const { w, c, y } = scene(mode);
    const rock = w.spawn(block(1.2, y));
    const behind = w.spawn(block(-1.2, y));
    run(w, 5);
    const res = w.useTool(c, 1.3);
    expect(res).toEqual({ target: rock });
    expect(w.wasUsedOn(rock)).toBe(false); // visible from the next step
    w.step(DT);
    expect(w.wasUsedOn(rock)).toBe(true);
    expect(w.wasUsedOn(behind)).toBe(false);
    w.step(DT);
    expect(w.wasUsedOn(rock)).toBe(false);
  });

  it('use has a cooldown equal to the swing length', () => {
    const { w, c, y } = scene(mode);
    const rock = w.spawn(block(1.2, y));
    run(w, 5);
    expect(w.useTool(c, 1.3)).not.toBeNull();
    expect(w.getEntity(c)!.swing).toBe(0);
    run(w, 5);
    expect(w.useTool(c, 1.3)).toBeNull();
    const mid = w.getEntity(c)!.swing!;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    run(w, Math.ceil(SWING_SECONDS / DT) + 1);
    expect(w.getEntity(c)!.swing).toBeUndefined();
    expect(w.useTool(c, 1.3)).toEqual({ target: rock });
  });

  it('use with an empty hand still swings; with nothing in front the target is null', () => {
    const { w, c } = scene(mode);
    run(w, 5);
    expect(w.handItem(c)).toBeNull();
    expect(w.useTool(c, 1.3)).toEqual({ target: null });
    expect(w.getEntity(c)!.swing).toBe(0);
  });

  it('ignores targets that are out of reach, hidden, the tool itself or the above-head item', () => {
    const { w, c, y } = scene(mode);
    w.spawn(block(3, y));
    const gone = w.spawn(block(1.2, y));
    w.hide(gone);
    const t = w.spawn(tool(0.5, itemY(0.3)));
    const head = w.spawn(item(0.4, itemY(0.3)));
    run(w, 5);
    w.equip(c, 1.3);
    w.grab(c, 1.2);
    expect(w.handItem(c)).toBe(t);
    expect(w.heldItem(c)).toBe(head);
    expect(w.useTool(c, 1.3)).toEqual({ target: null });
  });

  it('can hit loose items and other characters in front', () => {
    const { w, c, y } = scene(mode);
    const other = w.spawn({ ...char(1.1, y), ownerNodeId: 'other' });
    run(w, 5);
    expect(w.useTool(c, 1.3)).toEqual({ target: other });
    run(w, 30);
    const crate = w.spawn(item(1.1, itemY(0.3), 0, { carryable: false }));
    w.hide(other);
    run(w, 3);
    expect(w.useTool(c, 1.3)).toEqual({ target: crate });
  });

  it('the floor underfoot is not a target', () => {
    const { w, c } = scene(mode);
    run(w, 5);
    expect(w.useTool(c, 3)).toEqual({ target: null });
  });

  it('hiding the tool releases it; hiding the holder releases the tool where it is', () => {
    const { w, c } = scene(mode);
    const a = w.spawn(tool(0.5, itemY(0.3)));
    run(w, 3);
    w.equip(c, 1.3);
    w.hide(a);
    expect(w.handItem(c)).toBeNull();
    expect(w.getEntity(c)!.tool).toBeUndefined();

    const b = w.spawn(tool(0.5, itemY(0.3)));
    run(w, 3);
    expect(w.equip(c, 1.3)).toBe(b);
    w.hide(c);
    expect(w.isInHand(b)).toBe(false);
    expect(w.handItem(c)).toBeNull();
  });

  it('is deterministic', () => {
    const trace = (): string => {
      const { w, c, y } = scene(mode);
      w.spawn(tool(0.5, itemY(0.3)));
      w.spawn(block(2.6, y));
      run(w, 3);
      const out: unknown[] = [];
      w.equip(c, 1.3);
      w.setCharacterIntent(c, intent({ moveX: 1 }));
      for (let i = 0; i < 120; i++) {
        if (i === 40) out.push(w.useTool(c, 1.3));
        w.step(DT);
        out.push(w.wasUsedOn('e' + 1));
      }
      out.push(w.entities());
      return JSON.stringify(out);
    };
    expect(trace()).toBe(trace());
  });
});

describe('hand-tool node', () => {
  const ctrl = (steps: { toggle?: boolean; use?: boolean }[], world: WorldApi, reach?: number) =>
    runNode(
      handToolNode,
      steps.map((s) => ({ inputs: { character: 'c1', toggle: s.toggle ?? false, use: s.use ?? false } })),
      reach === undefined ? {} : { reach },
      world,
    );

  it('toggle equips then puts away on later rising edges; use fires once per press', () => {
    const w = createWorld('2d-side');
    for (let x = -5; x <= 5; x++) w.spawn(block(x, -0.5));
    const c = w.spawn(char(0, 0.5));
    expect(c).toBe('e12');
    const t = w.spawn(tool(0.6, 0.3));
    const rock = w.spawn(block(1.3, 0.5));
    run(w, 5);
    const params = defaultParams(handToolNode);
    const state = handToolNode.create!(makeCtx(w), params);
    const tick = (toggle: boolean, use: boolean) => {
      const out = handToolNode.evaluate(makeCtx(w), { character: c, toggle, use }, params, state);
      w.step(DT);
      return out;
    };
    const a = tick(true, false);
    expect(a).toMatchObject({ holding: true, tool: t, used: false, hit: null });
    const b = tick(true, false); // held key: no new edge
    expect(b.holding).toBe(true);
    const u = tick(false, true);
    expect(u).toMatchObject({ used: true, hit: rock });
    const held = tick(false, true); // key still down
    expect(held).toMatchObject({ used: false, hit: null });
    tick(false, false);
    run(w, 30);
    const off = tick(true, false);
    expect(off).toMatchObject({ holding: false, tool: null });
  });

  it('is inert without a character and survives a missing world target', () => {
    const out = ctrl([{ toggle: true, use: true }, { toggle: false }], makeWorld());
    for (const o of out) expect(o).toEqual({ holding: false, tool: null, used: false, hit: null });
  });
});

describe('item and block nodes', () => {
  it('item exposes inHand/usedOn and spawns with holdStyle', () => {
    const w = makeWorld();
    const state = itemNode.create!(makeCtx(w), defaultParams(itemNode, { holdStyle: 'hand', shape: 'sword' }));
    itemNode.create!(makeCtx(w), defaultParams(itemNode));
    itemNode.create!(makeCtx(w), defaultParams(itemNode, { holdStyle: 'nonsense' }));
    expect(w.spawned.map((s) => s.holdStyle)).toEqual(['hand', 'head', 'head']);
    const out = itemNode.evaluate(makeCtx(w), {}, defaultParams(itemNode), state);
    expect(out).toMatchObject({ inHand: false, usedOn: false });
  });

  it('an item without the holdStyle param (old board) behaves as head', () => {
    const w = makeWorld();
    const params = defaultParams(itemNode);
    delete params.holdStyle;
    itemNode.create!(makeCtx(w), params);
    expect(w.spawned[0]!.holdStyle).toBe('head');
  });

  it('block reports usedOn', () => {
    const w = makeWorld();
    const out = runNode(blockNode, [{}], {}, w);
    expect(out[0]).toEqual({ self: 'e1', usedOn: false });
  });
});

describe('swing animation curve', () => {
  it('starts and ends at rest, winds back past vertical, then strikes forward', () => {
    expect(swingAngle(0)).toBe(0);
    expect(swingAngle(1)).toBeCloseTo(0, 6);
    expect(swingAngle(0.35)).toBeGreaterThan(2);
    expect(swingAngle(0.65)).toBeLessThan(0);
    expect(swingAngle(-1)).toBe(0);
    expect(swingLunge(0)).toBe(0);
    expect(swingLunge(0.5)).toBeGreaterThan(0);
    expect(swingLunge(1)).toBeCloseTo(0, 6);
  });
});
