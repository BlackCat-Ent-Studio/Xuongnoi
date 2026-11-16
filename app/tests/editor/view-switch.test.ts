import { describe, expect, it } from 'vitest';
import { DEFAULT_2D, modeForKind, remember2d, viewKindOf } from '../../src/editor/view-switch';

describe('view switch', () => {
  it('maps the three engine modes onto the 2D / 3D buttons', () => {
    expect(viewKindOf('2d-side')).toBe('2d');
    expect(viewKindOf('2d-top')).toBe('2d');
    expect(viewKindOf('3d')).toBe('3d');
  });

  it('remembers the last 2D view while the board is in 3D', () => {
    expect(remember2d('2d-top', '2d-side')).toBe('2d-top');
    expect(remember2d('3d', '2d-top')).toBe('2d-top');
    expect(remember2d('3d', DEFAULT_2D)).toBe(DEFAULT_2D);
  });

  it('the 2D button returns to the last used 2D view, the 3D button always goes to 3D', () => {
    expect(modeForKind('2d', '2d-top')).toBe('2d-top');
    expect(modeForKind('2d', '2d-side')).toBe('2d-side');
    expect(modeForKind('3d', '2d-top')).toBe('3d');
  });

  it('a 2D -> 3D -> 2D round trip lands on the same 2D view', () => {
    let last = remember2d('2d-top', DEFAULT_2D);
    last = remember2d('3d', last);
    expect(modeForKind('2d', last)).toBe('2d-top');
  });
});
