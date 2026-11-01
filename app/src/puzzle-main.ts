import { createGameView } from './render/game-view';
import { registerAllNodes } from './nodes';
import { h } from './editor/dom';
import { PUZZLE_LEVELS } from './puzzle/levels';
import type { PuzzleLevel } from './puzzle/types';
import { createCozyStage } from './puzzle/stage/cozy-stage';
import { mountEndingScreen } from './puzzle/ui/ending-screen';
import { GUIDE_SEEN_KEY } from './puzzle/ui/guide-script';
import { mountLevelScreen, type StageHost } from './puzzle/ui/level-screen';
import { allSolved } from './puzzle/ui/map-state';
import { mountMapScreen, rememberOpenLevels } from './puzzle/ui/map-screen';
import { loadProgress, saveProgress, type ProgressMap } from './puzzle/ui/progress';
import { PUZZLE_UI_TEXT as T } from './puzzle/ui/puzzle-text';
import { parseRoute, routeDepth, sameRoute, type Route } from './puzzle/ui/routes';
import { openSettings } from './puzzle/ui/settings-panel';
import { playSfx, startMusic, unlockAudio } from './puzzle/ui/sound';
import { initTheme } from './puzzle/ui/themes/theme';
import { createScreenHost } from './puzzle/ui/transitions';
import { mountTitleScreen, type ShellContext } from './puzzle/ui/title-screen';
import './puzzle/ui/puzzle.css';
import './puzzle/ui/shell.css';

registerAllNodes();
document.title = T.pageTitle;

const root = document.querySelector<HTMLDivElement>('#puzzle');
if (!root) throw new Error('Missing #puzzle element');
const screens = createScreenHost(root);

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
let levels: readonly PuzzleLevel[] = [];
let current: Route | null = null;
/** Closes the open settings dialog (it belongs to the screen that opened it). */
let closeSettings: (() => void) | null = null;

function ensureStage(): StageHost {
  if (stage) return stage;
  const el = h('div', 'pz-stage-host');
  // Transparent canvas: the stage shows its themed backdrop (or the plain mint stage colour) around the scene.
  const view = createGameView({ transparentStage: true, stage: createCozyStage() });
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

/** Wipes the stars and the remembered tutorial steps; the dialog calls this and the screen refreshes when it closes. */
let resetPending = false;
function resetProgress(): void {
  progress = {};
  saveProgress(progress);
  try {
    localStorage.removeItem(GUIDE_SEEN_KEY);
  } catch {
    // storage blocked: nothing was saved either
  }
  rememberOpenLevels(levels, progress);
  resetPending = true;
}

function showSettings(host: HTMLElement): void {
  closeSettings?.();
  closeSettings = openSettings(host, {
    onReset: resetProgress,
    onClose() {
      closeSettings = null;
      if (!resetPending) return;
      resetPending = false;
      if (current?.name === 'map') route();
      else if (current?.name === 'level') go('#/map');
    },
  });
}

const shell: ShellContext = { go, openSettings: showSettings };

function route(): void {
  closeSettings?.();
  const next = parseRoute(location.hash);
  if (next.name === 'level') {
    const index = levels.findIndex((l) => l.id === next.id);
    const level = levels[index];
    const unlocked = index === 0 || (level !== undefined && (progress[levels[index - 1]?.id ?? '']?.stars ?? 0) > 0);
    if (!level || !unlocked) {
      location.replace('#/map');
      return;
    }
  }
  if (next.name === 'end' && !allSolved(levels, progress)) {
    location.replace('#/map');
    return;
  }
  const dir = current === null || sameRoute(current, next) ? 0 : routeDepth(next) >= routeDepth(current) ? 1 : -1;
  current = next;
  document.body.classList.toggle('pz-in-level', next.name === 'level');
  startMusic(next.name === 'level' ? 'level' : 'menu');

  switch (next.name) {
    case 'title':
      screens.show((el) => mountTitleScreen(el, shell), dir);
      break;
    case 'map':
      screens.show((el) => mountMapScreen(el, { ...shell, levels, progress }), dir);
      break;
    case 'end':
      screens.show((el) => mountEndingScreen(el, shell, levels, progress), dir);
      break;
    case 'level': {
      const index = levels.findIndex((l) => l.id === next.id);
      const level = levels[index];
      if (!level) return;
      screens.show((el) => {
        const teardown = mountLevelScreen(el, {
          level,
          next: levels[index + 1] ?? null,
          stage: ensureStage(),
          progress: () => progress,
          saveProgress(map) {
            progress = map;
            saveProgress(map);
          },
          go,
          openSettings: showSettings,
        });
        stage?.view.resetCamera();
        return teardown;
      }, dir);
      break;
    }
  }
}

// Browsers only start sound after a tap or key press.
function unlockOnce(): void {
  document.removeEventListener('pointerdown', unlockOnce, true);
  document.removeEventListener('keydown', unlockOnce, true);
  unlockAudio();
}
document.addEventListener('pointerdown', unlockOnce, true);
document.addEventListener('keydown', unlockOnce, true);

// One soft "tap" for every button, except the ones that make their own sound.
const OWN_SOUND = '.pz-chip, .pz-hint-btn, .pz-x, .pz-btn.run';
document.addEventListener(
  'click',
  (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const control = target.closest('button, a[href]');
    if (control && !control.matches(OWN_SOUND)) playSfx('tap');
  },
  true,
);

window.addEventListener('hashchange', route);
void Promise.all([initTheme(), loadLevels()]).then(
  ([, list]) => {
    levels = list;
    rememberOpenLevels(levels, progress);
    route();
  },
  (err) => {
    console.error(err);
    route();
  },
);
