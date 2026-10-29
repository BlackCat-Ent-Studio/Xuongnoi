import { beforeAll, describe, expect, it } from 'vitest';
import { listNodeDefs } from '../../src/engine/registry';
import { registerAllNodes } from '../../src/nodes';
import { normalizeText, searchItems } from '../../src/editor/panels/palette-search';

beforeAll(() => registerAllNodes());

const items = () =>
  listNodeDefs('2d-side').map((d) => ({ kind: d.kind, title: d.label, description: d.description }));

describe('normalizeText', () => {
  it('strips diacritics and maps đ to d', () => {
    expect(normalizeText('  Đổi  Nhân vật ')).toBe('doi nhan vat');
  });
});

describe('searchItems', () => {
  it('returns everything for an empty query', () => {
    expect(searchItems(items(), '  ')).toHaveLength(items().length);
  });

  it('finds Nhân vật first when typed without diacritics', () => {
    const res = searchItems(items(), 'nhan vat');
    expect(res[0]?.kind).toBe('character');
  });

  it('matches diacritics and đ either way', () => {
    expect(searchItems(items(), 'bộ đếm').some((i) => i.kind === 'counter')).toBe(true);
    expect(searchItems(items(), 'bo dem').some((i) => i.kind === 'counter')).toBe(true);
  });

  it('matches synonyms', () => {
    expect(searchItems(items(), 'mèo').map((i) => i.kind)).toContain('character');
    expect(searchItems(items(), 'dong xu').map((i) => i.kind)).toContain('item');
  });

  it('ranks title matches before description-only matches', () => {
    const list = [
      { kind: 'a', title: 'Máu', description: 'Hiện số điểm' },
      { kind: 'b', title: 'Điểm', description: 'x' },
    ];
    expect(searchItems(list, 'diem').map((i) => i.kind)).toEqual(['b', 'a']);
  });

  it('returns nothing when a word is missing everywhere', () => {
    expect(searchItems(items(), 'zzzqqq')).toEqual([]);
  });
});
