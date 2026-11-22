import { beforeAll, describe, expect, it } from 'vitest';
import { instanceParams } from '../../src/circuits/instance';
import { runnableGraph } from '../../src/circuits/runnable';
import { validateCircuits } from '../../src/circuits/validate';
import { getNodeDef } from '../../src/engine/registry';
import { CIRCUIT_KIND, TICK_DT, type Board, type GraphNode, type ParamValue } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { CHUTE_WIRES, FACTORY, FACTORY_IDS } from '../../src/samples/sorting-factory-stations';
import { loadRapier } from '../../src/world/rapier-loader';
import { circuitOf, colourOfClass, cutInside, factoryBoard, start, type Link } from '../helpers/factory-run';

beforeAll(async () => {
  registerAllNodes();
  await loadRapier();
});

const node = (id: string, kind: string, params: Record<string, ParamValue> = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });

/** The colour this chute takes in the tests. */
const ACCEPTS = 2;

/**
 * Test-only board: one copy of "Cửa thả" and, standing in for the vehicles, a spawner that drops a carton of a random
 * class into it every `everyS` seconds; a carton lives `lifeS` seconds, so about `lifeS / everyS` sorted cartons stand on the
 * way out at a time. The circuits come from `from` (so a wire can be cut first).
 */
function chuteBoard(from: Board, accepts: number, everyS: number, lifeS = 12): Board {
  const classes: Record<string, ParamValue> = {};
  FACTORY.classColors.forEach((c, k) => (classes[`class${k + 1}Color`] = c));
  FACTORY.classMasses.forEach((m, k) => (classes[`class${k + 1}Mass`] = m));
  return {
    name: 'chute test',
    mode: '3d',
    circuits: from.circuits,
    graph: {
      nodes: [
        node('san', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 14, y: 1, z: 10 } }),
        node('bat-dau', 'on-start'),
        node('nhip', 'timer', { seconds: everyS, repeat: 'yes' }),
        node('tha', 'spawner', { template: 'item', shape: 'crate', position: { x: 0, y: 1.3, z: 0 }, size: { ...FACTORY.parcel }, maxAlive: 50, lifetime: lifeS, randomClass: 'yes', classCount: 6, classSeed: 11, ...classes }),
        { id: 'cua', kind: CIRCUIT_KIND, params: instanceParams(FACTORY_IDS.chute, { values: { 'so-cua': String(accepts), 'mau-nhan': accepts } }), pos: { x: 0, y: 0 } },
      ],
      wires: [
        { id: 'w1', from: { node: 'bat-dau', port: 'started' }, to: { node: 'nhip', port: 'run' } },
        { id: 'w2', from: { node: 'nhip', port: 'done' }, to: { node: 'tha', port: 'spawn' } },
      ],
      settings: { wireRule: true, realPhysics: true },
    },
  };
}

interface ChuteResult {
  /** Colour numbers of the cartons dropped, in order. */
  dropped: number[];
  count: number;
  wrong: number;
  /** Most cartons inside the chute at one moment, and how many are inside at the end. */
  maxInside: number;
  insideAtEnd: number;
  /** Most sorted cartons standing on the way out at one moment, and the highest any carton behind the chute ever was (m). */
  maxInLine: number;
  maxHeightBehind: number;
  /** Cartons that lay on the floor behind the chute at some moment (pushed off the way out). */
  offTheLine: number;
  msPerTick: number;
}

function runChute(board: Board, seconds: number): ChuteResult {
  expect(validateCircuits(board)).toEqual([]);
  const run = start(runnableGraph(board));
  const res: ChuteResult = { dropped: [], count: 0, wrong: 0, maxInside: 0, insideAtEnd: 0, maxInLine: 0, maxHeightBehind: 0, offTheLine: 0, msPerTick: 0 };
  const { side } = FACTORY.chute;
  const off = new Set<string>();
  const ticks = Math.round(seconds / TICK_DT);
  const t0 = performance.now();
  for (let i = 0; i < ticks; i++) {
    run.tick();
    if (run.rt.getOutput('tha', 'spawned') === true) res.dropped.push(colourOfClass(Number(run.rt.getOutput('tha', 'lastClass'))));
    res.insideAtEnd = Number(run.rt.getOutput('cua/vung', 'count'));
    res.maxInside = Math.max(res.maxInside, res.insideAtEnd);
    let inLine = 0;
    for (const e of run.items()) {
      if (e.position.z > -side / 2 - 0.1) continue;
      res.maxHeightBehind = Math.max(res.maxHeightBehind, e.position.y);
      if (e.position.y > out.topY) inLine++;
      else off.add(e.id);
    }
    res.maxInLine = Math.max(res.maxInLine, inLine);
  }
  res.offTheLine = off.size;
  res.msPerTick = (performance.now() - t0) / ticks;
  res.count = Number(run.rt.getOutput('cua/dem', 'value'));
  res.wrong = Number(run.rt.getOutput('cua/dem-sai', 'value'));
  run.dispose();
  return res;
}

