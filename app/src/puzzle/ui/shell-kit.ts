import { h } from '../../editor/dom';
import { buildBackdrop } from './themes/theme';

/** Small pieces shared by the title, map and ending screens: the framed scene, code-drawn icons, stars. */

const STAR_PTS = '12,1.8 15,8.6 22.4,9.3 16.8,14.2 18.5,21.6 12,17.7 5.5,21.6 7.2,14.2 1.6,9.3 9,8.6';

export const ICONS = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#3a2a1c" stroke-width="2.6" stroke-linecap="round"/><rect x="4.5" y="10.5" width="15" height="11" rx="3" fill="#d9bd84" stroke="#3a2a1c" stroke-width="2"/><circle cx="12" cy="15.5" r="1.6" fill="#3a2a1c"/></svg>',
} as const;

/** Parses a small trusted SVG string (the constants above) into an element. */
export function svg(markup: string): Element {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const el = t.content.firstElementChild;
  if (!el) throw new Error('Bad icon markup');
  return el;
}

export function starIcon(on: boolean, className = 'pz-star'): Element {
  return svg(`<svg class="${className}${on ? ' on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="${STAR_PTS}"/></svg>`);
}

/** Round wooden button holding an icon (back, settings). */
export function roundButton(icon: string, label: string, onClick: () => void): HTMLButtonElement {
  const btn = h('button', 'pz-rbtn');
  btn.type = 'button';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.append(svg(icon));
  btn.addEventListener('click', onClick);
  return btn;
}

// The wooden bench along the bottom of the title and map: tabletop, a potted plant, a mug and an open book.
const BENCH = `<svg viewBox="0 0 844 390" preserveAspectRatio="none" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">
  <rect x="-20" y="338" width="884" height="70" fill="#8a5a34"/><rect x="-20" y="338" width="884" height="10" fill="#c8955a"/>
  <path d="M-20 348h884" stroke="#3a2417" stroke-width="3"/>
  <g stroke="#3a2417" stroke-width="2" opacity=".35"><path d="M150 356h120M420 366h160M690 358h110"/></g>
  <g class="pz-props" stroke="#2b1a10" stroke-width="3">
  <path d="M360 338l-6-34h40l-6 34z" fill="#c8714a"/><ellipse cx="374" cy="304" rx="22" ry="5" fill="#a85a38"/>
  <path d="M374 300c-14-16-14-30-10-44 10 12 14 26 10 44zM374 300c12-18 24-22 32-32-2 16-12 28-32 32zM374 300c-18-8-30-8-38-20 14-2 30 4 38 20z" fill="#93b58c"/>
  <path d="M470 338v-26h26v26z" fill="#fff1d0"/><path d="M496 318q10 0 10 8t-10 8" fill="none"/><rect x="470" y="312" width="26" height="6" fill="#e8c46a" stroke="none"/>
  <path d="M520 338q12-12 24-4q14-10 24 4z" fill="#e8c88a" stroke-width="2.5"/>
  </g></svg>`;

export interface ShellFrame {
  frame: HTMLElement;
  /** Everything the player touches goes here (above the backdrop and the characters). */
  ui: HTMLElement;
}

export interface FrameOptions {
  /** Where the swinging lamp hangs, in percent of the width. */
  lampX: number;
  /** Draw the bench along the bottom. */
  bench: boolean;
}

/** The framed 844:390 scene of a shell screen with its wooden backdrop. */
export function createFrame(kind: 'title' | 'map' | 'end', opts: FrameOptions): ShellFrame {
  const frame = h('div', `pz-frame pz-s-${kind}`);
  const bg = buildBackdrop('page');
  // The page backdrop is sized for the whole window; here it fills the frame and is sized by the frame's width.
  bg.classList.replace('pz-bg-page', 'pz-bg-scene');
  const lamp = bg.querySelector<HTMLElement>('.a-lamp');
  if (lamp) lamp.style.left = `${opts.lampX}%`;
  frame.append(bg);
  if (opts.bench) {
    const bench = h('div', 'pz-bench');
    bench.setAttribute('aria-hidden', 'true');
    bench.append(svg(BENCH));
    frame.append(bench);
  }
  const ui = h('div', 'pz-ui');
  frame.append(ui);
  return { frame, ui };
}
