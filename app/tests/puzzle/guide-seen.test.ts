import { describe, expect, it } from 'vitest';
import { GUIDE_SEEN_KEY, hasSeenGuide, loadGuideSeen, markGuideSeen } from '../../src/puzzle/ui/guide-script';

function fakeStorage(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(GUIDE_SEEN_KEY, initial);
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('guide seen memory', () => {
  it('starts empty and remembers levels', () => {
    const s = fakeStorage();
    expect(hasSeenGuide('cua-kho', s)).toBe(false);
    expect(markGuideSeen('cua-kho', s)).toBe(true);
    expect(markGuideSeen('bot-dau-tien', s)).toBe(true);
    expect(hasSeenGuide('cua-kho', s)).toBe(true);
    expect(hasSeenGuide('nhat-sao', s)).toBe(false);
    expect([...loadGuideSeen(s)].sort()).toEqual(['bot-dau-tien', 'cua-kho']);
  });

  it('does not duplicate a level', () => {
    const s = fakeStorage();
    markGuideSeen('cua-kho', s);
    markGuideSeen('cua-kho', s);
    expect(JSON.parse(s.data.get(GUIDE_SEEN_KEY) ?? '[]')).toEqual(['cua-kho']);
  });

  it('ignores garbage', () => {
    for (const bad of ['not json', '{"a":1}', '42', 'null', '[1,{"x":2}]']) {
      expect([...loadGuideSeen(fakeStorage(bad))]).toEqual([]);
    }
    expect([...loadGuideSeen(fakeStorage('["a",3,"b"]'))]).toEqual(['a', 'b']);
  });

  it('copes with blocked or full storage', () => {
    expect(loadGuideSeen(null).size).toBe(0);
    expect(markGuideSeen('x', null)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadGuideSeen(broken).size).toBe(0);
    expect(markGuideSeen('x', broken)).toBe(false);
  });
});
