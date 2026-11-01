import type { BackdropKind } from './backdrop-kit';
import { buildBackdropB } from './theme-b';
import { buildBackdropC } from './theme-c';
import './theme-b.css';
import './theme-c.css';

/**
 * The spare looks B "Đồi cỏ trời xanh" and C "Đêm sao dịu", kept in the repo for later. Nothing in the normal build
 * imports this file: theme.ts loads it lazily, and only in development with `?theme=b` or `?theme=c`.
 */
export type ExtraThemeId = 'b' | 'c';

export function buildBackdropExtra(theme: ExtraThemeId, kind: BackdropKind): HTMLElement {
  return theme === 'b' ? buildBackdropB(kind) : buildBackdropC(kind);
}
