import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createWorld } from '../../src/world/world';
import { blockNode } from '../../src/nodes/block';
import { itemNode } from '../../src/nodes/item';
import { characterNode } from '../../src/nodes/character';
import { vehicleNode } from '../../src/nodes/vehicle';
import { touchNode } from '../../src/nodes/touch';
import { ColliderFrames } from '../../src/render/collider-frames';
import { defaultParams, makeCtx, makeWorld } from '../nodes/fake-world';
import type { CharacterIntent, EntitySpec, EntityView, ViewMode, World } from '../../src/engine/types';

const DT = 1 / 60;

const intent = (p: Partial<CharacterIntent> = {}): CharacterIntent => ({
  moveX: 0, moveY: 0, jump: false, speed: 5, jumpPower: 10, ...p,
});
const block = (x: number, y: number, over: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'block', ownerNodeId: 'b', position: { x, y, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', solid: true, ...over,
});
const char = (x: number, y: number, over: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'character', ownerNodeId: 'c', position: { x, y, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true, ...over,
});
const item = (x: number, y: number, over: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'item', ownerNodeId: 'i', position: { x, y, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ff0', solid: false, ...over,
});
const run = (w: World, n: number): void => {
  for (let i = 0; i < n; i++) w.step(DT);
};
const side = (): World => createWorld('2d-side' as ViewMode);
const floor = (w: World): void => {
  for (let x = -10; x <= 10; x++) w.spawn(block(x, -0.5));
};
const posOf = (w: World, id: string) => w.getEntity(id)!.position;

describe('collider blocks movement', () => {
  it('default collider equals the visual box', () => {
    const w = side();
    floor(w);
    const wall = w.spawn(block(3, 0.5));
    const c = w.spawn(char(0, 0.5));
    w.setCharacterIntent(c, intent({ moveX: 1 }));
    run(w, 120);
    // wall left face at 2.5, character half width 0.5
    expect(posOf(w, c).x).toBeCloseTo(2, 2);
    expect(w.getEntity(wall)!.collider).toBeUndefined();
  });

  it('a narrower wall collider lets the character walk closer than the drawn box', () => {
    const w = side();
    floor(w);
    w.spawn(block(3, 0.5, { size: { x: 2, y: 1, z: 1 }, colliderSize: { x: 0.5, y: 0, z: 0 } }));
    const c = w.spawn(char(0, 0.5));
    w.setCharacterIntent(c, intent({ moveX: 1 }));
    run(w, 120);
    // collider spans 2.75..3.25 -> character stops at 2.25
    expect(posOf(w, c).x).toBeCloseTo(2.25, 2);
  });

  it('collider offset moves the blocking area', () => {
    const w = side();
    floor(w);
    w.spawn(block(3, 0.5, { colliderOffset: { x: 2, y: 0, z: 0 } }));
    const c = w.spawn(char(0, 0.5));
    w.setCharacterIntent(c, intent({ moveX: 1 }));
    run(w, 120);
    // blocker centered at x=5, left face 4.5 -> character stops at 4
    expect(posOf(w, c).x).toBeCloseTo(4, 2);
  });

  it('a character with a smaller collider fits through a gap the visual box would not', () => {
    const w = side();
    floor(w);
    w.spawn(block(3, 1.4)); // ceiling bottom at 0.9: gap of 0.9 above the floor
    const wide = w.spawn(char(0, 0.5));
    w.setCharacterIntent(wide, intent({ moveX: 1 }));
    run(w, 120);
    expect(posOf(w, wide).x).toBeLessThan(2.1);

    const w2 = side();
    floor(w2);
    w2.spawn(block(3, 1.4));
    const small = w2.spawn(char(0, 0.5, { colliderSize: { x: 0, y: 0.8, z: 0 }, colliderOffset: { x: 0, y: -0.1, z: 0 } }));
    w2.setCharacterIntent(small, intent({ moveX: 1 }));
    run(w2, 120);
    expect(posOf(w2, small).x).toBeGreaterThan(4);
  });

  it('the character stands on a floor by its collider bottom', () => {
    const w = side();
    floor(w);
    // collider 0.5 tall centred on the entity: feet sit 0.25 below the centre instead of 0.5
    const c = w.spawn(char(0, 2, { colliderSize: { x: 0, y: 0.5, z: 0 } }));
    run(w, 120);
    expect(posOf(w, c).y).toBeCloseTo(0.25, 2);
    expect(w.isOnGround(c)).toBe(true);
  });
});

