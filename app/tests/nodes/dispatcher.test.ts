import { describe, expect, it } from 'vitest';
import { activeInputs, activeOutputs, getNodeDef, knownInputs } from '../../src/engine/registry';
import type { Params, PortValues } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { dispatcherNode } from '../../src/nodes/dispatcher';
import { createRng } from '../../src/nodes/random';
import { defaultParams, makeCtx, makeWorld } from './fake-world';

registerAllNodes();

/** The card driven tick by tick with whatever inputs the test gives. */
function card(over: Params = {}) {
  const params = defaultParams(dispatcherNode, over);
  const world = makeWorld();
  const state = dispatcherNode.create!(makeCtx(world), params);
  let tick = 0;
  return (inputs: PortValues = {}): PortValues => dispatcherNode.evaluate(makeCtx(world, { tick: tick++ }), inputs, params, state);
}

const givenTo = (out: PortValues, machines: number): number[] => Array.from({ length: machines }, (_, k) => k + 1).filter((k) => out[`give${k}`] === true);

describe('dispatcher: one job at a time', () => {
  it('hands a job over once per rising "Có việc", as a one-tick pulse', () => {
    const step = card();
    expect(givenTo(step({}), 2)).toEqual([]);
    const first = step({ job: true });
    expect(givenTo(first, 2)).toEqual([1]);
    expect([first.chosen, first.given, first.waiting]).toEqual([1, 1, false]);
    const held = step({ job: true });
    expect(givenTo(held, 2)).toEqual([]);
    expect([held.chosen, held.given]).toEqual([1, 1]);
    step({});
    expect(givenTo(step({ job: true }), 2)).toEqual([2]);
  });

  it('"Lần lượt" goes round the machines and skips a busy one', () => {
    const step = card({ machines: 3 });
    const order: number[] = [];
    for (let n = 0; n < 7; n++) {
      order.push(...givenTo(step({ job: true, busy2: n >= 4 }), 3));
      step({ busy2: n >= 4 });
    }
    expect(order).toEqual([1, 2, 3, 1, 3, 1, 3]);
  });

  it('"Máy rảnh đầu tiên" always takes the lowest free machine', () => {
    const step = card({ machines: 3, mode: 'first' });
    const order: number[] = [];
    for (let n = 0; n < 6; n++) {
      order.push(...givenTo(step({ job: true, busy1: n === 2 || n === 3, busy2: n === 3 }), 3));
      step({});
    }
    expect(order).toEqual([1, 1, 2, 3, 1, 1]);
  });

  it('a job waits while every machine is busy and is handed over on the tick one frees up', () => {
    const step = card();
    const all = { busy1: true, busy2: true };
    const wait = step({ job: true, ...all });
    expect([givenTo(wait, 2), wait.waiting, wait.given, wait.chosen]).toEqual([[], true, 0, 0]);
    expect(step(all).waiting).toBe(true);
    const freed = step({ busy1: true });
    expect([givenTo(freed, 2), freed.waiting, freed.given, freed.chosen]).toEqual([[2], false, 1, 2]);
    expect(givenTo(step({}), 2)).toEqual([]);
  });

  it('jobs that arrive while others wait queue up and leave first come, first served, one per tick', () => {
    const step = card({ showCode: 'yes' });
    const all = { busy1: true, busy2: true };
    step({ job: true, jobId: 11, ...all });
    step(all);
    step({ job: true, jobId: 22, ...all });
    step(all);
    step({ job: true, jobId: 33, ...all });
    const a = step({});
    expect([givenTo(a, 2), a.code1, a.waiting]).toEqual([[1], 11, false]);
    const b = step({ busy1: true });
    expect([givenTo(b, 2), b.code2]).toEqual([[2], 22]);
    const c = step(all);
    expect([givenTo(c, 2), c.waiting]).toEqual([[], true]);
    const d = step({ busy2: true });
    expect([givenTo(d, 2), d.code1, d.code2, d.given]).toEqual([[1], 33, 22, 3]);
  });

  it('"Mã cho máy k" holds until the next hand-over to that machine, and reads 0 while the code ports are hidden', () => {
    const step = card({ showCode: 'yes' });
    step({ job: true, jobId: 7 });
    expect(step({ jobId: 99 }).code1).toBe(7);
    expect(step({ job: true, jobId: 5 }).code2).toBe(5);
    expect(step({}).code1).toBe(7);
    const plain = card();
    expect(plain({ job: true, jobId: 7 }).code1).toBe(0);
  });

  it('a "Có việc" that is already on at the start is one job; unwired busy inputs mean always free', () => {
    const step = card({ machines: 4 });
    const seen: number[] = [];
    for (let n = 0; n < 6; n++) {
      seen.push(...givenTo(step({ job: true }), 4));
      step({});
    }
    expect(seen).toEqual([1, 2, 3, 4, 1, 2]);
  });
});

