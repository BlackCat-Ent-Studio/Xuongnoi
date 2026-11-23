import { describe, expect, it } from 'vitest';
import { paletteKinds } from '../../src/tutorial/palette-targets';

describe('paletteKinds', () => {
  it('finds palette kinds in plain and grouped targets', () => {
    expect(
      paletteKinds(['.palette-item[data-kind="block"]', ['.prop-row[data-param="size"]', '.palette-item[data-kind="touch"]']]),
    ).toEqual(['block', 'touch']);
  });
  it('ignores other selectors', () => {
    expect(paletteKinds(['[data-tut="play"]', '.prop-row[data-param="size"]'])).toEqual([]);
    expect(paletteKinds([])).toEqual([]);
  });
});
