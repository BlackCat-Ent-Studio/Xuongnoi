import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { addWire } from '../../src/engine/wiring';
import type { EntityId, EntitySpec, Graph, GraphNode, Params, PortValues, Vec3, World } from '../../src/engine/types';
import { TICK_DT } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { colorSensorNode } from '../../src/nodes/color-sensor';
import { spawnerNode } from '../../src/nodes/spawner';
import { zoneSensorNode } from '../../src/nodes/zone-sensor';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx } from './fake-world';

registerAllNodes();

const RED = '#ef4444';
const YELLOW = '#facc15';
const GREEN = '#22c55e';
const BLUE = '#3b82f6';
const PURPLE = '#a855f7';
const ORANGE = '#f97316';
const SIX = [RED, YELLOW, GREEN, BLUE, PURPLE, ORANGE];

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const v = (x: number, y = 0, z = 0): Vec3 => ({ x, y, z });
const block = (position: Vec3, size: Vec3, color: string): EntitySpec => ({ kind: 'block', ownerNodeId: 'b', position, size, color, solid: true });
const item = (position: Vec3, color: string): EntitySpec => ({ kind: 'item', ownerNodeId: 'i', position, size: v(0.5, 0.5, 0.5), color, solid: false, shape: 'crate' });
const person = (position: Vec3, color = '#ffffff'): EntitySpec => ({ kind: 'character', ownerNodeId: 'n', position, size: v(0.8, 1.8, 0.8), color, solid: true });

const read = (w: World, inputs: PortValues, over: Params = {}): PortValues => colorSensorNode.evaluate(makeCtx(w), inputs, defaultParams(colorSensorNode, over), undefined);

describe('colour sensor: the card', () => {
  it('knows six colours, the same list the spawner gives its classes', () => {
    const colours = colorSensorNode.params.filter((p) => /^color\d$/.test(p.id));
    expect(colours.map((p) => [p.id, p.label, p.default, p.advanced])).toEqual(SIX.map((c, k) => [`color${k + 1}`, `Màu ${k + 1}`, c, true]));
    expect(spawnerNode.params.filter((p) => /^class\dColor$/.test(p.id)).map((p) => p.default)).toEqual(colours.map((p) => p.default));
    expect(colorSensorNode.params.find((p) => p.id === 'want')).toMatchObject({ min: 1, max: 6, default: 1 });
  });

  it('has the two object inputs, neither forced, and the same outputs as before', () => {
    expect(colorSensorNode.inputs.map((p) => [p.id, p.type, p.label, p.required ?? false])).toEqual([
      ['who', 'object', 'Đối tượng', false],
      ['thing', 'object', 'Vật cần đọc', false],
    ]);
    expect(colorSensorNode.outputs.map((p) => p.id)).toEqual(['index', 'match']);
    expect(colorSensorNode.params.find((p) => p.id === 'where')!.options!.map((o) => o.value)).toEqual(['feet', 'ahead']);
  });
});