const { out } = FACTORY.chute;

describe('circuit Cửa thả alone (Vật lý thật)', () => {
  it('is made of palette pieces only, has no read-out of its own, and its bench spawner is in no copy', () => {
    const c = circuitOf(factoryBoard(), FACTORY_IDS.chute);
    const kinds = new Set(c.graph.nodes.map((n) => n.kind));
    for (const k of kinds) expect(getNodeDef(k), k).toBeDefined();
    for (const banned of ['key', 'ui-button', 'show-number', 'show-text', 'camera', 'circuit']) expect(kinds.has(banned), banned).toBe(false);
    expect(c.graph.nodes.find((n) => n.id === 'cua')!.params.style).toBe('chute');
    expect(c.pins.map((p) => `${p.dir}:${p.label}:${p.type}`)).toEqual(['out:Số kiện:number', 'out:Kiện sai loại:number']);
    expect(c.exposed.map((e) => `${e.inner.node}.${e.inner.param}`)).toEqual(['cua.signText', 'mau-nhan.value', 'dua-di.position']);
    const flat = runnableGraph(chuteBoard(factoryBoard(), ACCEPTS, 1));
    for (const id of c.benchIds) expect(flat.nodes.some((n) => n.id === `cua/${id}`), id).toBe(false);
    expect(flat.nodes.find((n) => n.id === 'cua/cua')!.params.signText).toBe(String(ACCEPTS));
  });

  it('over 100 cartons: counts every one, flags exactly those of another colour, and never clogs', { timeout: 300_000 }, () => {
    const r = runChute(chuteBoard(factoryBoard(), ACCEPTS, 1), 106);
    console.log(`Cửa thả alone, 106 s: dropped ${r.dropped.length}, counted ${r.count}, wrong ${r.wrong}, most inside at once ${r.maxInside}, most in line ${r.maxInLine}, ${r.msPerTick.toFixed(2)} ms per tick`);
    expect(r.dropped.length).toBeGreaterThanOrEqual(100);
    expect(new Set(r.dropped).size).toBe(5);
    // The last carton may still be falling.
    const landed = r.dropped.slice(0, r.count);
    expect(r.count).toBeGreaterThanOrEqual(r.dropped.length - 1);
    expect(r.wrong).toBe(landed.filter((c) => c !== ACCEPTS).length);
    expect(r.wrong).toBeGreaterThan(50);
    expect(r.wrong).toBeLessThan(r.count);
    expect(r.maxInside).toBeLessThanOrEqual(1);
    // The sorted cartons stand in one line on the way out: none on top of another, none on the floor.
    expect(r.maxInLine).toBeGreaterThanOrEqual(10);
    expect(r.maxHeightBehind).toBeLessThan(out.topY + FACTORY.parcel.y);
    expect(r.offTheLine).toBe(0);
  });

  it('the way out holds 16 sorted cartons in one line', { timeout: 120_000 }, () => {
    const r = runChute(chuteBoard(factoryBoard(), ACCEPTS, 1, 16), 40);
    expect(r.maxInLine).toBe(16);
    expect(r.maxHeightBehind).toBeLessThan(out.topY + FACTORY.parcel.y);
    expect(r.offTheLine).toBe(0);
    expect(r.count).toBeGreaterThanOrEqual(r.dropped.length - 1);
  });

  it('two cartons a second for 30 s still all get counted (each lives 6 s, so the line stays within what the way out holds)', { timeout: 120_000 }, () => {
    const r = runChute(chuteBoard(factoryBoard(), ACCEPTS, 0.5, 6), 34);
    expect(r.dropped.length).toBeGreaterThanOrEqual(60);
    expect(r.count).toBeGreaterThanOrEqual(r.dropped.length - 2);
    expect(r.wrong).toBe(r.dropped.slice(0, r.count).filter((c) => c !== ACCEPTS).length);
    expect(r.maxInside).toBeLessThanOrEqual(2);
    expect(r.offTheLine).toBe(0);
  });

  it('a chute that takes every colour (0) flags none', { timeout: 120_000 }, () => {
    const r = runChute(chuteBoard(factoryBoard(), 0, 1), 30);
    expect(r.count).toBeGreaterThanOrEqual(27);
    expect(r.wrong).toBe(0);
  });

  it('is anti-forced: every inner wire is needed; cut one and the chute fails in the way that wire explains', { timeout: 600_000 }, () => {
    const SECONDS = 30;
    const groups: { name: string; wires: Link[]; check: (r: ChuteResult, label: string) => void }[] = [
      {
        name: 'nothing is moved out: the chute fills up and counts nothing',
        wires: [
          ['vung.inside', 'nhip-gom.run'],
          ['vung.first', 'dua-di.who'],
          ['nhip-gom.done', 'dua-di.go'],
        ],
        check: (r, l) => {
          expect(r.count, l).toBe(0);
          expect(r.wrong, l).toBe(0);
          expect(r.maxInside, l).toBeGreaterThanOrEqual(3);
          expect(r.insideAtEnd, l).toBeGreaterThanOrEqual(1);
        },
      },
      {
        name: 'the way out stands still: the sorted cartons stack up where they are put, fall, and some are counted twice',
        wires: [['bat-dau.started', 'bang-ra.run']],
        check: (r, l) => {
          expect(r.maxHeightBehind, l).toBeGreaterThan(1.5);
          expect(r.offTheLine, l).toBeGreaterThanOrEqual(1);
        },
      },
      {
        name: 'cartons are moved out but "Số kiện" stays 0',
        wires: [['dua-di.done', 'dem.up']],
        check: (r, l) => {
          expect(r.count, l).toBe(0);
          expect(r.wrong, l).toBeGreaterThan(10);
          expect(r.maxInside, l).toBeLessThanOrEqual(1);
        },
      },
      {
        name: 'every carton is flagged as wrong, the right colour too',
        wires: [
          ['vung.first', 'doc-mau.thing'],
          ['doc-mau.index', 'khac-mau.a'],
          ['mau-nhan.value', 'khac-mau.b'],
        ],
        check: (r, l) => {
          expect(r.count, l).toBeGreaterThanOrEqual(27);
          expect(r.wrong, l).toBe(r.count);
        },
      },
      {
        name: 'no carton is ever flagged',
        wires: [
          ['mau-nhan.value', 'ken-mau.a'],
          ['khac-mau.out', 'sai-mau.a'],
          ['ken-mau.out', 'sai-mau.b'],
          ['sai-mau.out', 'sai-luc-gom.a'],
          ['dua-di.done', 'sai-luc-gom.b'],
          ['sai-luc-gom.out', 'dem-sai.up'],
        ],
        check: (r, l) => {
          expect(r.count, l).toBeGreaterThanOrEqual(27);
          expect(r.wrong, l).toBe(0);
        },
      },
    ];
    const base = runChute(chuteBoard(factoryBoard(), ACCEPTS, 1), SECONDS);
    expect(base.count).toBeGreaterThanOrEqual(27);
    expect(base.wrong).toBeGreaterThan(10);
    expect(base.wrong).toBeLessThan(base.count);
    expect(base.maxHeightBehind).toBeLessThan(out.topY + FACTORY.parcel.y);
    expect(base.offTheLine).toBe(0);
    const listed = groups.flatMap((g) => g.wires.map((w) => w.join('>')));
    expect([...listed].sort()).toEqual(CHUTE_WIRES.map((w) => w.join('>')).sort());
    for (const g of groups) {
      for (const w of g.wires) g.check(runChute(chuteBoard(cutInside(factoryBoard(), FACTORY_IDS.chute, w), ACCEPTS, 1), SECONDS), `${g.name}: ${w.join(' -> ')}`);
    }
  });
});
