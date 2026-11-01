import { backdropRoot, repeat, rng, type BackdropKind } from './backdrop-kit';

/** Theme C "Đêm sao dịu": indigo-to-plum night sky, glowing moon, twinkling stars, drifting fireflies, a shooting star. */

const HILLS = `<svg class="c-hills" viewBox="0 0 844 130" preserveAspectRatio="none">
  <path d="M0 70Q120 20 260 62T520 50T844 36V130H0z" fill="#241a52"/>
  <path d="M0 100Q180 58 380 94T844 78V130H0z" fill="#1a1245"/></svg>`;

export function buildBackdropC(kind: BackdropKind): HTMLElement {
  const page = kind === 'page';
  const r = rng(7);
  const stars = repeat(page ? 46 : 30, 'i', 'c-star', () =>
    `--x:${(r() * 98).toFixed(1)}%;--y:${(r() * 62).toFixed(1)}%;--s:${(0.7 + r() * 1.3).toFixed(2)};--d:${(2.5 + r() * 4).toFixed(1)}s;--dl:-${(r() * 6).toFixed(1)}s`);
  const flies = repeat(page ? 12 : 9, 'i', 'c-firefly', () =>
    `--x:${(4 + r() * 90).toFixed(1)}%;--y:${(38 + r() * 50).toFixed(1)}%;--dx:${((r() - 0.5) * 12).toFixed(1)};--dy:${((r() - 0.6) * 9).toFixed(1)};--d:${(6 + r() * 6).toFixed(1)}s;--g:${(2.4 + r() * 2.6).toFixed(1)}s;--dl:-${(r() * 8).toFixed(1)}s`);
  return backdropRoot('c', kind, `<div class="c-sky"></div>${stars}<div class="c-moon"></div><div class="c-shoot"></div>${HILLS}${flies}`);
}