describe('collider and contacts', () => {
  it('isTouching follows the collider box', () => {
    const w = side();
    const a = w.spawn(item(0, 5, { gravityScale: 0 }));
    const b = w.spawn(block(3, 5, { solid: false }));
    run(w, 1);
    expect(w.isTouching(a, b)).toBe(false);
    const w2 = side();
    const a2 = w2.spawn(item(0, 5, { gravityScale: 0 }));
    const b2 = w2.spawn(block(3, 5, { solid: false, colliderSize: { x: 8, y: 0, z: 0 } }));
    run(w2, 1);
    expect(w2.isTouching(a2, b2)).toBe(true);
  });

  it('a shrunk collider stops touching what the drawn box would reach', () => {
    const w = side();
    const a = w.spawn(item(1.8, 5, { gravityScale: 0 }));
    const b = w.spawn(block(0, 5, { solid: false, size: { x: 4, y: 1, z: 1 }, colliderSize: { x: 1, y: 0, z: 0 } }));
    run(w, 1);
    expect(w.isTouching(a, b)).toBe(false);
    const w2 = side();
    const a2 = w2.spawn(item(1.8, 5, { gravityScale: 0 }));
    const b2 = w2.spawn(block(0, 5, { solid: false, size: { x: 4, y: 1, z: 1 } }));
    run(w2, 1);
    expect(w2.isTouching(a2, b2)).toBe(true);
  });

  it('exposes the collider on the view only when custom', () => {
    const w = side();
    const plain = w.spawn(block(0, 0));
    const custom = w.spawn(block(5, 0, { colliderSize: { x: 2, y: 0, z: 0 }, colliderOffset: { x: 0, y: 1, z: 0 } }));
    expect(w.getEntity(plain)!.collider).toBeUndefined();
    expect(w.getEntity(custom)!.collider).toEqual({ position: { x: 5, y: 1, z: 0 }, size: { x: 2, y: 1, z: 1 } });
  });

  it('solidBoxes and solidAt report the collider box', () => {
    const w = side();
    w.spawn(block(0, 0, { colliderSize: { x: 0.2, y: 0, z: 0 } }));
    expect(w.solidBoxes()[0]!.size.x).toBeCloseTo(0.2);
    expect(w.solidAt({ x: 0.4, y: 0, z: 0 })).toBe(false);
    expect(w.solidAt({ x: 0.05, y: 0, z: 0 })).toBe(true);
  });

  it('probeAhead measures to the collider of what is in front', () => {
    const w = side();
    const me = w.spawn(char(0, 0));
    w.setCharacterIntent(me, intent({ moveX: 1 }));
    const wall = w.spawn(block(5, 0, { size: { x: 4, y: 1, z: 1 }, colliderSize: { x: 1, y: 0, z: 0 } }));
    run(w, 2);
    w.setCharacterIntent(me, intent());
    const hit = w.probeAhead(me, 10);
    expect(hit?.id).toBe(wall);
    // drawn face would be about 2.3 away; the collider face (x = 4.5) is about 3.8 away
    expect(hit!.distance).toBeGreaterThan(3.3);
  });
});

describe('gravity scale', () => {
  const fall = (scale: number | undefined): number => {
    const w = side();
    const c = w.spawn(char(0, 20, scale === undefined ? {} : { gravityScale: scale }));
    run(w, 30);
    return posOf(w, c).y;
  };

  it('default is unchanged', () => {
    expect(fall(undefined)).toBeCloseTo(fall(1), 6);
  });

  it('0 floats, 2 falls faster', () => {
    expect(fall(0)).toBeCloseTo(20, 6);
    expect(20 - fall(2)).toBeGreaterThan(1.9 * (20 - fall(1)));
    expect(20 - fall(2)).toBeLessThan(2.1 * (20 - fall(1)));
  });

  it('a floating item stays put and a heavy vehicle drops', () => {
    const w = side();
    const i = w.spawn(item(0, 5, { gravityScale: 0 }));
    const v = w.spawn({ kind: 'vehicle', ownerNodeId: 'v', position: { x: 3, y: 10, z: 0 }, size: { x: 2, y: 1, z: 1 }, color: '#f00', solid: true, gravityScale: 2 });
    run(w, 30);
    expect(posOf(w, i).y).toBeCloseTo(5, 6);
    expect(posOf(w, v).y).toBeLessThan(10);
  });

  it('garbage input falls back to normal gravity', () => {
    expect(fall(Number.NaN)).toBeCloseTo(fall(1), 6);
  });
});

