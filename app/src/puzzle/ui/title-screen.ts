import { h } from '../../editor/dom';
import { createCharacterStage } from './character-stage';
import { GAME_NAME, PUZZLE_UI_TEXT as T } from './puzzle-text';
import { ICONS, createFrame, svg } from './shell-kit';

export interface ShellContext {
  go(hash: string): void;
  /** Opens the settings dialog on top of `host`. */
  openSettings(host: HTMLElement): void;
}

/** Title screen: the game sign, the three characters on the bench, "Chơi" and "Cài đặt". */
export function mountTitleScreen(root: HTMLElement, ctx: ShellContext): () => void {
  const { frame, ui } = createFrame('title', { lampX: 84, bench: true });

  const sign = h('div', 'pz-sign');
  const plank = h('div', 'pz-plank');
  plank.append(h('h1', 'pz-logo', GAME_NAME), h('p', 'pz-tagline', T.subtitle));
  sign.append(h('i', 'pz-rope left'), h('i', 'pz-rope right'), plank);

  const play = h('button', 'pz-btn pz-play');
  play.type = 'button';
  play.append(svg(ICONS.play), h('span', '', T.play));
  play.addEventListener('click', () => ctx.go('#/map'));

  const settings = h('button', 'pz-btn pz-second pz-settings-btn');
  settings.type = 'button';
  settings.append(svg(ICONS.gear), h('span', '', T.settings));
  settings.addEventListener('click', () => ctx.openSettings(frame));

  const bubble = h('div', 'pz-cat-bubble', T.catSays);
  const tag = h('div', 'pz-cat-tag', T.catName);
  ui.append(sign, play, settings, bubble, tag);

  root.append(frame);
  const stage = createCharacterStage(frame, 'idle');
  return () => stage?.dispose();
}
