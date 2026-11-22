import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityId, EntitySpec, Params, PortValues, World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { CODE_DISPLAY_SIZE, codeReaderNode } from '../../src/nodes/code-reader';
import { colorSensorNode } from '../../src/nodes/color-sensor';
import { FACTORY } from '../../src/samples/sorting-factory-stations';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { defaultParams, makeCtx } from './fake-world';

registerAllNodes();

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const item = (tag?: string, extra: Partial<EntitySpec> = {}): EntitySpec => ({
  kind: 'item',
  ownerNodeId: 'i',
  position: { x: 0, y: 0.3, z: 0 },
  size: { x: 0.3, y: 0.3, z: 0.3 },
  color: '#ef4444',
  solid: false,
  shape: 'crate',
  ...(tag !== undefined ? { tag } : {}),
  ...extra,
});

/** A reader card played by hand. */
function reader(w: World, over: Params = {}) {
  const params = defaultParams(codeReaderNode, over);
  const state = codeReaderNode.create!(makeCtx(w, { nodeId: 'reader' }), params);
  const read = (thing: EntityId | null | undefined): PortValues => codeReaderNode.evaluate(makeCtx(w, { nodeId: 'reader' }), thing === undefined ? {} : { thing }, params, state);
  const displays = () => w.entities().filter((e) => e.blockStyle === 'code-display' && e.visible);
  return { read, displays };
}

describe('code reader: the card', () => {
  it('is a Logic card named "Đọc mã" with one object input and the two outputs', () => {
    expect([codeReaderNode.kind, codeReaderNode.label, codeReaderNode.labelEn, codeReaderNode.category]).toEqual(['code-reader', 'Đọc mã', 'Code Reader', 'logic']);
    expect(codeReaderNode.category).toBe(colorSensorNode.category);
    expect(codeReaderNode.inputs.map((p) => [p.id, p.type, p.label])).toEqual([['thing', 'object', 'Vật cần đọc']]);
    expect(codeReaderNode.outputs.map((p) => [p.id, p.type, p.label])).toEqual([
      ['code', 'number', 'Mã'],
      ['has', 'bool', 'Có mã'],
    ]);
    // The same input name and id as on "Đọc màu".
    expect(colorSensorNode.inputs.find((p) => p.id === 'thing')!.label).toBe('Vật cần đọc');
  });

  it('the display is off unless asked for, and its place only shows when it is on', () => {
    expect(codeReaderNode.params.map((p) => p.id)).toEqual(['display', 'displayAt']);
    expect(codeReaderNode.params[0]).toMatchObject({ default: 'no' });
    expect(codeReaderNode.params[1]!.shownWhen?.(defaultParams(codeReaderNode))).toBe(false);
    expect(codeReaderNode.params[1]!.shownWhen?.(defaultParams(codeReaderNode, { display: 'yes' }))).toBe(true);
  });
});

