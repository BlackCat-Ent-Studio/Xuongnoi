import { describe, expect, it } from 'vitest';
import type { EntityId, EntitySpec, NodeDef, Params, PortValues, Vec3, ViewMode, World, WorldApi } from '../../src/engine/types';
import { TICK_DT } from '../../src/engine/types';
import { aheadSensorNode } from '../../src/nodes/ahead-sensor';
import { colorSensorNode } from '../../src/nodes/color-sensor';
import { speedSensorNode } from '../../src/nodes/speed-sensor';
import { visionSensorNode } from '../../src/nodes/vision-sensor';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld } from './fake-world';

/** Runs one node over several ticks; `before` may move things between ticks. */
function drive<S>(def: NodeDef<S>, world: WorldApi, ticks: number, inputs: PortValues, over: Params = {}, before?: (tick: number) => void): PortValues[] {
  const params = defaultParams(def, over);
  const state = def.create ? def.create(makeCtx(world), params) : (undefined as S);
  const out: PortValues[] = [];
  for (let t = 0; t < ticks; t++) {
    before?.(t);
    out.push(def.evaluate(makeCtx(world, { tick: t }), inputs, params, state));
  }
  return out;
}

const person = (pos: Vec3, role: 'player' | 'bot' = 'player'): EntitySpec => ({
  kind: 'character',
  ownerNodeId: 'n',
  position: pos,
  size: { x: 0.8, y: 1.8, z: 0.8 },
  color: '#ffffff',
  solid: true,
  role,
});
const block = (pos: Vec3, size: Vec3, color = '#888888'): EntitySpec => ({ kind: 'block', ownerNodeId: 'b', position: pos, size, color, solid: true });
const v = (x: number, y = 1, z = 0): Vec3 => ({ x, y, z });

describe('speed sensor', () => {
  function moving(mode: ViewMode, step: Vec3) {
    const w = makeWorld();
    (w as { mode: ViewMode }).mode = mode;
    const id = 'obj';
    let pos = v(0, 1, 0);
    w.entities.set(id, { id, kind: 'character', ownerNodeId: 'n', position: pos, size: v(1, 1, 1), color: '#fff', visible: true });
    const move = (): void => {
      pos = { x: pos.x + step.x, y: pos.y + step.y, z: pos.z + step.z };
      w.entities.set(id, { ...w.entities.get(id)!, position: pos });
    };
    return { w, id, move };
  }

  it('is 0 on the first tick, then distance per second', () => {
    const { w, id, move } = moving('2d-side', v(0.1, 0, 0));
    const out = drive(speedSensorNode, w, 4, { who: id }, {}, (t) => t > 0 && move());
    expect(out[0]).toEqual({ speed: 0, still: true, fast: false });
    expect(out[1]!.speed).toBeCloseTo(0.1 / TICK_DT, 6);
    expect(out[3]!.still).toBe(false);
  });

  it('fast only above the threshold', () => {
    const slow = moving('2d-side', v(2 * TICK_DT, 0, 0));
    expect(drive(speedSensorNode, slow.w, 3, { who: slow.id }, { threshold: 3 }, (t) => t > 0 && slow.move())[2]!.fast).toBe(false);
    const quick = moving('2d-side', v(4 * TICK_DT, 0, 0));
    const out = drive(speedSensorNode, quick.w, 3, { who: quick.id }, { threshold: 3 }, (t) => t > 0 && quick.move());
    expect(out[2]!.fast).toBe(true);
    expect(out[2]!.speed).toBeCloseTo(4, 6);
  });

  it('still when parked, and when the object is missing', () => {
    const { w, id } = moving('2d-side', v(0, 0, 0));
    expect(drive(speedSensorNode, w, 3, { who: id })[2]).toEqual({ speed: 0, still: true, fast: false });
    expect(drive(speedSensorNode, w, 2, { who: null })[1]).toEqual({ speed: 0, still: false, fast: false });
    expect(drive(speedSensorNode, w, 2, { who: 'ghost' })[1]).toEqual({ speed: 0, still: false, fast: false });
  });

  it('flat mode ignores jumping, all-directions counts it', () => {
    const up = moving('3d', v(0, 3 * TICK_DT, 0));
    expect(drive(speedSensorNode, up.w, 3, { who: up.id }, {}, (t) => t > 0 && up.move())[2]!.still).toBe(true);
    const up2 = moving('3d', v(0, 3 * TICK_DT, 0));
    const out = drive(speedSensorNode, up2.w, 3, { who: up2.id }, { axes: 'all' }, (t) => t > 0 && up2.move());
    expect(out[2]!.speed).toBeCloseTo(3, 6);
  });

  it('the side view ignores depth and the top view ignores height', () => {
    const side = moving('2d-side', v(0, 0, 5 * TICK_DT));
    expect(drive(speedSensorNode, side.w, 3, { who: side.id }, {}, (t) => t > 0 && side.move())[2]!.speed).toBe(0);
    const top = moving('2d-top', v(0, 5 * TICK_DT, 0));
    expect(drive(speedSensorNode, top.w, 3, { who: top.id }, { axes: 'all' }, (t) => t > 0 && top.move())[2]!.speed).toBe(0);
  });

  it('a different object restarts the measurement', () => {
    const { w, id, move } = moving('2d-side', v(1, 0, 0));
    w.entities.set('other', { ...w.entities.get(id)!, id: 'other', position: v(50, 1, 0) });
    const params = defaultParams(speedSensorNode);
    const s = speedSensorNode.create!(makeCtx(w), params);
    speedSensorNode.evaluate(makeCtx(w), { who: id }, params, s);
    move();
    expect(speedSensorNode.evaluate(makeCtx(w), { who: id }, params, s).speed).toBeGreaterThan(0);
    expect(speedSensorNode.evaluate(makeCtx(w), { who: 'other' }, params, s).speed).toBe(0);
  });
});

