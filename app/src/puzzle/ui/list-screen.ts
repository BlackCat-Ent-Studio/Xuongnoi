import { h } from '../../editor/dom';
import type { PuzzleLevel } from '../types';
import { isUnlocked, starsOf, type ProgressMap } from './progress';
import { PUZZLE_UI_TEXT as T } from './puzzle-text';

function starRow(count: 0 | 1 | 2 | 3): HTMLElement {
  const el = h('span', 'pz-stars');
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', T.starsAria(count));
  for (let i = 0; i < 3; i++) el.append(h('i', i < count ? 'on' : ''));
  return el;
}

/** Level list: one card per level, in order; a level opens once the one before it is solved. */
export function mountListScreen(root: HTMLElement, levels: readonly PuzzleLevel[], progress: ProgressMap): void {
  const page = h('div', 'pz-list-page');
  const head = h('header', 'pz-list-head');
  const link = h('a', 'pz-link', T.backToEditor);
  link.href = 'index.html';
  const titles = h('div');
  titles.append(h('h1', '', T.listTitle), h('p', 'pz-lede', T.listLede));
  head.append(link, titles);
  page.append(head);

  if (levels.length === 0) {
    const empty = h('div', 'pz-empty');
    empty.append(h('h2', '', T.emptyList), h('p', '', T.emptyListHint));
    page.append(empty);
    root.replaceChildren(page);
    return;
  }

  const grid = h('ol', 'pz-grid');
  levels.forEach((level, index) => {
    const open = isUnlocked(levels, index, progress);
    const stars = starsOf(progress, level.id);
    const card = open ? h('a', 'pz-card') : h('div', 'pz-card is-locked');
    if (card instanceof HTMLAnchorElement) card.href = `#/level/${level.id}`;
    else card.setAttribute('aria-disabled', 'true');
    const num = h('span', 'pz-num', open ? String(level.order) : '🔒');
    const body = h('span', 'pz-card-body');
    body.append(h('b', '', level.title), h('small', 'pz-view', open ? T.viewBadge[level.mode] : T.locked));
    card.append(num, body, starRow(stars));
    const li = h('li');
    li.append(card);
    grid.append(li);
  });
  page.append(grid);
  root.replaceChildren(page);
}