describe.each([
  ['plain world', false],
  ['real physics', true],
] as const)('code reader: reading (%s)', (_name, real) => {
  const world = (): World => createWorld('3d', real ? { realPhysics: true, rapier } : undefined);

  it('gives the code of the wired object and switches "Có mã" on', () => {
    const w = world();
    const r = reader(w);
    expect(r.read(w.spawn(item('7')))).toEqual({ code: 7, has: true });
    expect(r.read(w.spawn(item('99')))).toEqual({ code: 99, has: true });
    expect(r.read(w.spawn(item('1')))).toEqual({ code: 1, has: true });
    w.dispose?.();
  });

  it('gives 0 and "Có mã" off for no wire, no object, an object without a code, a goods type that is not a code, and a hidden object', () => {
    const w = world();
    const r = reader(w);
    const none = { code: 0, has: false };
    expect(r.read(undefined)).toEqual(none);
    expect(r.read(null)).toEqual(none);
    expect(r.read('e999')).toEqual(none);
    expect(r.read(w.spawn(item()))).toEqual(none);
    for (const tag of ['rau', '0', '100', '3.5', '-2']) expect(r.read(w.spawn(item(tag))), tag).toEqual(none);
    const gone = w.spawn(item('5'));
    expect(r.read(gone).code).toBe(5);
    w.hide(gone);
    expect(r.read(gone)).toEqual(none);
    // A block or a character has no goods type.
    expect(r.read(w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 3, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#ffffff', solid: true }))).toEqual(none);
    w.dispose?.();
  });

  it('adds nothing to the world unless the display is on', () => {
    const w = world();
    const before = w.entities().length;
    const r = reader(w);
    r.read(w.spawn(item('7')));
    expect(w.entities().length).toBe(before + 1);
    expect(r.displays()).toHaveLength(0);
    w.dispose?.();
  });

  it('the display starts empty, shows the code just read and keeps it until the next object is read', () => {
    const w = world();
    const at = { x: 1, y: 2, z: 3 };
    const r = reader(w, { display: 'yes', displayAt: at });
    const step = (): void => w.step(1 / 60);
    expect(r.displays().map((d) => [d.label, d.position, d.size])).toEqual([[undefined, at, { ...CODE_DISPLAY_SIZE }]]);
    const a = w.spawn(item('3'));
    const b = w.spawn(item('8', { position: { x: 1, y: 0.3, z: 0 } }));
    const plain = w.spawn(item(undefined, { position: { x: 2, y: 0.3, z: 0 } }));
    r.read(a);
    step();
    expect(r.displays().map((d) => d.label)).toEqual(['3']);
    const shown = r.displays()[0]!.id;
    // Still the same screen while the same object is read, after it left, and while an object without a code passes.
    for (const thing of [a, a, null, null, plain, null]) {
      r.read(thing);
      step();
      expect(r.displays().map((d) => [d.id, d.label])).toEqual([[shown, '3']]);
    }
    r.read(b);
    step();
    expect(r.displays().map((d) => d.label)).toEqual(['8']);
    expect(r.displays()[0]!.position).toEqual(at);
    // The same object coming back after a gap is a new read: a fresh screen (it lights up again).
    const second = r.displays()[0]!.id;
    r.read(null);
    r.read(b);
    step();
    expect(r.displays().map((d) => d.label)).toEqual(['8']);
    expect(r.displays()[0]!.id).not.toBe(second);
    // Never more than one screen, and old screens leave the world.
    expect(w.entities().filter((e) => e.blockStyle === 'code-display')).toHaveLength(1);
    expect(r.displays()[0]!.id).not.toBe(shown);
    w.dispose?.();
  });
});

/**
 * A scan gate as a learner wires it: cartons with a code ride a belt (the belt of the sorting sample: 0.5 m/s) through a
 * small zone; the zone's first object goes to the reader. A second zone at the end has each carton taken back.
 */
function gateLine(feedEveryS: number, over: { cut?: string } = {}) {
  const { belt, parcel } = FACTORY;
  const restY = belt.topY + parcel.y / 2;
  const mid = belt.fromX + belt.length / 2;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 20 } }],
    ['belt', 'block', { position: { x: mid, y: belt.topY / 2, z: 0 }, size: { x: belt.length, y: belt.topY, z: belt.width }, style: 'belt-frame', beltSpeed: belt.speed, beltDir: '-x', beltWalls: 'no' }],
    ['start', 'on-start'],
    ['beat', 'timer', { seconds: feedEveryS, repeat: 'yes' }],
    ['dice', 'random', { min: 1, max: 9, seed: 11 }],
    ['maker', 'spawner', { template: 'item', shape: 'crate', look: 'parcel-carton', position: { x: belt.fromX + belt.length - 0.25, y: restY + 0.02, z: 0 }, size: { ...parcel }, maxAlive: 12, lifetime: 0, mass: 1, wireCode: 'yes', recallPorts: 'yes' }],
    ['at-gate', 'zone', { center: { x: FACTORY.gateX, y: restY, z: 0 }, size: { x: 0.3, y: 0.3, z: belt.width }, filter: 'item', rule: 'center' }],
    ['reader', 'code-reader', { display: 'yes', displayAt: { x: FACTORY.gateX, y: 1.3, z: 0.3 } }],
    ['at-end', 'zone', { center: { x: belt.fromX + 0.3, y: restY, z: 0 }, size: { x: 0.3, y: 0.3, z: belt.width }, filter: 'item', rule: 'center' }],
  ];
  const wires: WireSpec[] = (
    [
      ['start', 'started', 'belt', 'run'],
      ['start', 'started', 'beat', 'run'],
      ['beat', 'done', 'dice', 'roll'],
      ['beat', 'done', 'maker', 'spawn'],
      ['dice', 'value', 'maker', 'code'],
      ['at-gate', 'first', 'reader', 'thing'],
      ['at-end', 'first', 'maker', 'recallThing'],
      ['at-end', 'entered', 'maker', 'recall'],
    ] as WireSpec[]
  ).filter((w) => `${w[0]}.${w[1]}>${w[2]}.${w[3]}` !== over.cut);
  const r = rig(nodes, wires, '3d', false, true, rapier);
  const made: { id: string; code: number }[] = [];
  const reads: { id: string; code: number }[] = [];
  const shown: string[] = [];
  let reading: string | null = null;
  let maxAlive = 0;
  const run = (seconds: number): void => {
    for (let n = 0; n < Math.round(seconds * 60); n++) {
      r.tick();
      if (r.out('maker', 'spawned') === true) {
        const id = String(r.out('maker', 'lastSpawned'));
        made.push({ id, code: Number(r.world.tagOf(id)) });
      }
      const has = r.out('reader', 'has') === true;
      const first = r.out('at-gate', 'first') as string | null;
      if (has && first !== reading) {
        reads.push({ id: first!, code: Number(r.out('reader', 'code')) });
        const screens = r.world.entities().filter((e) => e.blockStyle === 'code-display' && e.visible);
        shown.push(screens.map((s) => s.label).join('+'));
      }
      reading = has ? first : null;
      maxAlive = Math.max(maxAlive, Number(r.out('maker', 'count')));
    }
  };
  return { r, made, reads, shown, run, alive: () => maxAlive };
}

