import { describe, expect, it } from 'vitest';
import { blockNode } from '../../src/nodes/block';
import { makeWorld, runNode } from './fake-world';

const run = (steps: Record<string, boolean>[]) => {
  const w = makeWorld();
  runNode(blockNode, steps.map((inputs) => ({ inputs })), {}, w);
  return w;
};

describe('block "Ẩn khi bật"', () => {
  it('hides while on and shows again when it turns off', () => {
    const w = run([{ hiddenWhile: false }, { hiddenWhile: true }, { hiddenWhile: true }, { hiddenWhile: false }, { hiddenWhile: false }]);
    expect(w.hidden).toHaveLength(1);
    expect(w.shown).toHaveLength(1);
  });
  it('hides at once when it is already on at the start', () => {
    const w = run([{ hiddenWhile: true }, { hiddenWhile: true }]);
    expect(w.hidden).toHaveLength(1);
    expect(w.shown).toHaveLength(0);
  });
  it('does nothing when unwired', () => {
    const w = run([{}, {}, {}]);
    expect(w.hidden).toHaveLength(0);
    expect(w.shown).toHaveLength(0);
  });
  it('a "Ẩn đi" pulse still hides and is not undone by an unchanged off signal', () => {
    const w = run([{ hide: true, hiddenWhile: false }, { hiddenWhile: false }, { show: true }]);
    expect(w.hidden).toHaveLength(1);
    expect(w.shown).toHaveLength(1);
  });
  it('latest change wins: signal turning off re-shows a block hidden by a pulse, a later pulse hides it again', () => {
    const w = run([{ hiddenWhile: true }, { hiddenWhile: false }, { hide: true }]);
    expect(w.hidden).toHaveLength(2);
    expect(w.shown).toHaveLength(1);
  });
  it('is the last input, after the existing ones', () => {
    expect(blockNode.inputs.map((x) => x.id).slice(0, 5)).toEqual(['hide', 'show', 'pick', 'run', 'reverse']);
    expect(blockNode.inputs[5]!.id).toBe('hiddenWhile');
  });
});