describe('dispatcher: ports follow "Số máy"', () => {
  const ids = (ports: { id: string }[]) => ports.map((p) => p.id);
  it('shows one busy input and one give output per machine, 2 to 12', () => {
    expect(ids(activeInputs(dispatcherNode, defaultParams(dispatcherNode)))).toEqual(['job', 'busy1', 'busy2']);
    expect(ids(activeOutputs(dispatcherNode, defaultParams(dispatcherNode)))).toEqual(['chosen', 'waiting', 'given', 'give1', 'give2']);
    for (const [raw, n] of [[0, 2], [5, 5], [12, 12], [99, 12], [2.6, 3]] as const) {
      expect(activeInputs(dispatcherNode, { machines: raw }), String(raw)).toHaveLength(1 + n);
      expect(activeOutputs(dispatcherNode, { machines: raw }), String(raw)).toHaveLength(3 + n);
    }
  });

  it('the code ports appear only with "Hiện cổng Mã việc"', () => {
    const on = { machines: 3, showCode: 'yes' };
    expect(ids(activeInputs(dispatcherNode, on))).toEqual(['job', 'jobId', 'busy1', 'busy2', 'busy3']);
    expect(ids(activeOutputs(dispatcherNode, on))).toEqual(['chosen', 'waiting', 'given', 'give1', 'give2', 'give3', 'code1', 'code2', 'code3']);
    expect(dispatcherNode.params.find((p) => p.id === 'showCode')?.advanced).toBe(true);
  });

  it('every busy input is a feedback port, and nothing else is', () => {
    const flagged = knownInputs(dispatcherNode).filter((p) => p.feedback).map((p) => p.id);
    expect(flagged).toEqual(Array.from({ length: 12 }, (_, k) => `busy${k + 1}`));
  });

  it('a 12-machine card is not taller than a 12-step sequence card with its done ports', () => {
    const rows = (kind: string, params: Params) => activeInputs(getNodeDef(kind)!, params).length + activeOutputs(getNodeDef(kind)!, params).length;
    expect(rows('dispatcher', { machines: 12 })).toBeLessThanOrEqual(rows('sequence', { stepCount: 12, showDone: 'yes' }));
  });

  it('is registered under Bộ não with Vietnamese and English names on every port', () => {
    const def = getNodeDef('dispatcher')!;
    expect([def.label, def.labelEn, def.category]).toEqual(['Bộ điều phối', 'Dispatcher', 'brain']);
    const all = { machines: 12, showCode: 'yes' };
    for (const p of [...activeInputs(def, all), ...activeOutputs(def, all)]) expect(p.labelEn, p.id).toBeTruthy();
    expect(activeInputs(def, all).map((p) => p.label).slice(0, 4)).toEqual(['Có việc', 'Mã việc', 'Máy 1 đang bận', 'Máy 2 đang bận']);
    expect(activeOutputs(def, all).map((p) => p.label).slice(0, 4)).toEqual(['Máy được chọn', 'Đang chờ', 'Đã giao', 'Giao máy 1']);
    expect(activeOutputs(def, all).at(-1)!.label).toBe('Mã cho máy 12');
  });
});

