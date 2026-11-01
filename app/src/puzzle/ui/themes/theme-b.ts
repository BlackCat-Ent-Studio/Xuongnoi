import { backdropRoot, repeat, type BackdropKind } from './backdrop-kit';

/** Theme B "Đồi cỏ trời xanh": sky, drifting clouds, layered swaying hills, falling petals, a windmill and a hut. */

const CLOUD = `<svg viewBox="0 0 120 52"><path d="M14 46a14 14 0 0 1 2-27.800A22 22 0 0 1 58 12a18 18 0 0 1 32 8 16 16 0 0 1 16 26z" fill="#fff"/><path d="M14 46h92a14 6 0 0 0 0-4H18z" fill="#dff0fb"/></svg>`;

const HILLS = `<svg class="b-hillbox" viewBox="0 0 844 390" preserveAspectRatio="xMidYMax slice">
  <g class="b-hill"><path d="M-20 215Q110 150 270 205T540 195T870 175V390H-20z" fill="#b4e3a4"/><path d="M-20 215Q110 150 270 205T540 195T870 175" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3"/></g>
  <g class="b-hill b-h2"><path d="M-20 262Q150 205 330 248T620 232T870 246V390H-20z" fill="#92d58b"/><path d="M-20 262Q150 205 330 248T620 232T870 246" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3"/></g>
  <g class="b-hill b-h3"><path d="M-20 308Q200 250 410 298T870 280V390H-20z" fill="#6fc67c"/><path d="M-20 308Q200 250 410 298T870 280" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="3"/></g>
  <g><path d="M-20 352Q220 314 450 346T870 334V390H-20z" fill="#4fae6c"/><path d="M-20 352Q220 314 450 346T870 334" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="3"/></g>
</svg>`;

const WINDMILL = (x: number, y: number, s: number): string => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M-16 0l5-60h22l5 60z" fill="#fff6e2"/><path d="M-16 0l5-60h6l-4 60z" fill="#f0e2c0"/>
  <path d="M-13 -60l13-16 13 16z" fill="#ff8fa8"/><rect x="-5" y="-22" width="10" height="22" rx="5" fill="#c9965a"/>
  <g class="b-blades"><g transform="translate(0 -62)"><rect x="-3" y="-44" width="6" height="88" rx="3" fill="#c9965a"/><rect x="-44" y="-3" width="88" height="6" rx="3" fill="#c9965a"/>
  <rect x="3" y="-44" width="14" height="20" rx="3" fill="#fff"/><rect x="-17" y="24" width="14" height="20" rx="3" fill="#fff"/><rect x="24" y="3" width="20" height="14" rx="3" fill="#fff"/><rect x="-44" y="-17" width="20" height="14" rx="3" fill="#fff"/><circle r="6" fill="#ffc247"/></g></g></g>`;

const HUT = (x: number, y: number, s: number): string => `<g transform="translate(${x} ${y}) scale(${s})">
  <rect x="-34" y="-34" width="68" height="34" rx="4" fill="#fff6e2"/><path d="M-42 -32 0 -64l42 32z" fill="#ff8fa8"/><path d="M-42 -32 0 -64l0 6-34 26z" fill="#ffb4c4"/>
  <rect x="14" y="-62" width="12" height="20" rx="2" fill="#c9965a"/><rect x="-9" y="-22" width="18" height="22" rx="9" fill="#c9965a"/><rect x="-28" y="-26" width="14" height="14" rx="3" fill="#8fd0f7"/><rect x="16" y="-26" width="12" height="12" rx="3" fill="#8fd0f7"/>
  <circle class="b-smoke" cx="20" cy="-70" r="5" fill="#fff" opacity=".9"/><circle class="b-smoke" cx="20" cy="-70" r="5" fill="#fff" opacity=".9"/><circle class="b-smoke" cx="20" cy="-70" r="5" fill="#fff" opacity=".9"/></g>`;

/** Cloud at `top`% of the height, `w` units wide, drifting once across in `dur` seconds (negative delay = already under way). */
const cloud = (w: number, top: number, dur: number, delay: number, op: number, rest: number): string =>
  `<div class="b-cloud" style="--w:${w};--top:${top}%;--dur:${dur}s;--dl:${delay}s;--op:${op};--rest:${rest}">${CLOUD}</div>`;

export function buildBackdropB(kind: BackdropKind): HTMLElement {
  const page = kind === 'page';
  const props = page
    ? `<svg class="b-props" viewBox="0 0 844 390" preserveAspectRatio="xMidYMax slice">${WINDMILL(640, 232, 1)}${HUT(470, 250, 0.6)}</svg>`
    : '';
  const clouds = cloud(15, 9, 70, -10, 0.95, 4) + cloud(10, 21, 110, -60, 0.8, 38) + cloud(19, 33, 150, -90, 0.7, 64) + (page ? cloud(12, 6, 95, -30, 0.85, 80) : '');
  const petals = repeat(page ? 14 : 8, 'i', 'b-petal', (i) => {
    const cols = ['#ffffff', '#ffb6c8', '#ffe27a', '#ffd0e0'];
    return `--x:${(12 + ((i * 97) % 86)).toFixed(0)}%;--c:${cols[i % 4]};--d:${9 + ((i * 7) % 7)}s;--dl:-${(i * 5) % 14}s`;
  });
  return backdropRoot('b', kind, `<div class="b-sky"></div><div class="b-sun"></div>${clouds}<div class="b-hills">${HILLS}</div>${props}${petals}`);
}
