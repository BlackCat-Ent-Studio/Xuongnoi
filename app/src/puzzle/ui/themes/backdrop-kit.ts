/** Shared helpers for the themed animated backdrops. */

/** Where a backdrop is shown: behind the whole page (level list, around the phone) or behind the stage canvas. */
export type BackdropKind = 'page' | 'stage';

/** Small seeded random generator so every load draws the same scenery. */
export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The backdrop root. `.pz-bg` sizes everything in `--u` (1cqw on the stage, 1vw on the page). */
export function backdropRoot(theme: string, kind: BackdropKind, inner: string): HTMLElement {
  const el = document.createElement('div');
  el.className = `pz-bg pz-bg-${kind} pz-bg-${theme}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = inner;
  return el;
}

/** `n` copies of a small element, each given a style string by `style(i)`. */
export function repeat(n: number, tag: string, cls: string, style: (i: number) => string): string {
  let html = '';
  for (let i = 0; i < n; i++) html += `<${tag} class="${cls}" style="${style(i)}"></${tag}>`;
  return html;
}