describe('ahead sensor', () => {
  it('measures the gap to a wall inside the reach and pulses once', () => {
    const w = createWorld('2d-side');
    const me = w.spawn(person(v(0)));
    const wall = w.spawn(block(v(5, 1), v(1, 2, 1)));
    const out = drive(aheadSensorNode, w, 3, { who: me }, { reach: 5 });
    // 5 - 0.5 (wall half) - 0.4 (own half)
    expect(out[0]!.blocked).toBe(true);
    expect(out[0]!.distance).toBeCloseTo(4.1, 6);
    expect(out[0]!.thing).toBe(wall);
    expect(out.map((o) => o.hit)).toEqual([true, false, false]);
  });

  it('is clear beyond the reach: no wall, distance = reach, no pulse', () => {
    const w = createWorld('2d-side');
    const me = w.spawn(person(v(0)));
    w.spawn(block(v(5, 1), v(1, 2, 1)));
    const out = drive(aheadSensorNode, w, 2, { who: me }, { reach: 3 });
    expect(out[0]).toEqual({ blocked: false, distance: 3, thing: null, hit: false });
  });

  it('pulses again after the way cleared and then closes', () => {
    const w = createWorld('2d-side');
    const me = w.spawn(person(v(0)));
    const wall = w.spawn(block(v(3, 1), v(1, 2, 1)));
    const out = drive(aheadSensorNode, w, 4, { who: me }, { reach: 3 }, (t) => {
      if (t === 2) w.hide(wall);
      if (t === 3) w.show(wall);
    });
    expect(out.map((o) => o.hit)).toEqual([true, false, false, true]);
    expect(out[2]!.blocked).toBe(false);
  });

  it('nothing wired is a clear way', () => {
    const w = createWorld('2d-side');
    expect(drive(aheadSensorNode, w, 1, {}, { reach: 4 })[0]).toEqual({ blocked: false, distance: 4, thing: null, hit: false });
  });
});

