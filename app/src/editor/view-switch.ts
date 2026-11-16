import type { ViewMode } from '../engine/types';

/** The top bar offers two views: 2D (with a side or top flavour) and 3D. The saved ViewMode is unchanged. */
export type ViewKind = '2d' | '3d';
export type Mode2d = Exclude<ViewMode, '3d'>;

export const VIEW_KINDS: readonly ViewKind[] = ['2d', '3d'];
export const MODES_2D: readonly Mode2d[] = ['2d-side', '2d-top'];
/** The 2D flavour used when a board has not been seen in 2D yet. */
export const DEFAULT_2D: Mode2d = '2d-side';

export function viewKindOf(mode: ViewMode): ViewKind {
  return mode === '3d' ? '3d' : '2d';
}

/** The last 2D flavour: the current mode if it is 2D, otherwise what was remembered. */
export function remember2d(mode: ViewMode, previous: Mode2d): Mode2d {
  return mode === '3d' ? previous : mode;
}

/** The ViewMode a click on the 2D / 3D button switches to. */
export function modeForKind(kind: ViewKind, last2d: Mode2d): ViewMode {
  return kind === '3d' ? '3d' : last2d;
}
