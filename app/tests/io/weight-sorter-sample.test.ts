import { beforeAll, describe, expect, it } from 'vitest';
import { listSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { WEIGHT_SORTER, WEIGHT_SORTER_WIRES } from '../../src/samples/weight-sorter-board';
import type { Board } from '../../src/engine/types';
import { firstCardOverlap, without } from '../helpers/cell-run';
import { loadEngine, playReal as play } from '../helpers/cell-run-real';

beforeAll(async () => {
  registerAllNodes();
  await loadEngine();
});

const sample = (): Board => structuredClone(listSamples().find((s) => s.id === 'weight-sorter')!.board);

const KEYS_OR_BUTTONS = new Set(['key', 'stick', 'ui-button', 'ui-start', 'ui-pick', 'ui-dialog']);
/** Long enough for 30 crates to be made and sorted (the machine must keep going, not only start well). */
const RUN_S = 120;
/** A crate lives 30 s; by this age it must have reached its bin and stay put. */
const SETTLED_AGE_S = 22;

type Bin = 'side' | 'end' | 'elsewhere';

interface Crate {
  massKg: number;
  /** Where the crate was last seen (it vanishes some time after it was made). */
  bin: Bin;
  /** Second the crate was made. */
  bornS: number;
  /** Where it was when it was SETTLED_AGE_S old (null while younger / gone). */
  binAtSettled: Bin | null;
  /** The crate lay on the floor beside a pad at some moment (fell out of a bin). */
  onFloor: boolean;
  /** Highest it stood after settling: a crate left on the belt would be at 1.0 m or more. */
  settledTopY: number;
}

interface Result {
  crates: Crate[];
  /** Crates last seen in each bin (sorted there). */
  sideTotal: number;
  endTotal: number;
  /** The two "Trong thùng" readouts at the end, and the crates really lying in each bin then. */
  shownSide: number;
  shownEnd: number;
  nowSide: number;
  nowEnd: number;
  overloaded: boolean;
  peakForce: number;
  /** What the scale card read each tick (kg). */
  scaleReads: number[];
}

const binOf = (p: { x: number; z: number }): Bin => {
  if (p.z > 5 && p.x > 0 && p.x < 4) return 'side';
  if (p.x > 8 && Math.abs(p.z) < 1) return 'end';
  return 'elsewhere';
};

/** Plays the board and follows every crate the spawner makes: its mass and the last place it was seen. */
function sort(board: Board, seconds = RUN_S): Result {
  const p = play(board);
  const seen = new Map<string, Crate>();
  let overloaded = false;
  let peakForce = 0;
  const scaleReads: number[] = [];
  p.watch(seconds, (t) => {
    if (p.out('piston', 'overloaded') === true) overloaded = true;
    peakForce = Math.max(peakForce, p.out('piston', 'force') as number);
    scaleReads.push(p.out('weigh', 'mass') as number);
    for (const e of p.world.entities()) {
      if (e.ownerNodeId !== 'maker') continue;
      const known = seen.get(e.id) ?? { massKg: p.world.materialOf(e.id)!.massKg, bin: 'elsewhere' as Bin, bornS: t, binAtSettled: null, onFloor: false, settledTopY: 0 };
      known.bin = binOf(e.position);
      if (t - known.bornS >= SETTLED_AGE_S) {
        known.binAtSettled = known.bin;
        known.settledTopY = Math.max(known.settledTopY, e.position.y);
      }
      if (e.position.y < 0.45) known.onFloor = true;
      seen.set(e.id, known);
    }
  });
  const crates = [...seen.values()];
  const live = p.world.entities().filter((e) => e.ownerNodeId === 'maker').map((e) => binOf(e.position));
  return {
    crates,
    sideTotal: crates.filter((c) => c.bin === 'side').length,
    endTotal: crates.filter((c) => c.bin === 'end').length,
    shownSide: p.out('side-bin', 'count') as number,
    shownEnd: p.out('end-bin', 'count') as number,
    nowSide: live.filter((b) => b === 'side').length,
    nowEnd: live.filter((b) => b === 'end').length,
    overloaded,
    peakForce,
    scaleReads,
  };
}

const isHeavy = (c: Crate): boolean => c.massKg >= WEIGHT_SORTER.thresholdKg;
/** Crates that reached a bin (the last ones are still on the belt when the run stops). */
const arrived = (r: Result): Crate[] => r.crates.filter((c) => c.bin !== 'elsewhere');

describe('sample Băng chuyền phân loại theo cân nặng', () => {
  it('is an automated 3D machine of palette pieces: no keys or buttons, a floor, a camera, readouts, notes', () => {
    const b = sample();
    expect(b.mode).toBe('3d');
    for (const n of b.graph.nodes) expect(KEYS_OR_BUTTONS.has(n.kind), n.kind).toBe(false);
    const kinds = new Set(b.graph.nodes.map((n) => n.kind));
    for (const k of ['camera', 'force-sensor', 'compare', 'linear-actuator', 'timer', 'latch', 'zone', 'spawner', 'random', 'show-number']) expect(kinds.has(k), k).toBe(true);
    expect(b.graph.nodes.find((n) => n.id === 'floor')?.kind).toBe('block');
    // The crates are made while it runs, none is placed by hand.
    expect(b.graph.nodes.filter((n) => n.kind === 'item').length).toBe(0);
    expect((b.notes ?? []).length).toBeGreaterThanOrEqual(3);
    expect(firstCardOverlap(b)).toBeNull();
    expect(listSamples().find((s) => s.id === 'weight-sorter')!.label).not.toMatch(/game/i);
  });

  it('makes crates of random mass forever: both light and heavy ones, a new one every few seconds', { timeout: 120_000 }, () => {
    const r = sort(sample());
    expect(r.crates.length).toBeGreaterThanOrEqual(Math.floor(RUN_S / WEIGHT_SORTER.spawnEveryS) - 1);
    const masses = new Set(r.crates.map((c) => c.massKg));
    expect(masses.size).toBeGreaterThanOrEqual(4);
    for (const m of masses) {
      expect(Number.isInteger(m)).toBe(true);
      expect(m).toBeGreaterThanOrEqual(WEIGHT_SORTER.minKg);
      expect(m).toBeLessThanOrEqual(WEIGHT_SORTER.maxKg);
    }
    expect(r.crates.some(isHeavy)).toBe(true);
    expect(r.crates.some((c) => !isHeavy(c))).toBe(true);
  });

  it('every heavy crate ends in the side bin and every light one in the end bin, and the bins show how many lie in them', { timeout: 120_000 }, () => {
    const r = sort(sample());
    const done = arrived(r);
    expect(done.length).toBeGreaterThanOrEqual(8);
    for (const c of done) expect(c.bin, `${c.massKg} kg`).toBe(isHeavy(c) ? 'side' : 'end');
    expect(r.sideTotal).toBe(done.filter(isHeavy).length);
    expect(r.endTotal).toBe(done.filter((c) => !isHeavy(c)).length);
    // The readouts show the crates lying in each bin right now.
    expect(r.shownSide).toBe(r.nowSide);
    expect(r.shownEnd).toBe(r.nowEnd);
    expect(r.shownSide + r.shownEnd).toBeGreaterThan(0);
    expect(r.overloaded).toBe(false);
    // The push needs mu * m * g at most for the heaviest crate; the shipped limit leaves room.
    expect(r.peakForce).toBeLessThan(WEIGHT_SORTER.pistonForceN);
    expect(r.peakForce).toBeLessThanOrEqual(0.5 * WEIGHT_SORTER.maxKg * 9.81 + 0.1);
  });

  it('runs on "Vật lý thật" and keeps sorting for two minutes: every crate old enough lies in its own bin, none on the floor, none left on the belt', { timeout: 180_000 }, () => {
    const b = sample();
    expect(b.graph.settings?.realPhysics).toBe(true);
    // The gravity stays at the default 9,81: the numbers in the notes use it.
    expect(b.graph.settings?.gravity).toBeUndefined();
    const r = sort(b);
    const settled = r.crates.filter((c) => c.binAtSettled !== null);
    expect(settled.length).toBeGreaterThanOrEqual(20);
    for (const c of settled) {
      expect(c.binAtSettled, `${c.massKg} kg made at ${c.bornS.toFixed(0)} s`).toBe(isHeavy(c) ? 'side' : 'end');
      expect(c.settledTopY).toBeLessThan(1.3);
    }
    for (const c of r.crates) expect(c.onFloor, `${c.massKg} kg made at ${c.bornS.toFixed(0)} s`).toBe(false);
    expect(r.overloaded).toBe(false);
  });

  it('the scale reading climbs while a crate rides onto it (its share by the lever rule) and ends at the crate mass', { timeout: 60_000 }, () => {
    const r = sort(sample(), 16);
    // The first crate (made at 4 s, 1 kg) reaches the scale at about 12 s; it is the first non-zero reading; follow it until the reading falls again.
    const start = r.scaleReads.findIndex((v) => v > 0);
    expect(start).toBeGreaterThan(0);
    const climb: number[] = [];
    for (let i = start; i < r.scaleReads.length && r.scaleReads[i]! >= (climb.at(-1) ?? 0) - 1e-6; i++) climb.push(r.scaleReads[i]!);
    const first = r.crates[0]!.massKg;
    expect(new Set(climb.map((v) => v.toFixed(2))).size).toBeGreaterThanOrEqual(3);
    expect(climb.at(-1)!).toBeCloseTo(first, 1);
    expect(Math.max(...r.scaleReads)).toBeLessThanOrEqual(first + 0.01);
  });

  it('the push force is the smaller of the sliding force mu m g and the tipping force m g a / h: 39.2 N for a 8 kg crate, 41.9 N when the rougher crates would tip', { timeout: 180_000 }, () => {
    const heavyOnly = (mu: number): Board => {
      const b = sample();
      b.graph.nodes.find((n) => n.id === 'dice')!.params.min = WEIGHT_SORTER.maxKg;
      b.graph.nodes.find((n) => n.id === 'maker')!.params.mu = mu;
      return b;
    };
    const slide = sort(heavyOnly(0.5), 50);
    expect(slide.peakForce).toBeCloseTo(0.5 * 8 * 9.81, 1);
    // Rough crates (mu 0.8) would need 62.8 N to slide, so the tipping force (half a crate width 0.4 m over the push height 0.75 m) is the smaller one.
    const tip = sort(heavyOnly(0.8), 50);
    expect(tip.peakForce).toBeCloseTo((8 * 9.81 * 0.4) / 0.75, 1);
    expect(tip.overloaded).toBe(false);
    expect(tip.sideTotal).toBeGreaterThanOrEqual(2);
    expect(tip.endTotal).toBe(0);
  });

  it('keeps sorting other random rolls (other seeds)', { timeout: 300_000 }, () => {
    // Seed 0 = different every run, the others repeat.
    for (const seed of [0, 7, 99, 2024]) {
      const b = sample();
      b.graph.nodes.find((n) => n.id === 'dice')!.params.seed = seed;
      const r = sort(b, 60);
      const done = arrived(r);
      expect(done.length, `seed ${seed}`).toBeGreaterThanOrEqual(5);
      for (const c of done) expect(c.bin, `seed ${seed}, ${c.massKg} kg`).toBe(isHeavy(c) ? 'side' : 'end');
    }
  });

  it('a piston weaker than the push force of the heavy crates cannot sort them (Quá tải)', { timeout: 180_000 }, () => {
    const need = 0.5 * WEIGHT_SORTER.maxKg * 9.81;
    // Only 8 kg crates, so the needed force is exactly mu * 8 * 9.81 = 39.24 N.
    const heavyOnly = (force: number): Board => {
      const b = sample();
      b.graph.nodes.find((n) => n.id === 'dice')!.params.min = WEIGHT_SORTER.maxKg;
      b.graph.nodes.find((n) => n.id === 'piston')!.params.maxForce = force;
      return b;
    };
    const weak = sort(heavyOnly(Math.floor(need) - 1), 50);
    expect(weak.overloaded).toBe(true);
    expect(weak.sideTotal).toBe(0);
    // With room to spare (1.5 times the need) it works again; with only 1 N to spare the rod is so slow that the crate rides on to the end bin.
    const ok = sort(heavyOnly(Math.ceil(need * 1.5)), 50);
    expect(ok.sideTotal).toBeGreaterThanOrEqual(2);
    expect(ok.peakForce).toBeCloseTo(need, 1);
    // 41 N is only 1.8 N above the need: the spare force gives the crate 0.2 m/s2, so it is pushed too slowly and rides on to the end bin.
    const slow = sort(heavyOnly(41), 50);
    expect(slow.overloaded).toBe(false);
    expect(slow.endTotal).toBeGreaterThanOrEqual(1);
  });

  it('is anti-forced: without any essential wire nothing is sorted into the side bin', { timeout: 600_000 }, () => {
    const essential: [string, string, string, string][] = [
      ['go', 'started', 'make-timer', 'run'],
      ['make-timer', 'done', 'maker', 'spawn'],
      ['scale', 'self', 'weigh', 'who'],
      ['weigh', 'mass', 'is-heavy', 'a'],
      ['is-heavy', 'out', 'heavy-seen', 'set'],
      ['weigh', 'loaded', 'here', 'set'],
      ['here', 'on', 'wait', 'run'],
      ['wait', 'done', 'now-push', 'a'],
      ['heavy-seen', 'on', 'now-push', 'b'],
      ['now-push', 'out', 'piston', 'extend'],
      ['go', 'started', 'feed', 'run'],
      // Without the mass wire every crate is the default 1 kg: all light, none to the side.
      ['dice', 'value', 'maker', 'mass'],
    ];
    for (const link of essential) {
      expect(WEIGHT_SORTER_WIRES.some((w) => w.join('.') === link.join('.')), link.join('.')).toBe(true);
      const r = sort(without(sample(), link), 40);
      expect(r.sideTotal, link.join('.')).toBe(0);
    }
  });

  it('without the limit wire the compare is always on: the first crate of any weight is pushed and the sorting by weight is gone', { timeout: 180_000 }, () => {
    const link = ['limit', 'value', 'is-heavy', 'b'] as const;
    expect(WEIGHT_SORTER_WIRES.some((w) => w.join('.') === link.join('.'))).toBe(true);
    const r = sort(without(sample(), link), 60);
    const done = arrived(r);
    // A light crate goes to the side, and a heavy one is left to ride on to the end bin: not sorted by weight.
    expect(done.some((c) => c.bin === 'side' && !isHeavy(c)) || done.some((c) => c.bin === 'end' && isHeavy(c))).toBe(true);
  });

  it('wires that only report (the scale reading, the force readout, the camera) are not essential: the machine sorts without them', { timeout: 180_000 }, () => {
    for (const link of [
      ['weigh', 'mass', 'show-mass', 'value'],
      ['piston', 'force', 'show-force', 'value'],
      ['go', 'started', 'cam', 'on'],
    ] as const) {
      const r = sort(without(sample(), link), 40);
      expect(r.sideTotal, link.join('.')).toBeGreaterThanOrEqual(1);
    }
  });

  it('without the "forget" wire the memory stays on: every later crate is pushed too, light ones included', { timeout: 180_000 }, () => {
    const cut = sort(without(sample(), ['piston', 'extended', 'heavy-seen', 'reset']), 60);
    const ok = sort(sample(), 60);
    expect(ok.crates.filter((c) => c.bin === 'side').every(isHeavy)).toBe(true);
    expect(cut.crates.some((c) => c.bin === 'side' && !isHeavy(c))).toBe(true);
  });
});