interface Tally {
  jobs: number;
  handed: number[];
  perMachine: number[];
  waitedTicks: number;
}

/**
 * 10 000 ticks of random job arrivals against machines that work for a random time. A machine turns busy on the tick after
 * its hand-over (the one-tick delay of a loop) and the test fails on the spot if a rule is broken.
 */
function soak(machines: number, mode: string, seed: number, jobChance: number, maxWork: number): Tally {
  const rnd = createRng(seed);
  const step = card({ machines, mode, showCode: 'yes' });
  const left = Array.from({ length: machines }, () => 0);
  const tally: Tally = { jobs: 0, handed: [], perMachine: Array.from({ length: machines }, () => 0), waitedTicks: 0 };
  let level = false;
  let queued = 0;
  const tickOnce = (mayArrive: boolean): void => {
    // A new job needs the signal to drop first, so at most every other tick.
    level = !level && mayArrive && rnd() < jobChance;
    if (level) {
      tally.jobs += 1;
      queued += 1;
    }
    const busy = left.map((t) => t > 0);
    const inputs: PortValues = { job: level, jobId: tally.jobs };
    busy.forEach((b, k) => (inputs[`busy${k + 1}`] = b));
    const out = step(inputs);
    const to = givenTo(out, machines);
    expect(to.length).toBeLessThanOrEqual(1);
    if (to.length === 1) {
      const k = to[0]! - 1;
      expect(busy[k], 'handed to a busy machine').toBe(false);
      expect(out.chosen).toBe(k + 1);
      tally.handed.push(out[`code${k + 1}`] as number);
      tally.perMachine[k]! += 1;
      queued -= 1;
    } else if (queued > 0) {
      expect(busy.every(Boolean), 'a job waited although a machine was free').toBe(true);
    }
    expect(out.waiting).toBe(queued > 0 && to.length === 0);
    if (out.waiting) tally.waitedTicks += 1;
    expect(out.given).toBe(tally.handed.length);
    for (let k = 0; k < machines; k++) if (left[k]! > 0) left[k]! -= 1;
    if (to.length === 1) left[to[0]! - 1] = 1 + Math.floor(rnd() * maxWork);
  };
  for (let t = 0; t < 10_000; t++) tickOnce(true);
  // Let the queue drain: nothing new arrives.
  for (let t = 0; t < 20_000 && queued > 0; t++) tickOnce(false);
  expect(queued).toBe(0);
  return tally;
}

describe('dispatcher: no job lost, none handed twice over 10 000 random ticks', () => {
  const cases: [machines: number, mode: string, jobChance: number, maxWork: number][] = [
    [2, 'round', 0.3, 12],
    [2, 'first', 0.3, 12],
    [12, 'round', 0.9, 60],
    [12, 'first', 0.9, 60],
    [5, 'round', 0.5, 4],
  ];
  for (const [machines, mode, jobChance, maxWork] of cases) {
    it(`${machines} machines, ${mode}`, () => {
      const t = soak(machines, mode, 20261119 + machines, jobChance, maxWork);
      expect(t.jobs).toBeGreaterThan(1000);
      // Every job exactly once, in the order it arrived.
      expect(t.handed).toEqual(Array.from({ length: t.jobs }, (_, k) => k + 1));
      expect(t.perMachine.reduce((a, b) => a + b, 0)).toBe(t.jobs);
      if (maxWork > 4) expect(t.waitedTicks).toBeGreaterThan(0);
    });
  }

  it('the same seed gives the same run', () => {
    expect(soak(3, 'round', 7, 0.6, 9)).toEqual(soak(3, 'round', 7, 0.6, 9));
  });

  it('"Lần lượt" shares evenly among free machines, "Máy rảnh đầu tiên" loads the first ones', () => {
    const round = soak(4, 'round', 3, 0.2, 2).perMachine;
    const first = soak(4, 'first', 3, 0.2, 2).perMachine;
    expect(Math.max(...round) - Math.min(...round)).toBeLessThan(round[0]! * 0.2);
    expect(first[0]!).toBeGreaterThan(first[3]! * 3);
  });
});
