/**
 * TEMPORARY THEME TRIAL. Lets the user compare three candidate looks (A, B, C) on the real levels.
 * Remove this file, the floating switcher, `themes/` and the two hook-up lines in puzzle-main.ts / level-screen.ts
 * once one look is chosen. With nothing chosen ("—") the page keeps its original look.
 */
import { h } from '../../../editor/dom';
import { buildBackdrop, THEME_IDS, type ThemeId } from './backdrops';
import './theme-trial.css';

export type { ThemeId } from './backdrops';

const STORAGE_KEY = 'xuongnoi.puzzle.themeTrial';
const NAMES: Record<ThemeId, string> = { a: 'Xưởng gỗ ấm áp', b: 'Đồi cỏ trời xanh', c: 'Đêm sao dịu' };

let current: ThemeId | null = null;
let pageBackdrop: HTMLElement | null = null;
const listeners = new Set<(theme: ThemeId | null) => void>();

function asTheme(value: string | null | undefined): ThemeId | null {
  const v = value?.trim().toLowerCase();
  return THEME_IDS.find((id) => id === v) ?? null;
}

function readStored(): ThemeId | null {
  try {
    return asTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null; // storage blocked: behave like nothing chosen
  }
}

function store(theme: ThemeId | null): void {
  try {
    if (theme) localStorage.setItem(STORAGE_KEY, theme);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the choice just lasts until reload
  }
}

export function currentTheme(): ThemeId | null {
  return current;
}

/** Calls `cb` whenever the chosen theme changes. Returns the unsubscribe function. */
export function onThemeChange(cb: (theme: ThemeId | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply(theme: ThemeId | null): void {
  current = theme;
  for (const id of THEME_IDS) document.body.classList.toggle(`pz-theme-${id}`, id === theme);
  pageBackdrop?.remove();
  pageBackdrop = theme ? buildBackdrop(theme, 'page') : null;
  if (pageBackdrop) document.body.prepend(pageBackdrop);
  for (const cb of [...listeners]) cb(theme);
}

export function setTheme(theme: ThemeId | null): void {
  if (theme === current) return;
  store(theme);
  apply(theme);
}

/** Reads `?theme=a|b|c` (or the remembered choice), applies it and mounts the floating switcher. */
export function initThemeTrial(): void {
  const param = new URLSearchParams(location.search).get('theme');
  const fromUrl = asTheme(param);
  if (fromUrl) store(fromUrl);
  else if (param !== null) store(null); // ?theme=none (or anything else) goes back to the original look
  apply(fromUrl ?? (param !== null ? null : readStored()));

  const bar = h('div', 'pz-theme-switch');
  bar.setAttribute('role', 'radiogroup');
  bar.setAttribute('aria-label', 'Thử giao diện (tạm thời)');
  const buttons = new Map<ThemeId | null, HTMLButtonElement>();
  const options: Array<[ThemeId | null, string, string]> = [
    [null, '—', 'Giao diện gốc'],
    ...THEME_IDS.map((id): [ThemeId, string, string] => [id, id.toUpperCase(), `${id.toUpperCase()}: ${NAMES[id]}`]),
  ];
  for (const [id, label, title] of options) {
    const btn = h('button', 'pz-theme-opt', label);
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', title);
    btn.title = title;
    btn.addEventListener('click', () => setTheme(id));
    buttons.set(id, btn);
    bar.append(btn);
  }
  const sync = (theme: ThemeId | null): void => {
    for (const [id, btn] of buttons) btn.setAttribute('aria-checked', String(id === theme));
  };
  onThemeChange(sync);
  sync(current);
  document.body.append(bar);
}
