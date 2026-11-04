import { h } from '../../editor/dom';
import type { PuzzleLevel } from '../types';
import { MAP_HEIGHT, buildStops, newlyUnlocked, starTotals, stopPoints, trailPath, unlockedCount, type MapStop } from './map-state';
import { enterFullscreenOnTouch } from './fullscreen';
import type { ProgressMap } from './progress';
import { PUZZLE_UI_TEXT as T } from './puzzle-text';
import { ICONS, createFrame, roundButton, starIcon, svg } from './shell-kit';
import { playSfx } from './sound';
import type { ShellContext } from './title-screen';

/** How many levels the map last showed as open; a level beyond it plays its unlock animation. */
let seenOpen: number | null = null;

/** Records the open levels without animating them (called when the page starts). */
export function rememberOpenLevels(levels: readonly PuzzleLevel[], progress: ProgressMap): void {
  seenOpen = unlockedCount(levels, progress);
}

/** Delay before the first unlock plays (the screen is fading in), and between two of them. */
const UNLOCK_START_MS = 650;
const UNLOCK_GAP_MS = 520;

const stateClass = (s: MapStop['state']): string => `is-${s}`;

function discContent(stop: MapStop, locked: boolean): Node {
  return locked ? svg(ICONS.lock) : document.createTextNode(String(stop.order));
}

/** Level map: a wooden path through the levels, a node for each. */
export function mountMapScreen(root: HTMLElement, ctx: ShellContext & { levels: readonly PuzzleLevel[]; progress: ProgressMap }): () => void {
  const { levels, progress } = ctx;
  const { frame, ui } = createFrame('map', { lampX: 14, bench: true });
  const stops = buildStops(levels, progress);
  const points = stopPoints(stops.length);
  const fresh = new Set(newlyUnlocked(levels, progress, seenOpen ?? stops.length));
  seenOpen = unlockedCount(levels, progress);

  // path
  const d = trailPath(points);
  const trail = svg(`<svg class="pz-trail" viewBox="0 0 100 ${MAP_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="#2b1a10" stroke-width="4.6" stroke-linecap="round" opacity=".55" transform="translate(0 .7)"/>
    <path d="${d}" fill="none" stroke="#4a2d1a" stroke-width="4.2" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#b98550" stroke-width="3.4" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#fff1d0" stroke-width=".45" stroke-linecap="round" stroke-dasharray="1.2 1.6" opacity=".85"/>
  </svg>`);

  // header
  const back = roundButton(ICONS.back, T.backToTitle, () => ctx.go('#/'));
  back.classList.add('pz-map-back');
  const gear = roundButton(ICONS.gear, T.settingsAria, () => ctx.openSettings(frame));
  gear.classList.add('pz-map-gear');
  const title = h('h2', 'pz-map-title', T.mapTitle);
  const { got, max } = starTotals(levels, progress);
  const tally = h('div', 'pz-tally');
  tally.setAttribute('role', 'img');
  tally.setAttribute('aria-label', T.starTotalAria(got, max));
  tally.append(starIcon(true), h('span', '', `${got}/${max}`));

  const list = h('div', 'pz-stops');
  list.setAttribute('role', 'group');
  list.setAttribute('aria-label', T.mapAria);
  const timers: number[] = [];

  stops.forEach((stop, i) => {
    const p = points[i];
    if (!p) return;
    // A level that just opened first shows as locked, then the lock pops open.
    const startsLocked = stop.state === 'locked' || fresh.has(i);
    const btn = h('button', `pz-stop ${stateClass(startsLocked ? 'locked' : stop.state)}`);
    btn.type = 'button';
    btn.style.left = `${p.x}cqw`;
    btn.style.top = `${p.y - 5.5}cqw`;
    btn.setAttribute('aria-label', T.stopAria(stop.order, stop.title, stop.state, stop.stars));
    if (stop.state === 'locked') btn.setAttribute('aria-disabled', 'true');

    const flag = h('span', 'pz-flag', T.nextFlag);
    flag.setAttribute('aria-hidden', 'true');
    const stars = h('span', 'pz-stop-stars');
    stars.setAttribute('aria-hidden', 'true');
    for (let k = 0; k < 3; k++) stars.append(starIcon(k < stop.stars));
    const disc = h('span', 'pz-disc');
    disc.append(discContent(stop, startsLocked));
    const mode = h('span', 'pz-mode', T.modeTag[stop.mode]);
    mode.title = T.viewBadge[stop.mode];
    disc.append(mode);
    const name = h('span', 'pz-stop-name', stop.title);
    btn.append(flag, stars, disc, name);

    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-locked')) {
        btn.classList.remove('shake');
        void btn.offsetWidth; // restart the animation
        btn.classList.add('shake');
        return;
      }
      enterFullscreenOnTouch();
      ctx.go(`#/level/${stop.id}`);
    });
    list.append(btn);

    if (fresh.has(i) && stop.state !== 'locked') {
      const order = [...fresh].indexOf(i);
      timers.push(
        window.setTimeout(() => {
          playSfx('unlock');
          btn.classList.remove('is-locked');
          btn.classList.add(stateClass(stop.state), 'is-unlocking');
          disc.replaceChildren(discContent(stop, false), mode);
          btn.addEventListener('animationend', (e) => {
            if (e.target === disc) btn.classList.remove('is-unlocking');
          });
        }, UNLOCK_START_MS + order * UNLOCK_GAP_MS),
      );
    }
  });

  ui.append(trail, back, gear, title, tally, list);
  root.append(frame);
  return () => {
    for (const t of timers) window.clearTimeout(t);
  };
}
