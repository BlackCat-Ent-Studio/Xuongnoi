import type { BackdropKind } from './backdrop-kit';
import { buildBackdropA } from './theme-a';
import { buildBackdropB } from './theme-b';
import { buildBackdropC } from './theme-c';
import './backdrop.css';
import './theme-a.css';
import './theme-b.css';
import './theme-c.css';

export type ThemeId = 'a' | 'b' | 'c';

export const THEME_IDS: readonly ThemeId[] = ['a', 'b', 'c'];

/** The animated background layers of a theme, ready to be inserted behind the page or the stage canvas. */
export function buildBackdrop(theme: ThemeId, kind: BackdropKind): HTMLElement {
  if (theme === 'a') return buildBackdropA(kind);
  if (theme === 'b') return buildBackdropB(kind);
  return buildBackdropC(kind);
}