describe('vision sensor', () => {
  const setup = (mode: ViewMode = '3d') => {
    const w = createWorld(mode);
    const viewer = w.spawn(person(v(0, 1, 0), 'bot'));
    return { w, viewer };
  };
  const look = (w: World, viewer: EntityId, over: Params = {}, inputs: PortValues = {}) => drive(visionSensorNode, w, 1, { viewer, ...inputs }, over)[0]!;

  it('sees a player straight ahead within range and reports the distance', () => {
    const { w, viewer } = setup();
    const target = w.spawn(person(v(4)));
    const o = look(w, viewer);
    expect(o).toMatchObject({ seen: true, gained: true, lost: false, nearest: target });
    expect(o.distance).toBeCloseTo(4, 6);
  });

  it('does not see behind, beyond the range or outside the cone', () => {
    const { w, viewer } = setup();
    w.spawn(person(v(-3)));
    w.spawn(person(v(7)));
    w.spawn(person(v(2, 1, 3)));
    expect(look(w, viewer)).toMatchObject({ seen: false, nearest: null, distance: 6 });
  });

  it('the cone edge counts, one degree narrower does not', () => {
    const { w, viewer } = setup();
    w.spawn(person(v(3, 1, 3)));
    expect(look(w, viewer, { angle: 90 }).seen).toBe(true);
    expect(look(w, viewer, { angle: 89 }).seen).toBe(false);
    expect(look(w, viewer, { angle: 360 }).seen).toBe(true);
  });

  it('a solid wall between blocks the view unless walls are switched off', () => {
    const { w, viewer } = setup();
    w.spawn(person(v(5)));
    w.spawn(block(v(2.5, 1), v(1, 2, 3)));
    expect(look(w, viewer).seen).toBe(false);
    expect(look(w, viewer, { walls: 'no' }).seen).toBe(true);
  });

  it('a wall beside the line of sight does not block it', () => {
    const { w, viewer } = setup();
    w.spawn(person(v(5)));
    w.spawn(block(v(2.5, 1, 3), v(1, 2, 1)));
    expect(look(w, viewer).seen).toBe(true);
  });

  it('gained and lost are single-tick pulses', () => {
    const { w, viewer } = setup();
    const target = w.spawn(person(v(5)));
    const wall = w.spawn(block(v(2.5, 1), v(1, 2, 3)));
    w.hide(wall);
    const out = drive(visionSensorNode, w, 5, { viewer }, {}, (t) => {
      if (t === 2) w.show(wall);
      if (t === 4) w.hide(wall);
    });
    expect(out.map((o) => [o.seen, o.gained, o.lost])).toEqual([
      [true, true, false],
      [true, false, false],
      [false, false, true],
      [false, false, false],
      [true, true, false],
    ]);
    expect(out[0]!.nearest).toBe(target);
  });

  it('with no target wired it follows the filter and picks the nearest', () => {
    const { w, viewer } = setup();
    const near = w.spawn(person(v(2)));
    w.spawn(person(v(4)));
    const bot = w.spawn(person(v(1), 'bot'));
    expect(look(w, viewer).nearest).toBe(near);
    expect(look(w, viewer, { filter: 'bot' }).nearest).toBe(bot);
    expect(look(w, viewer, { filter: 'item' }).seen).toBe(false);
  });

  it('a wired target is watched alone, whatever its kind', () => {
    const { w, viewer } = setup();
    const crate = w.spawn(block(v(3), v(1, 1, 1)));
    w.spawn(person(v(2)));
    expect(look(w, viewer, { walls: 'no' }, { target: crate }).nearest).toBe(crate);
    expect(look(w, viewer, {}, { target: 'ghost' }).seen).toBe(false);
  });

  it('never sees itself, and a hidden target is not seen', () => {
    const { w, viewer } = setup();
    const target = w.spawn(person(v(2)));
    expect(look(w, viewer, { filter: 'bot' }).seen).toBe(false);
    w.hide(target);
    expect(look(w, viewer).seen).toBe(false);
  });

  it('a viewer that is not wired sees nothing', () => {
    const { w } = setup();
    w.spawn(person(v(2)));
    expect(drive(visionSensorNode, w, 1, {})[0]!.seen).toBe(false);
  });

  it('side view: follows the way the character faces', () => {
    const w = createWorld('2d-side');
    w.spawn(block(v(0, -0.5), v(60, 1, 1)));
    const viewer = w.spawn(person(v(0, 1, 0), 'bot'));
    // Walk left so the figure turns that way.
    for (let i = 0; i < 6; i++) {
      w.setCharacterIntent(viewer, { moveX: -1, moveY: 0, jump: false, speed: 2, jumpPower: 0 });
      w.step(TICK_DT);
    }
    const at = w.getEntity(viewer)!.position;
    const right = w.spawn(person(v(at.x + 3, at.y)));
    expect(look(w, viewer).seen).toBe(false);
    const left = w.spawn(person(v(at.x - 3, at.y)));
    expect(look(w, viewer)).toMatchObject({ seen: true, nearest: left });
    w.hide(left);
    w.hide(right);
  });

  it('side view: a target above in the cone counts, one far above does not', () => {
    const w = createWorld('2d-side');
    const viewer = w.spawn(person(v(0, 1, 0), 'bot'));
    w.spawn(person(v(3, 4)));
    expect(look(w, viewer, { angle: 90 }).seen).toBe(true);
    expect(look(w, viewer, { angle: 60 }).seen).toBe(false);
  });

  it('top view: a wall on the plane hides the target', () => {
    const { w, viewer } = setup('2d-top');
    w.spawn(person(v(5)));
    w.spawn(block(v(2.5, 0.5), v(1, 1, 3)));
    expect(look(w, viewer).seen).toBe(false);
  });
});

