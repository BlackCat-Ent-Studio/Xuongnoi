import { createGameView } from './render/game-view';
import { registerAllNodes } from './nodes';
import { h } from './editor/dom';
import { PUZZLE_LEVELS } from './puzzle/levels';
import type { PuzzleLevel } from './puzzle/types';
import { mountLevelScreen, type StageHost } from './puzzle/ui/level-screen';
import { mountListScreen } from './puzzle/ui/list-screen';
import { loadProgress, saveProgress, type ProgressMap } from './puzzle/ui/progress';
import { PUZZLE_UI_TEXT as T } from './puzzle/ui/puzzle-text';
import './puzzle/ui/puzzle.css';

registerAllNodes();
document.title = T.pageTitle;

const root = document.querySelector<HTMLDivElement>('#puzzle');
if (!root) throw new Error('Missing #puzzle element');
const page: HTMLElement = root;

/** Levels shown to the player. A development-only `?fixture` flag adds a sample level that is never shipped. */
async function loadLevels(): Promise<readonly PuzzleLevel[]> {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('fixture')) {
    const { doorFixture } = await import('../tests/puzzle/fixtures/door-fixture');
    return [...PUZZLE_LEVELS, doorFixture];
  }
  return PUZZLE_LEVELS;
}

let progress: ProgressMap = loadProgress();
let stage: StageHost | null = null;
let teardown: (() => void) | null = null;

function ensureStage(): StageHost {
  if (stage) return stage;
  const el = h('div', 'pz-stage-host');
  const view = createGameView();
  view.mount(el);
  const host: StageHost = { el, view, onEnd: null };
  view.onGameEnd((result, message) => host.onEnd?.(result, message));
  view.onRestartRequest(() => undefined);
  stage = host;
  return host;
}

function go(hash: string): void {
  if (location.hash === hash || (hash === '#/' && location.hash === '')) route();
  else location.hash = hash;
}

let levels: readonly PuzzleLevel[] = [];

function route(): void {
  teardown?.();
  teardown = null;
  const m = /^#\/level\/(.+)$/.exec(location.hash);
  const id = m?.[1] ? decodeURIComponent(m[1]) : null;
  document.body.classList.toggle('pz-in-level', id !== null);
  if (id === null) {
    mountListScreen(page, levels, progress);
    return;
  }
  const index = levels.findIndex((l) => l.id === id);
  const level = levels[index];
  const unlocked = index === 0 || (level !== undefined && (progress[levels[index - 1]?.id ?? '']?.stars ?? 0) > 0);
  if (!level || !unlocked) {
    location.replace('#/');
    return;
  }
  teardown = mountLevelScreen(page, {
    level,
    next: levels[index + 1] ?? null,
    stage: ensureStage(),
    progress: () => progress,
    saveProgress(map) {
      progress = map;
      saveProgress(map);
    },
    go,
  });
  stage?.view.resetCamera();
}

window.addEventListener('hashchange', route);
void loadLevels().then(
  (list) => {
    levels = list;
    route();
  },
  (err) => {
    console.error(err);
    route();
  },
);