describe('item friction and bounce', () => {
  const thrownDistance = (friction?: number): number => {
    const w = side();
    floor(w);
    const c = w.spawn(char(0, 0.5));
    const i = w.spawn(item(0.3, 0.3, friction === undefined ? {} : { friction }));
    run(w, 5);
    w.grab(c, 1.2);
    run(w, 5);
    w.throwHeld(c, 8);
    run(w, 600);
    return posOf(w, i).x;
  };

  it('default friction matches an explicit 10', () => {
    expect(thrownDistance()).toBeCloseTo(thrownDistance(10), 6);
  });

  it('lower friction slides farther than higher friction', () => {
    expect(thrownDistance(1)).toBeGreaterThan(thrownDistance(10) + 0.5);
    expect(thrownDistance(40)).toBeLessThan(thrownDistance(10));
  });

  it('bounce 0.6 rebounds and default does not', () => {
    const peak = (bounce?: number): number => {
      const w = side();
      floor(w);
      const i = w.spawn(item(0, 6, bounce === undefined ? {} : { bounce }));
      let landed = false;
      let high = 0;
      for (let n = 0; n < 240; n++) {
        w.step(DT);
        const y = posOf(w, i).y;
        if (!landed && w.getEntity(i)!.position.y <= 0.31) landed = true;
        if (landed) high = Math.max(high, y);
      }
      return high;
    };
    expect(peak()).toBeLessThan(0.32);
    expect(peak(0.6)).toBeGreaterThan(1);
  });

  it('bounce settles instead of jittering forever', () => {
    const w = side();
    floor(w);
    const i = w.spawn(item(0, 3, { bounce: 0.5 }));
    run(w, 60 * 12);
    expect(posOf(w, i).y).toBeCloseTo(0.3, 2);
    expect(w.getEntity(i)!.position.y).toBeLessThan(0.31);
  });
});

describe('node params', () => {
  it('every body node lists the advanced collider and gravity params with neutral defaults', () => {
    for (const def of [blockNode, itemNode, characterNode, vehicleNode]) {
      const size = def.params.find((p) => p.id === 'colliderSize');
      const off = def.params.find((p) => p.id === 'colliderOffset');
      const g = def.params.find((p) => p.id === 'gravityScale');
      expect(size).toMatchObject({ kind: 'vec3', advanced: true, default: { x: 0, y: 0, z: 0 } });
      expect(off).toMatchObject({ kind: 'vec3', advanced: true, default: { x: 0, y: 0, z: 0 } });
      expect(g).toMatchObject({ kind: 'number', advanced: true, default: 1 });
    }
    expect(itemNode.params.find((p) => p.id === 'friction')).toMatchObject({ advanced: true, default: 10 });
    expect(itemNode.params.find((p) => p.id === 'bounce')).toMatchObject({ advanced: true, default: 0 });
  });

  it('default node params spawn plain bodies', () => {
    const w = side();
    for (const def of [blockNode, itemNode, characterNode, vehicleNode]) {
      const params = defaultParams(def);
      const ctx = { ...makeCtx(makeWorld()), world: w, nodeId: def.kind };
      const s = def.create!(ctx, params) as { id: string };
      const v = w.getEntity(s.id)!;
      expect(v.collider).toBeUndefined();
    }
  });

  it('collider params reach the spawned entity', () => {
    const w = side();
    const params = defaultParams(blockNode, { colliderSize: { x: 3, y: 0, z: 0 }, colliderOffset: { x: 0, y: 2, z: 0 } });
    const ctx = { ...makeCtx(makeWorld()), world: w, nodeId: 'blk' };
    const s = blockNode.create!(ctx, params) as { id: string };
    expect(w.getEntity(s.id)!.collider).toEqual({ position: { x: 0, y: 2, z: 0 }, size: { x: 3, y: 1, z: 1 } });
  });
});

describe('touch sensor geometric path', () => {
  it('uses the collider box of the views', () => {
    const mk = (id: string, x: number, collider?: EntityView['collider']): EntityView => ({
      id, kind: 'block', ownerNodeId: 'x', position: { x, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 }, color: '#fff', visible: true, ...(collider ? { collider } : {}),
    });
    const touching = (b: EntityView, grow = 0.1): boolean => {
      const w = makeWorld();
      w.entities.set('A', mk('A', 0));
      w.entities.set('B', b);
      const params = defaultParams(touchNode, { grow });
      const s = touchNode.create!(makeCtx(w), params);
      return touchNode.evaluate(makeCtx(w, { dt: DT }), { a: 'A', b: 'B' }, params, s).touching as boolean;
    };
    expect(touching(mk('B', 2.5))).toBe(false); // gap 0.5 > grow 0.1
    expect(touching(mk('B', 2.5, { position: { x: 1.5, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 } }))).toBe(true);
    expect(touching(mk('B', 1.5, { position: { x: 5, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 } }))).toBe(false);
  });
});

describe('collider frames', () => {
  const view = (id: string, owner: string, collider?: EntityView['collider']): EntityView => ({
    id, kind: 'block', ownerNodeId: owner, position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#fff', visible: true, ...(collider ? { collider } : {}),
  });

  it('shows frames only for selected owners and hides them again', () => {
    const parent = new THREE.Group();
    const frames = new ColliderFrames(parent);
    const list = [view('a', 'n1', { position: { x: 1, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 } }), view('b', 'n2')];
    frames.sync(list, new Set(['n1']));
    expect(frames.shown).toBe(1);
    expect(parent.children[0]!.scale.x).toBe(2);
    frames.sync(list, new Set(['n1', 'n2']));
    expect(frames.shown).toBe(2);
    frames.sync(list, new Set());
    expect(frames.shown).toBe(0);
    frames.dispose();
  });
});
