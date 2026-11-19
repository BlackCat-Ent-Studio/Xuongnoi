import { describe, expect, it } from 'vitest';
import { getNodeDef } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { sampleHoldNode } from '../../src/nodes/sample-hold';
import { runNode } from './fake-world';

registerAllNodes();

type Step = { value?: number; store?: boolean; clear?: boolean };
const run = (steps: Step[], params = {}) => runNode(sampleHoldNode, steps.map((inputs) => ({ inputs })), params);

describe('sample-hold', () => {
  it('copies the value on the rising edge of "Lưu" and holds it while the value changes', () => {
    const out = run([{ value: 4 }, { value: 4, store: true }, { value: 9, store: true }, { value: 9 }, { value: 2, store: true }, { value: 7 }]);
    expect(out.map((o) => o.held)).toEqual([0, 4, 4, 4, 2, 2]);
    expect(out.map((o) => o.stored)).toEqual([false, true, false, false, true, false]);
  });

  it('starts from "Số ban đầu" and "Xoá" goes back to it', () => {
    const out = run([{}, { value: 5, store: true }, { clear: true }, { clear: true }, {}], { start: -3 });
    expect(out.map((o) => o.held)).toEqual([-3, 5, -3, -3, -3]);
  });

  it('"Xoá" wins when both rise on the same tick, and that tick is not a store', () => {
    const [o] = run([{ value: 8, store: true, clear: true }], { start: 1 });
    expect(o).toEqual({ held: 1, stored: false });
  });

  it('a "Lưu" that is already on at the start counts as one store; unwired inputs never store', () => {
    expect(run([{ value: 6, store: true }, { value: 7, store: true }]).map((o) => o.held)).toEqual([6, 6]);
    expect(run([{ value: 6 }, { value: 7 }]).map((o) => [o.held, o.stored])).toEqual([[0, false], [0, false]]);
  });

  it('reads a missing or non-finite value as 0 and keeps negative and fractional numbers exactly', () => {
    expect(run([{ store: true }], { start: 5 })[0]!.held).toBe(0);
    expect(run([{ value: Number.NaN, store: true }], { start: 5 })[0]!.held).toBe(0);
    expect(run([{ value: -2.75, store: true }])[0]!.held).toBe(-2.75);
  });

  it('gives the same outputs for the same inputs on every run', () => {
    const steps: Step[] = Array.from({ length: 200 }, (_, k) => ({ value: (k * 37) % 11, store: k % 7 === 3, clear: k % 53 === 0 }));
    expect(run(steps)).toEqual(run(steps));
  });

  it('is registered under Tính toán with Vietnamese and English names', () => {
    const def = getNodeDef('sample-hold')!;
    expect([def.label, def.labelEn, def.category]).toEqual(['Nhớ số', 'Sample and Hold', 'math']);
    expect(def.inputs.map((p) => p.label)).toEqual(['Giá trị', 'Lưu', 'Xoá']);
    expect(def.outputs.map((p) => p.label)).toEqual(['Số nhớ', 'Vừa lưu']);
    expect(def.params.map((p) => [p.label, p.default])).toEqual([['Số ban đầu', 0]]);
  });
});
