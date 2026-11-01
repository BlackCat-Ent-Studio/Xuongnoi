/**
 * The look of the puzzle game: A "Xưởng gỗ ấm áp" (warm workshop), always on. The spare looks B and C live in
 * theme-extra.ts and are only loaded in development with `?theme=b` or `?theme=c`.
 */
import type { BackdropKind } from './backdrop-kit';
import { buildBackdropA } from './theme-a';
import type { ExtraThemeId } from './theme-extra';
import './backdrop.css';
import './theme-a.css';

type ThemeId = 'a' | ExtraThemeId;

let active: ThemeId = 'a';
let buildExtra: ((theme: ExtraThemeId, kind: BackdropKind) => HTMLElement) | null = null;

/** The animated background of the active look, ready to sit behind the page or behind the stage canvas. */
export function buildBackdrop(kind: BackdropKind): HTMLElement {
  return active !== 'a' && buildExtra ? buildExtra(active, kind) : buildBackdropA(kind);
}

/** Applies the look to the page. Resolves once the (rare) spare look has loaded. */
export async function initTheme(): Promise<void> {
  if (import.meta.env.DEV) {
    const param = new URLSearchParams(location.search).get('theme');
    if (param === 'b' || param === 'c') {
      try {
        const extra = await import('./theme-extra');
        buildExtra = extra.buildBackdropExtra;
        active = param;
      } catch (err) {
        console.error(err);
      }
    }
  }
  document.body.classList.add(`pz-theme-${active}`);
  document.body.prepend(buildBackdrop('page'));
}
