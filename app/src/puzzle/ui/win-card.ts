import { h } from '../../editor/dom';
import { startConfetti } from './confetti';
import { PUZZLE_UI_TEXT as T } from './puzzle-text';
import { playSfx } from './sound';

export interface WinCardOptions {
  /** The positioned screen the overlay covers. */
  screen: HTMLElement;
  stars: 1 | 2 | 3;
  /** The line under the stars. */
  note: string;
  onNext(): void;
  onRetry(): void;
  onMap(): void;
}

/** Each star pops in this long after the one before it. */
const STAR_GAP_MS = 380;
const STAR_FIRST_MS = 420;

/**
 * The win overlay: a confetti burst, the stars popping in one by one (a chime each), then the buttons
 * "Màn tiếp" (the main one, after the last level it opens the ending), "Chơi lại" and "Bản đồ".
 */
export function showWinCard(opts: WinCardOptions): HTMLElement {
  const { stars } = opts;
  const card = h('div', 'pz-win-card');
  const starRow = h('span', 'pz-stars big pop-in');
  starRow.setAttribute('role', 'img');
  starRow.setAttribute('aria-label', T.starsAria(stars));
  for (let i = 0; i < 3; i++) {
    const star = h('i', i < stars ? 'on' : '');
    star.style.setProperty('--pop-delay', `${STAR_FIRST_MS + i * STAR_GAP_MS}ms`);
    starRow.append(star);
  }

  const nextBtn = h('button', 'pz-btn run', T.winNext);
  nextBtn.type = 'button';
  nextBtn.addEventListener('click', opts.onNext);
  const retry = h('button', 'pz-btn ghost', T.winRetry);
  retry.type = 'button';
  retry.addEventListener('click', opts.onRetry);
  const map = h('button', 'pz-btn ghost', T.winMap);
  map.type = 'button';
  map.addEventListener('click', opts.onMap);
  const row = h('div', 'pz-win-row');
  row.append(retry, map);

  card.append(h('h3', '', T.winTitle), starRow, h('p', '', opts.note), nextBtn, row);
  const overlay = h('div', 'pz-win');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', T.winTitle);
  overlay.append(card);
  opts.screen.append(overlay);
  nextBtn.focus();

  startConfetti(overlay);
  for (let i = 0; i < stars; i++) {
    window.setTimeout(() => {
      if (overlay.isConnected) playSfx('star');
    }, STAR_FIRST_MS + i * STAR_GAP_MS + 120);
  }
  return overlay;
}