describe.each([
  ['plain world', false],
  ['real physics (rigid crates)', true],
] as const)('colour sensor reads what the spawner makes: %s', (_name, real) => {
  function line(template: 'item' | 'block') {
    const w = createWorld('3d', real ? { realPhysics: true, rapier } : undefined);
    w.spawn(block(v(0, -0.5, 0), v(12, 1, 12), '#777777'));
    const params = defaultParams(spawnerNode, { template, shape: 'crate', randomClass: 'yes', classCount: 6, classSeed: 9, position: v(0, 0.4, 0), size: v(0.5, 0.5, 0.5), lifetime: 0.1, maxAlive: 50 });
    const state = spawnerNode.create!(makeCtx(w, { nodeId: 'maker' }), params);
    const gate = defaultParams(zoneSensorNode, { center: v(0, 0.5, 0), size: v(2, 2, 2), filter: 'item' });
    const gateState = zoneSensorNode.create!(makeCtx(w, { nodeId: 'gate' }), gate);
    let tick = 0;
    /** One new object, read on the tick it is made; then it is left to run out before the next one. */
    const next = () => {
      spawnerNode.evaluate(makeCtx(w, { tick: tick++, nodeId: 'maker' }), { spawn: false }, params, state);
      const made = spawnerNode.evaluate(makeCtx(w, { tick: tick++, nodeId: 'maker' }), { spawn: true }, params, state);
      const id = made.lastSpawned as EntityId;
      const first = zoneSensorNode.evaluate(makeCtx(w, { tick, nodeId: 'gate' }), {}, gate, gateState).first as EntityId | null;
      const out = { id, cls: made.lastClass as number, rigid: w.isRigidCrate(id), byName: read(w, { thing: id }).index as number, byGate: read(w, { thing: first }).index as number };
      for (let n = 0; n < 12; n++) {
        w.step(TICK_DT);
        spawnerNode.evaluate(makeCtx(w, { tick: tick++, nodeId: 'maker' }), { spawn: false }, params, state);
      }
      return out;
    };
    return { w, next };
  }

  it('Đồ vật: "Chỉ số màu" equals "Loại vừa sinh" for every one of six classes', () => {
    const { w, next } = line('item');
    const seen = new Set<number>();
    for (let n = 0; n < 60; n++) {
      const r = next();
      expect(r.cls).toBeGreaterThanOrEqual(1);
      expect(r.rigid).toBe(real);
      expect(r.byName, `object ${n}`).toBe(r.cls);
      expect(r.byGate, `object ${n} through the zone`).toBe(r.cls);
      // Once it has run out there is nothing left to read.
      expect(read(w, { thing: r.id }).index).toBe(0);
      seen.add(r.cls);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('Vật thể: a spawned block is read by name too', () => {
    const { next } = line('block');
    const seen = new Set<number>();
    for (let n = 0; n < 60; n++) {
      const r = next();
      expect(r.byName, `object ${n}`).toBe(r.cls);
      seen.add(r.cls);
    }
    expect(seen.size).toBe(6);
  });
});

describe('colour sensor: "Vật cần đọc"', () => {
  it('reads the wired thing itself, whatever its kind', () => {
    const w = createWorld('3d');
    expect(read(w, { thing: w.spawn(item(v(0, 1), BLUE)) })).toEqual({ index: 4, match: false });
    expect(read(w, { thing: w.spawn(block(v(3, 1), v(1, 1, 1), ORANGE)) }).index).toBe(6);
    expect(read(w, { thing: w.spawn(person(v(6, 1), PURPLE)) }).index).toBe(5);
    expect(read(w, { thing: w.spawn({ ...block(v(9, 1), v(1, 1, 1), YELLOW), solid: false }) }).index).toBe(2);
  });

  it('a thing in an unknown colour, a hidden thing, a missing thing and nothing wired all read 0', () => {
    const w = createWorld('3d');
    const odd = w.spawn(item(v(0, 1), '#123456'));
    expect(read(w, { thing: odd })).toEqual({ index: 0, match: false });
    const gone = w.spawn(item(v(2, 1), RED));
    expect(read(w, { thing: gone }).index).toBe(1);
    w.hide(gone);
    expect(read(w, { thing: gone })).toEqual({ index: 0, match: false });
    expect(read(w, { thing: 'ghost' })).toEqual({ index: 0, match: false });
    expect(read(w, { thing: null })).toEqual({ index: 0, match: false });
    expect(read(w, {})).toEqual({ index: 0, match: false });
  });

  it('follows a repaint, ignores letter case, and uses the palette of the card', () => {
    const w = createWorld('3d');
    const crate = w.spawn(item(v(0, 1), '#123456'));
    expect(read(w, { thing: crate }, { color5: '#123456' }).index).toBe(5);
    w.setEntityStyle(crate, { color: '#F97316' });
    expect(read(w, { thing: crate }).index).toBe(6);
    // The lowest matching number wins when two palette entries hold the same colour.
    expect(read(w, { thing: crate }, { color2: ORANGE }).index).toBe(2);
  });

  it('wins over "Đối tượng" while it holds a thing, and hands back to it when it does not', () => {
    const w = createWorld('2d-side');
    w.spawn(block(v(0, 0), v(4, 1, 1), RED));
    const who = w.spawn(person(v(0, 1.4)));
    const crate = w.spawn(item(v(1, 1), PURPLE));
    expect(read(w, { who }).index).toBe(1);
    expect(read(w, { who, thing: crate }).index).toBe(5);
    expect(read(w, { who, thing: null }).index).toBe(1);
    w.hide(crate);
    expect(read(w, { who, thing: crate }).index).toBe(1);
  });
});

describe('colour sensor: "Đúng màu"', () => {
  it('works for the wanted colours 4, 5 and 6', () => {
    const w = createWorld('3d');
    const things = SIX.map((c, k) => w.spawn(item(v(k * 2, 1), c)));
    for (let want = 1; want <= 6; want++) {
      expect(things.map((thing) => read(w, { thing }, { want }).match)).toEqual(SIX.map((_, k) => k + 1 === want));
    }
  });

  it('keeps the wanted number within 1..6 and never matches when nothing is read', () => {
    const w = createWorld('3d');
    const orange = w.spawn(item(v(0, 1), ORANGE));
    expect(read(w, { thing: orange }, { want: 9 })).toEqual({ index: 6, match: true });
    expect(read(w, { thing: w.spawn(item(v(2, 1), RED)) }, { want: 0 })).toEqual({ index: 1, match: true });
    expect(read(w, { thing: w.spawn(item(v(4, 1), '#000000')) }, { want: 6 })).toEqual({ index: 0, match: false });
  });
});

describe('colour sensor: a scan gate built from a zone', () => {
  type W = readonly [string, string, string, string];
  const node = (id: string, kind: string, params: Params = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });
  function wired(nodes: GraphNode[], wires: readonly W[]): Graph {
    let g: Graph = { nodes, wires: [] };
    for (const [fn, fp, tn, tp] of wires) {
      const res = addWire(g, { node: fn, port: fp }, { node: tn, port: tp });
      if ('ok' in res) throw new Error(`cannot wire ${fn}.${fp} -> ${tn}.${tp}: ${res.reason}`);
      g = res;
    }
    return g;
  }
  const crate = (id: string, x: number, color: string): GraphNode => node(id, 'item', { position: v(x, 0.3, 0), size: v(0.5, 0.5, 0.5), shape: 'crate', color });
  const FLOOR = node('floor', 'block', { position: v(0, -0.5, 0), size: v(30, 1, 6), type: 'solid', color: BLUE });

  function gate(crates: GraphNode[]) {
    const graph = wired(
      [FLOOR, ...crates, node('gate', 'zone', { center: v(0, 0.5, 0), size: v(2, 2, 2), filter: 'item' }), node('eye', 'color-sensor', { want: 5 })],
      [['gate', 'first', 'eye', 'thing']],
    );
    const world = createWorld('3d');
    const rt = createRuntime(graph, world, '3d');
    const tick = (): { index: number; match: boolean; first: EntityId | null } => {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
      return { index: rt.getOutput('eye', 'index') as number, match: rt.getOutput('eye', 'match') as boolean, first: rt.getOutput('gate', 'first') as EntityId | null };
    };
    const idOf = (nodeId: string): EntityId => world.entities().find((e) => e.ownerNodeId === nodeId && e.kind === 'item')!.id;
    return { world, tick, idOf };
  }

  it('reads the crate inside the zone, in the same tick the zone sees it, and never the floor or the zone box', () => {
    const { world, tick, idOf } = gate([crate('a', 0, PURPLE), crate('far', 8, RED)]);
    // The floor under the zone is blue (Màu 4): it is not what the gate reads.
    expect(tick()).toEqual({ index: 5, match: true, first: idOf('a') });
    world.hide(idOf('a'));
    expect(tick()).toEqual({ index: 0, match: false, first: null });
  });

  it('with two crates in the zone it reads the one that was made first, then the other once the first has left', () => {
    const { world, tick, idOf } = gate([crate('first', 0.6, ORANGE), crate('second', -0.1, GREEN)]);
    expect(tick()).toMatchObject({ index: 6, first: idOf('first') });
    world.teleport(idOf('first'), v(9, 0.3, 0), false);
    expect(tick()).toMatchObject({ index: 3, first: idOf('second') });
    world.teleport(idOf('second'), v(-9, 0.3, 0), false);
    expect(tick()).toMatchObject({ index: 0, match: false, first: null });
  });
});

describe('colour sensor: a board made before the upgrade', () => {
  const OLD_PARAMS: Params = { where: 'feet', want: 1, reach: 1.5, color1: RED, color2: YELLOW, color3: GREEN };

  function floorWorld() {
    const w = createWorld('2d-side');
    w.spawn(block(v(0, 0), v(4, 1, 1), RED));
    w.spawn(block(v(4, 0), v(4, 1, 1), GREEN));
    w.spawn(block(v(8, 0), v(4, 1, 1), '#123456'));
    return w;
  }
  /** The sensor as the runtime runs a saved card: the saved settings over the defaults, and no wire on the new input. */
  const old = (w: World, who: EntityId | null, over: Params = {}): PortValues => colorSensorNode.evaluate(makeCtx(w), who === null ? {} : { who }, { ...defaultParams(colorSensorNode), ...OLD_PARAMS, ...over }, undefined);
  const stand = (w: World, x: number): EntityId => w.spawn(person(v(x, 1.4)));

  it('reads the floor under the feet exactly as it did', () => {
    const w = floorWorld();
    expect(old(w, stand(w, 0))).toEqual({ index: 1, match: true });
    expect(old(w, stand(w, 4))).toEqual({ index: 3, match: false });
    expect(old(w, stand(w, 4), { want: 3 })).toEqual({ index: 3, match: true });
    expect(old(w, stand(w, 8))).toEqual({ index: 0, match: false });
    expect(old(w, stand(w, 30))).toEqual({ index: 0, match: false });
    expect(old(w, null)).toEqual({ index: 0, match: false });
  });

  it('still looks only at blocks from "Đối tượng": an item under the feet or ahead is not read', () => {
    const w = createWorld('2d-side');
    w.spawn(block(v(0, 0), v(8, 1, 1), '#777777'));
    const who = w.spawn(person(v(0, 1.4)));
    w.spawn(item(v(0, 0.75), RED));
    w.spawn(item(v(1.2, 1), YELLOW));
    expect(old(w, who)).toEqual({ index: 0, match: false });
    expect(old(w, who, { where: 'ahead', reach: 3 })).toEqual({ index: 0, match: false });
    w.spawn(block(v(2, 1.5), v(1, 2, 1), YELLOW));
    expect(old(w, who, { where: 'ahead', reach: 3 })).toEqual({ index: 2, match: false });
  });

  it('a palette where Màu 2 was set to blue keeps reading blue as 2', () => {
    const w = createWorld('2d-side');
    w.spawn(block(v(0, 0), v(4, 1, 1), BLUE));
    expect(old(w, stand(w, 0), { color2: BLUE, want: 2 })).toEqual({ index: 2, match: true });
  });
});