describe('code reader as a scan gate on a belt (real physics, belt speed of the sorting sample)', () => {
  it.each([1, 0.8])('feeding every %s s: more than 30 cartons are read in the order they were made, none missed, none read twice', { timeout: 120_000 }, (feedEveryS) => {
    const line = gateLine(feedEveryS);
    line.run(45);
    expect(line.reads.length).toBeGreaterThan(30);
    // Every carton made, except the last few still on their way to the gate, was read once and in order.
    expect(line.made.length - line.reads.length).toBeLessThanOrEqual(3);
    expect(line.reads).toEqual(line.made.slice(0, line.reads.length));
    expect(new Set(line.reads.map((x) => x.id)).size).toBe(line.reads.length);
    // The codes are real: 1 to 9, and not all the same.
    for (const x of line.reads) expect(x.code >= 1 && x.code <= 9, String(x.code)).toBe(true);
    expect(new Set(line.reads.map((x) => x.code)).size).toBeGreaterThan(5);
    // The display showed each code as it was read.
    expect(line.shown).toEqual(line.reads.map((x) => String(x.code)));
    // The end zone had every carton taken back, so the belt never filled up.
    expect(line.alive()).toBeLessThan(12);
    line.r.world.dispose?.();
  });

  it('with the code wire cut the cartons carry no code: the reader says 0 and the display stays empty', { timeout: 60_000 }, () => {
    const line = gateLine(1, { cut: 'dice.value>maker.code' });
    line.run(15);
    expect(line.made.length).toBeGreaterThan(10);
    expect(line.reads).toEqual([]);
    expect(line.r.world.entities().filter((e) => e.blockStyle === 'code-display').map((e) => e.label)).toEqual([undefined]);
    line.r.world.dispose?.();
  });

  it('with the recall wire cut the cartons stay: the count reaches "Số lượng tối đa" and no more are made', { timeout: 60_000 }, () => {
    const line = gateLine(1, { cut: 'at-end.entered>maker.recall' });
    line.run(30);
    expect(line.alive()).toBe(12);
    expect(line.made.length).toBe(12);
    line.r.world.dispose?.();
  });
});
