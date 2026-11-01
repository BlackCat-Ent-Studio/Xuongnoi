import { h } from '../../editor/dom';
import type { PuzzleLevel } from '../types';
import { createCharacterStage } from './character-stage';
import { startConfetti } from './confetti';
import { starTotals } from './map-state';
import type { ProgressMap } from './progress';
import { GAME_NAME, PUZZLE_UI_TEXT as T } from './puzzle-text';
import { ICONS, createFrame, roundButton, starIcon } from './shell-kit';
import type { ShellContext } from './title-screen';

/** Ending screen after the last level: the characters cheer, the star total, "Về bản đồ". */
export function mountEndingScreen(root: HTMLElement, ctx: ShellContext, levels: readonly PuzzleLevel[], progress: ProgressMap): () => void {
  const { frame, ui } = createFrame('end', { lampX: 50, bench: true });
  const { got, max } = starTotals(levels, progress);

  const sign = h('div', 'pz-sign');
  const plank = h('div', 'pz-plank');
  plank.append(h('h1', 'pz-logo', T.endTitle), h('p', 'pz-tagline', `${GAME_NAME} · ${T.endLede}`));
  sign.append(h('i', 'pz-rope left'), h('i', 'pz-rope right'), plank);

  const tally = h('div', 'pz-end-stars');
  tally.setAttribute('role', 'img');
  tally.setAttribute('aria-label', T.starTotalAria(got, max));
  tally.append(starIcon(true, 'pz-star big'), h('span', '', T.endStars(got, max)));

  const toMap = h('button', 'pz-btn pz-play pz-end-btn', T.endToMap);
  toMap.type = 'button';
  toMap.addEventListener('click', () => ctx.go('#/map'));

  ui.append(roundButton(ICONS.back, T.backToMap, () => ctx.go('#/map')), sign, tally, toMap);
  root.append(frame);
  const stage = createCharacterStage(frame, 'cheer');

  const stops: Array<() => void> = [];
  const timers = [
    window.setTimeout(() => stops.push(startConfetti(frame)), 250),
    window.setTimeout(() => stops.push(startConfetti(frame, 60)), 1900),
  ];
  return () => {
    for (const t of timers) window.clearTimeout(t);
    for (const stop of stops) stop();
    stage?.dispose();
  };
}
