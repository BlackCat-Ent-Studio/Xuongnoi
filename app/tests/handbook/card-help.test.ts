import { beforeAll, describe, expect, it } from 'vitest';
import { listNodeDefs } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { cardHelpSummary, firstSentence } from '../../src/handbook/card-help-summary';

beforeAll(() => registerAllNodes());

describe('card help summary', () => {
  it('gives every registered kind a short summary that lists all of its ports', () => {
    for (const def of listNodeDefs()) {
      const s = cardHelpSummary(def.kind);
      expect(s, def.kind).not.toBeNull();
      if (!s) continue;
      expect(s.title).toBe(def.label);
      expect(s.purpose.length, def.kind).toBeGreaterThan(0);
      expect(s.purpose.length, def.kind).toBeLessThan(240);
      expect(s.example.length, def.kind).toBeGreaterThan(0);
      expect(s.ports.filter((p) => p.dir === 'in').map((p) => p.id), def.kind).toEqual(def.inputs.map((p) => p.id));
      expect(s.ports.filter((p) => p.dir === 'out').map((p) => p.id), def.kind).toEqual(def.outputs.map((p) => p.id));
      for (const p of s.ports) expect(p.text.length, `${def.kind}.${p.id}`).toBeGreaterThan(0);
    }
  });

  it('keeps only the ports the card shows', () => {
    const def = listNodeDefs().find((d) => d.inputs.length > 0 && d.outputs.length > 0);
    if (!def) throw new Error('no node with both inputs and outputs');
    const first = def.inputs[0]?.id ?? '';
    const s = cardHelpSummary(def.kind, new Set([`in|${first}`]));
    expect(s?.ports.map((p) => `${p.dir}|${p.id}`)).toEqual([`in|${first}`]);
  });

  it('returns null for an unknown kind', () => {
    expect(cardHelpSummary('no-such-kind')).toBeNull();
  });

  it('cuts text at the first sentence', () => {
    expect(firstSentence('Một câu. Câu hai.')).toBe('Một câu.');
    expect(firstSentence('Không có dấu chấm')).toBe('Không có dấu chấm');
  });
});