describe('world line of sight', () => {
  it('is false for unknown or hidden ends and ignores the end bodies', () => {
    const w = createWorld('3d');
    const a = w.spawn(person(v(0)));
    const b = w.spawn(person(v(4)));
    expect(w.lineOfSight(a, b)).toBe(true);
    expect(w.lineOfSight(a, 'ghost')).toBe(false);
    const wall = w.spawn(block(v(2), v(1, 2, 3)));
    expect(w.lineOfSight(a, b)).toBe(false);
    w.hide(wall);
    expect(w.lineOfSight(a, b)).toBe(true);
    w.hide(b);
    expect(w.lineOfSight(a, b)).toBe(false);
  });

  it('a block that is the target itself never blocks, a floor under both does not either', () => {
    const w = createWorld('2d-side');
    const floor = w.spawn(block(v(0, -0.5), v(40, 1, 1)));
    const a = w.spawn(person(v(-3)));
    const crate = w.spawn(block(v(3, 1), v(1, 1, 1)));
    expect(w.lineOfSight(a, crate)).toBe(true);
    expect(w.lineOfSight(a, floor)).toBe(true);
    const b = w.spawn(person(v(5)));
    expect(w.lineOfSight(a, b)).toBe(false);
  });
});

describe('color sensor', () => {
  const RED = '#ef4444';
  const YELLOW = '#facc15';
  const GREEN = '#22c55e';

  function floorWorld() {
    const w = createWorld('2d-side');
    w.spawn(block(v(0, 0), v(4, 1, 1), RED));
    w.spawn(block(v(4, 0), v(4, 1, 1), GREEN));
    w.spawn(block(v(8, 0), v(4, 1, 1), '#123456'));
    return w;
  }
  const stand = (w: World, x: number) => w.spawn(person(v(x, 1.4)));

  it('reads the palette number of the block under the feet', () => {
    const w = floorWorld();
    expect(drive(colorSensorNode, w, 1, { who: stand(w, 0) })[0]).toEqual({ index: 1, match: true });
    expect(drive(colorSensorNode, w, 1, { who: stand(w, 4) })[0]).toEqual({ index: 3, match: false });
  });

  it('match follows the wanted colour; other colours and no block read 0', () => {
    const w = floorWorld();
    expect(drive(colorSensorNode, w, 1, { who: stand(w, 4) }, { want: 3 })[0]).toEqual({ index: 3, match: true });
    expect(drive(colorSensorNode, w, 1, { who: stand(w, 8) }, { want: 1 })[0]).toEqual({ index: 0, match: false });
    expect(drive(colorSensorNode, w, 1, { who: stand(w, 30) })[0]).toEqual({ index: 0, match: false });
    expect(drive(colorSensorNode, w, 1, {})[0]).toEqual({ index: 0, match: false });
  });

  it('colours compare ignoring case, and the palette can be changed', () => {
    const w = floorWorld();
    const who = stand(w, 8);
    expect(drive(colorSensorNode, w, 1, { who }, { color2: '#123456', want: 2 })[0]).toEqual({ index: 2, match: true });
    expect(drive(colorSensorNode, w, 1, { who: stand(w, 0) }, { color1: '#EF4444' })[0]!.index).toBe(1);
  });

  it('a block that was recoloured by the Vật thể node is read by its new colour', () => {
    const w = floorWorld();
    const pad = w.spawn(block(v(20, 0), v(4, 1, 1), '#cccccc'));
    const who = stand(w, 20);
    expect(drive(colorSensorNode, w, 1, { who })[0]!.index).toBe(0);
    w.setEntityStyle(pad, { color: YELLOW });
    expect(drive(colorSensorNode, w, 1, { who })[0]!.index).toBe(2);
  });

  it('standing on a raised block reads that block, not the floor behind it', () => {
    const w = floorWorld();
    w.spawn(block(v(0, 1), v(2, 1, 1), YELLOW));
    const who = w.spawn(person(v(0, 2.4)));
    expect(drive(colorSensorNode, w, 1, { who })[0]!.index).toBe(2);
  });

  it('reads the block in front when asked, and ignores non-blocks and out-of-reach ones', () => {
    const w = createWorld('2d-side');
    const who = w.spawn(person(v(0, 1)));
    w.spawn(block(v(1.5, 1), v(1, 2, 1), YELLOW));
    expect(drive(colorSensorNode, w, 1, { who }, { where: 'ahead' })[0]).toEqual({ index: 2, match: false });
    expect(drive(colorSensorNode, w, 1, { who }, { where: 'ahead', reach: 0.2 })[0]!.index).toBe(0);
    expect(drive(colorSensorNode, w, 1, { who }, { where: 'ahead', want: 2 })[0]!.match).toBe(true);
    const w2 = createWorld('2d-side');
    const who2 = w2.spawn(person(v(0, 1)));
    w2.spawn(person(v(1.5, 1)));
    expect(drive(colorSensorNode, w2, 1, { who: who2 }, { where: 'ahead' })[0]!.index).toBe(0);
  });
});
