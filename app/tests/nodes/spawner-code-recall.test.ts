import { beforeAll, describe, expect, it } from 'vitest';
import { activeInputs } from '../../src/engine/registry';
import { TICK_DT, type EntityId, type Graph, type Params, type PortValues, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { cargoNode } from '../../src/nodes/cargo';
import { MAX_ALIVE_LIMIT, spawnerNode } from '../../src/nodes/spawner';
import { zoneSensorNode } from '../../src/nodes/zone-sensor';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';
import { allBoards } from '../editor/solid-helpers';
import { defaultParams, makeCtx } from './fake-world';

registerAllNodes();

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const realWorld = (): World => createWorld('3d', { realPhysics: true, rapier });

function floor(w: World): void {
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 }, color: '#888888', solid: true });
}

/** A spawner card played by hand on `w`: `fire` makes one object, `step` runs one tick with the given inputs. */
function maker(w: World, over: Params = {}, nodeId = 'maker') {
  const params = defaultParams(spawnerNode, { position: { x: 0, y: 0.3, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, lifetime: 0, maxAlive: 50, ...over });
  const state = spawnerNode.create!(makeCtx(w, { nodeId }), params);
  let tick = 0;
  const step = (inputs: PortValues = {}): PortValues => spawnerNode.evaluate(makeCtx(w, { tick: tick++, nodeId }), { spawn: false, ...inputs }, params, state);
  const fire = (inputs: PortValues = {}): EntityId => {
    step(inputs);
    return step({ spawn: true, ...inputs }).lastSpawned as EntityId;
  };
  /** One full recall press: the edge, then the world moves on a tick. */
  const recall = (thing: EntityId | null): PortValues => {
    step({ recallThing: thing, recall: false });
    const out = step({ recallThing: thing, recall: true });
    w.step(TICK_DT);
    return out;
  };
  return { params, step, fire, recall };
}

describe('spawner: "Số lượng tối đa" goes up to 200', () => {
  it('the setting tops out at 200 and still starts at 3', () => {
    expect(MAX_ALIVE_LIMIT).toBe(200);
    expect(spawnerNode.params.find((p) => p.id === 'maxAlive')).toMatchObject({ default: 3, min: 1, max: 200 });
    expect(spawnerNode.params.find((p) => p.id === 'maxAlive')!.legacyDefault).toBeUndefined();
  });

  it.each([1, 3, 50, 51, 120, 200])('keeps exactly %i alive when asked to', (max) => {
    const w = createWorld('3d');
    const m = maker(w, { maxAlive: max });
    let out: PortValues = {};
    for (let n = 0; n < max + 5; n++) {
      m.step();
      out = m.step({ spawn: true });
    }
    expect(out.count).toBe(max);
    expect(w.entities().filter((e) => e.kind === 'item' && e.visible)).toHaveLength(max);
  });

  it('a number above 200 is held at 200', () => {
    const w = createWorld('3d');
    const m = maker(w, { maxAlive: 500 });
    let out: PortValues = {};
    for (let n = 0; n < 210; n++) {
      m.step();
      out = m.step({ spawn: true });
    }
    expect(out.count).toBe(200);
  });

  it('200 alive under real physics keep stepping, and one recall brings the count to 199', () => {
    const w = realWorld();
    floor(w);
    const m = maker(w, { maxAlive: 200, recallPorts: 'yes', shape: 'crate', carryable: 'yes' });
    const made: EntityId[] = [];
    for (let n = 0; n < 200; n++) {
      m.params.position = { x: (n % 20) * 0.5 - 5, y: 0.2, z: Math.floor(n / 20) * 0.5 - 2.5 };
      made.push(m.fire());
      w.step(TICK_DT);
    }
    expect(m.step().count).toBe(200);
    expect(m.recall(made[77]!).count).toBe(199);
    expect(w.getEntity(made[77]!)).toBeUndefined();
    expect(w.entities().filter((e) => e.kind === 'item' && e.visible)).toHaveLength(199);
    w.dispose?.();
  });

  it('every spawner on a shipped board asks for 50 or fewer, so none of them plays differently', () => {
    const asked: number[] = [];
    const collect = (g: Graph): void => {
      for (const n of g.nodes) if (n.kind === 'spawner' && n.params.maxAlive !== undefined) asked.push(Number(n.params.maxAlive));
    };
    for (const b of allBoards()) {
      collect(b.board.graph);
      for (const c of b.board.circuits ?? []) collect(c.graph);
    }
    expect(asked.length).toBeGreaterThan(5);
    const clamp = (limit: number, v: number): number => Math.min(limit, Math.max(1, Math.floor(v)));
    for (const v of asked) expect(clamp(200, v), String(v)).toBe(clamp(50, v));
  });
});

describe('spawner: the new switches are off on every old card', () => {
  it('both are advanced, start on "Không", and add no port while off', () => {
    for (const id of ['wireCode', 'recallPorts']) {
      const p = spawnerNode.params.find((x) => x.id === id)!;
      expect(p, id).toMatchObject({ default: 'no', advanced: true });
      expect(p.legacyDefault, id).toBeUndefined();
    }
    expect(activeInputs(spawnerNode, defaultParams(spawnerNode)).map((p) => p.id)).toEqual(['spawn', 'at', 'toucher']);
    // A card saved before the switches existed has no such setting at all.
    expect(activeInputs(spawnerNode, {}).map((p) => p.id)).toEqual(['spawn', 'at', 'toucher']);
  });

  it('each switch shows only its own ports', () => {
    expect(activeInputs(spawnerNode, defaultParams(spawnerNode, { wireCode: 'yes' })).map((p) => [p.id, p.type, p.label])).toEqual([
      ['spawn', 'bool', 'Tạo'],
      ['at', 'object', 'Tại đối tượng'],
      ['toucher', 'object', 'Chạm thử với'],
      ['code', 'number', 'Mã gắn lên vật'],
    ]);
    expect(activeInputs(spawnerNode, defaultParams(spawnerNode, { recallPorts: 'yes' })).slice(3).map((p) => [p.id, p.type, p.label])).toEqual([
      ['recallThing', 'object', 'Vật cần thu hồi'],
      ['recall', 'bool', 'Thu hồi'],
    ]);
  });

  it('with the switches off, values on those inputs do nothing', () => {
    const w = createWorld('3d');
    const m = maker(w, { look: 'parcel-carton' });
    const id = m.fire({ code: 7 });
    expect(w.tagOf(id)).toBe('');
    expect(w.getEntity(id)!.look).toBe('parcel-carton');
    const out = m.recall(id);
    expect(out.count).toBe(1);
    expect(w.getEntity(id)?.visible).toBe(true);
  });
});

describe('spawner: "Gắn mã cho vật mới"', () => {
  it('the number on the wire at the moment of making becomes the goods type and is printed on a carton', () => {
    const w = createWorld('3d');
    const m = maker(w, { wireCode: 'yes', look: 'parcel-carton' });
    const seven = m.fire({ code: 7 });
    const ninety = m.fire({ code: 99 });
    expect([w.tagOf(seven), w.getEntity(seven)!.look]).toEqual(['7', 'parcel-carton#7']);
    expect([w.tagOf(ninety), w.getEntity(ninety)!.look]).toEqual(['99', 'parcel-carton#99']);
    // The first one keeps its code after later ones were made.
    expect(w.tagOf(seven)).toBe('7');
  });

  it('rounds to a whole number', () => {
    const w = createWorld('3d');
    const m = maker(w, { wireCode: 'yes', look: 'parcel-carton' });
    expect(w.tagOf(m.fire({ code: 3.4 }))).toBe('3');
    expect(w.tagOf(m.fire({ code: 3.6 }))).toBe('4');
  });

  it.each([
    ['no wire', undefined],
    ['zero', 0],
    ['a negative number', -3],
    ['above 99', 100],
    ['not a number', Number.NaN],
    ['an on / off value', true],
  ])('%s makes an object without a code, drawn as before', (_name, value) => {
    const w = createWorld('3d');
    const m = maker(w, { wireCode: 'yes', look: 'parcel-carton' });
    const id = m.fire(value === undefined ? {} : { code: value });
    expect(w.tagOf(id)).toBe('');
    expect(w.getEntity(id)!.look).toBe('parcel-carton');
  });

  it('other looks carry the code but are drawn as before; a "Vật thể" carries none', () => {
    const w = createWorld('3d');
    const plain = maker(w, { wireCode: 'yes' }, 'a').fire({ code: 5 });
    expect([w.tagOf(plain), w.getEntity(plain)!.look]).toEqual(['5', undefined]);
    const model = maker(w, { wireCode: 'yes', look: 'parcel-3' }, 'b').fire({ code: 5 });
    expect([w.tagOf(model), w.getEntity(model)!.look]).toEqual(['5', 'parcel-3']);
    const block = maker(w, { wireCode: 'yes', template: 'block', look: 'parcel-carton' }, 'c').fire({ code: 5 });
    expect([w.tagOf(block), w.getEntity(block)!.look]).toEqual(['', undefined]);
  });

  it('the code does not touch class, colour or mass of a random-class spawner', () => {
    const batch = (code: number | undefined) => {
      const w = createWorld('3d');
      const m = maker(w, { randomClass: 'yes', classSeed: 9, look: 'parcel-carton', wireCode: code === undefined ? 'no' : 'yes' });
      return Array.from({ length: 20 }, () => {
        const e = w.getEntity(m.fire(code === undefined ? {} : { code }))!;
        return [e.color, w.materialOf(e.id)!.massKg];
      });
    };
    expect(batch(4)).toEqual(batch(undefined));
  });
});

describe.each([
  ['plain world', false],
  ['real physics', true],
] as const)('spawner: "Thu hồi" (%s)', (_name, real) => {
  const world = (): World => {
    const w = real ? realWorld() : createWorld('3d');
    floor(w);
    return w;
  };

  it('takes back the named object it made: hidden at once, gone from the world after the tick, count one lower', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes' });
    const a = m.fire();
    const b = m.fire();
    expect(m.step().count).toBe(2);
    m.step({ recallThing: a, recall: false });
    const out = m.step({ recallThing: a, recall: true });
    expect(out.count).toBe(1);
    expect(w.getEntity(a)?.visible ?? false).toBe(false);
    w.step(TICK_DT);
    expect(w.getEntity(a)).toBeUndefined();
    expect(w.entities().some((e) => e.id === a)).toBe(false);
    expect(w.getEntity(b)!.visible).toBe(true);
    expect(m.step().count).toBe(1);
    w.dispose?.();
  });

  it('the freed place can be used again on the same tick', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes', maxAlive: 2 });
    const a = m.fire();
    m.fire();
    m.step({ spawn: true });
    expect(m.step().count).toBe(2);
    const out = m.step({ recallThing: a, recall: true, spawn: true });
    expect(out.spawned).toBe(true);
    expect(out.count).toBe(2);
    w.dispose?.();
  });

  it('leaves alone an object another card made, an object it never made, and no object at all', () => {
    const w = world();
    const mine = maker(w, { recallPorts: 'yes' }, 'mine');
    const other = maker(w, { recallPorts: 'yes', position: { x: 2, y: 0.3, z: 0 } }, 'other');
    const own = mine.fire();
    const foreign = other.fire();
    const loose = w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 4, y: 0.3, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, color: '#ffffff', solid: false });
    for (const thing of [foreign, loose, null, 'e9999']) {
      expect(mine.recall(thing).count, String(thing)).toBe(1);
    }
    for (const id of [own, foreign, loose]) expect(w.getEntity(id)?.visible, id).toBe(true);
    expect(other.step().count).toBe(1);
    // The card that made it does take it back.
    expect(other.recall(foreign).count).toBe(0);
    w.dispose?.();
  });

  it('acts once per press: holding "Thu hồi" on does not take back the next object named', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes' });
    const a = m.fire();
    const b = m.fire();
    m.step({ recallThing: a, recall: true });
    w.step(TICK_DT);
    for (let n = 0; n < 5; n++) {
      m.step({ recallThing: b, recall: true });
      w.step(TICK_DT);
    }
    expect(w.getEntity(b)?.visible).toBe(true);
    m.step({ recallThing: b, recall: false });
    expect(m.step({ recallThing: b, recall: true }).count).toBe(0);
    w.dispose?.();
  });

  it('an object that already ran out of time is not counted twice', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes', lifetime: 0.05 });
    const a = m.fire();
    for (let n = 0; n < 10; n++) {
      m.step();
      w.step(TICK_DT);
    }
    expect(w.getEntity(a)).toBeUndefined();
    expect(m.recall(a).count).toBe(0);
    w.dispose?.();
  });

  it('a zone stops counting the object on the very next tick', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes' });
    const a = m.fire();
    const b = m.fire();
    const zp = defaultParams(zoneSensorNode, { center: { x: 0, y: 0.3, z: 0 }, size: { x: 2, y: 2, z: 2 }, filter: 'item' });
    const zs = zoneSensorNode.create!(makeCtx(w, { nodeId: 'zone' }), zp);
    const zone = (): PortValues => zoneSensorNode.evaluate(makeCtx(w, { nodeId: 'zone' }), {}, zp, zs);
    for (let n = 0; n < 30; n++) w.step(TICK_DT);
    expect(zone().count).toBe(2);
    expect(zone().first).toBe(a);
    m.recall(a);
    const after = zone();
    expect(after.count).toBe(1);
    expect(after.first).toBe(b);
    m.recall(b);
    const empty = zone();
    expect([empty.count, empty.inside, empty.first, empty.exited]).toEqual([0, false, null, true]);
    w.dispose?.();
  });

  it('a carrier lets go of it: the character holds nothing afterwards', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes', carryable: 'yes', position: { x: 0.6, y: 0.3, z: 0 } });
    const a = m.fire();
    const who = w.spawn({ kind: 'character', ownerNodeId: 'who', position: { x: 0, y: 0.9, z: 0 }, size: { x: 0.8, y: 1.8, z: 0.8 }, color: '#ffffff', solid: true });
    for (let n = 0; n < 20; n++) w.step(TICK_DT);
    expect(w.grab(who, 2)).toBe(a);
    w.step(TICK_DT);
    expect(w.heldItem(who)).toBe(a);
    expect(w.isHeld(a)).toBe(true);
    m.recall(a);
    expect(w.heldItem(who)).toBeNull();
    expect(w.isHeld(a)).toBe(false);
    // The hands are free again: the next object can be picked up.
    const b = m.fire();
    for (let n = 0; n < 20; n++) w.step(TICK_DT);
    expect(w.grab(who, 2)).toBe(b);
    w.dispose?.();
  });

  it('cargo on a vehicle: the load count drops and the rest stays loaded', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes', carryable: 'yes', position: { x: 2.5, y: 0.3, z: 0 } });
    const truck = w.spawn({ kind: 'vehicle', ownerNodeId: 'truck', position: { x: 0, y: vehicleSize('truck').y / 2, z: 0 }, size: vehicleSize('truck'), color: '#ff0000', solid: true, vehicle: { model: 'truck', steerMode: 'direction', maxSpeed: 8, accel: 8 } });
    const cp = defaultParams(cargoNode, { capacity: 5, reach: 6 });
    const cs = cargoNode.create!(makeCtx(w, { nodeId: 'cargo' }), cp);
    let tick = 0;
    const cargo = (inputs: PortValues = {}): PortValues => {
      const out = cargoNode.evaluate(makeCtx(w, { tick: tick++, nodeId: 'cargo' }), { vehicle: truck, ...inputs }, cp, cs);
      w.step(TICK_DT);
      return out;
    };
    const made = [m.fire(), m.fire(), m.fire()];
    for (let n = 0; n < 20; n++) w.step(TICK_DT);
    for (let n = 0; n < 3; n++) {
      cargo({ load: true });
      cargo({});
    }
    expect(w.cargoOf(truck)).toHaveLength(3);
    const loaded = [...w.cargoOf(truck)];
    expect([...loaded].sort()).toEqual([...made].sort());
    m.recall(loaded[1]!);
    expect(w.cargoOf(truck)).toEqual([loaded[0], loaded[2]]);
    expect(cargo({}).count).toBe(2);
    expect(w.isHeld(loaded[1]!)).toBe(false);
    w.dispose?.();
  });

  it('contacts with the object end with it', () => {
    const w = world();
    const m = maker(w, { recallPorts: 'yes', position: { x: 0, y: 0.5, z: 0 } });
    const who = w.spawn({ kind: 'character', ownerNodeId: 'who', position: { x: 0, y: 0.9, z: 0 }, size: { x: 0.8, y: 1.8, z: 0.8 }, color: '#ffffff', solid: true });
    const a = m.fire();
    for (let n = 0; n < 5; n++) w.step(TICK_DT);
    expect(w.isTouching(who, a)).toBe(true);
    expect(m.step({ toucher: who }).touched).toBe(true);
    m.step({ recallThing: a, recall: false, toucher: who });
    const out = m.step({ recallThing: a, recall: true, toucher: who });
    expect(out.touched).toBe(false);
    expect(w.isTouching(who, a)).toBe(false);
    w.step(TICK_DT);
    expect(w.isTouching(who, a)).toBe(false);
    w.dispose?.();
  });
});
