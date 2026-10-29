import type { GameView } from '../app-contracts';
import type { Board } from '../engine/types';
import {
  createEmptyBoard,
  downloadBoard,
  flushAutosave,
  listSamples,
  loadAutosave,
  pickBoardFile,
  scheduleAutosave,
  takeAutosaveProblem,
} from '../io';
import { createGameView } from '../render/game-view';
import { h, isTypingTarget } from './dom';
import { countUnavailable, createEditorState } from './editor-state';
import { installEntityDrag } from './entity-drag';
import { createKeyboardInput } from './keyboard-input';
import { installLayoutSplitters } from './layout-splitters';
import { createNewGameDialog } from './new-game-dialog';
import { createPalette } from './palette';
import { createPropertiesPanel } from './properties-panel';
import { TEXT_VI } from './text-vi';
import { createTopBar } from './top-bar';
import { createTutorial } from '../tutorial/controller';
import { takeStash } from '../tutorial/storage';
import { TUTORIAL_UI } from '../tutorial/text-vi';
import { createWiringCanvas } from './wiring-canvas';

function loadInitialBoard(): Board {
  try {
    return takeStash() ?? loadAutosave() ?? createEmptyBoard('2d-side');
  } catch {
    return createEmptyBoard('2d-side');
  }
}

/** True when the user has highlighted page text, so Ctrl+C should keep its normal meaning. */
function hasTextSelection(): boolean {
  return (window.getSelection()?.toString() ?? '') !== '';
}

export function mountEditor(root: HTMLElement): void {
  const state = createEditorState(loadInitialBoard());
  const gameView: GameView = createGameView();
  const keyboard = createKeyboardInput();

  const gameBox = h('div', 'game-box');
  const canvas = createWiringCanvas({
    state,
    getRuntime: () => gameView.getRuntime(),
    notify: (t, k) => topBar.notify(t, k),
  });

  const addNoteAtCenter = (): void => {
    const c = canvas.viewCenter();
    const n = state.getNotes().length % 6;
    state.addNote({ x: c.x - 90 + n * 24, y: c.y - 55 + n * 24 });
  };

  const palette = createPalette({
    state,
    onAddNote: addNoteAtCenter,
    onAdd(kind, cx, cy) {
      let pos;
      if (cx !== null && cy !== null) {
        if (!canvas.isOver(cx, cy)) return;
        pos = canvas.clientToWorld(cx, cy);
      } else {
        const c = canvas.viewCenter();
        const n = state.getGraph().nodes.length % 6;
        pos = { x: c.x - 70 + n * 24, y: c.y - 40 + n * 24 };
      }
      state.addNode(kind, pos);
    },
  });

  const dialog = createNewGameDialog((mode) => loadBoard(createEmptyBoard(mode)));

  const topBar = createTopBar({
    state,
    samples: () => listSamples(),
    onNew: () => dialog.open(),
    onTogglePlay: () => state.setPlaying(!state.isPlaying()),
    onSave() {
      if (tutorial.isActive()) return topBar.notify(TUTORIAL_UI.saveBlocked, 'error');
      try {
        downloadBoard(state.getBoard());
        topBar.notify(TEXT_VI.saved);
      } catch (e) {
        topBar.notify(e instanceof Error ? e.message : TEXT_VI.openFailed, 'error');
      }
    },
    onOpenFile() {
      pickBoardFile().then(
        (b) => {
          if (b) loadBoard(b);
        },
        (e: unknown) => topBar.notify(e instanceof Error ? e.message : TEXT_VI.openFailed, 'error'),
      );
    },
    onOpenSample: (b) => loadBoard(structuredClone(b)),
    onAddNote: addNoteAtCenter,
    onChangeMode(mode) {
      state.setMode(mode);
      const n = countUnavailable(state.getGraph(), mode);
      if (n > 0) topBar.notify(TEXT_VI.unavailableNodes(n), 'error');
    },
  });

  const tutorial = createTutorial({ state, notify: (t, k) => topBar.notify(t, k) });
  topBar.addControl(tutorial.el);
  document.body.append(tutorial.panel);

  const props = createPropertiesPanel(state);
  const right = h('div', 'right-col');
  const main = h('div', 'main');
  const splitters = installLayoutSplitters({ main, right, onChange: () => gameView.resize() });
  right.append(gameBox, splitters.horizontal, props);
  main.append(palette, canvas.el, splitters.vertical, right);
  root.replaceChildren(topBar.el, main);
  root.classList.add('app');

  gameView.mount(gameBox);
  installEntityDrag(gameBox, gameView, state);
  const ro = new ResizeObserver(() => gameView.resize());
  ro.observe(gameBox);

  // Sizes depend on laid-out elements, so apply once everything is attached.
  window.dispatchEvent(new Event('resize'));

  // ---------- maximize game view ----------

  const maxBtn = h('button', 'view-max');
  maxBtn.type = 'button';
  function setMaximized(on: boolean): void {
    root.classList.toggle('maximized', on);
    maxBtn.textContent = on ? TEXT_VI.restore : TEXT_VI.maximize;
    maxBtn.title = on ? TEXT_VI.restoreTip : TEXT_VI.maximizeTip;
    gameView.resize();
    requestAnimationFrame(() => gameView.resize());
  }
  maxBtn.addEventListener('click', () => setMaximized(!root.classList.contains('maximized')));
  gameBox.append(maxBtn);
  setMaximized(false);

  function loadBoard(board: Board): void {
    tutorial.exit();
    state.setPlaying(false);
    state.loadBoard(board);
    topBar.notify(TEXT_VI.opened);
  }

  // ---------- preview / play ----------

  let previewTimer = 0;
  function showPreview(): void {
    try {
      gameView.showPreview(state.getGraph(), state.getMode());
    } catch {
      topBar.notify(TEXT_VI.playFailed, 'error');
    }
  }
  function schedulePreview(): void {
    if (state.isPlaying()) return;
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(showPreview, 40);
  }

  function startPlay(): void {
    window.clearTimeout(previewTimer);
    if (document.activeElement instanceof HTMLElement && !isTypingTarget(document.activeElement)) {
      document.activeElement.blur();
    }
    keyboard.attach();
    try {
      gameView.play(state.getGraph(), state.getMode(), () => keyboard.snapshot());
    } catch {
      keyboard.detach();
      topBar.notify(TEXT_VI.playFailed, 'error');
      queueMicrotask(() => state.setPlaying(false));
    }
  }
  function stopPlay(): void {
    gameView.stop();
    keyboard.detach();
    showPreview();
  }

  gameView.onGameEnd((result) => tutorial.noteGameEnd(result));
  gameView.onRestartRequest(() => {
    tutorial.noteRestart();
    if (!state.isPlaying()) return;
    gameView.stop();
    startPlay();
  });

  setInterval(() => {
    if (state.isPlaying()) canvas.refreshBadges();
  }, 100);

  // ---------- state reactions ----------

  state.subscribe((kind) => {
    switch (kind) {
      case 'playing':
        root.classList.toggle('playing', state.isPlaying());
        if (state.isPlaying()) startPlay();
        else stopPlay();
        requestAnimationFrame(() => gameView.resize());
        break;
      case 'board':
        gameView.resetCamera();
        schedulePreview();
        break;
      case 'graph':
      case 'params':
      case 'mode':
        schedulePreview();
        break;
      default:
        break;
    }
    // A lesson board must never replace the learner's own autosave.
    if (kind !== 'selection' && kind !== 'playing' && !tutorial.isActive()) scheduleAutosave(state.getBoard());
  });

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Escape' && root.classList.contains('maximized')) {
      setMaximized(false);
      return;
    }
    if (state.isPlaying()) return;
    if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      setMaximized(!root.classList.contains('maximized'));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'z' || key === 'y') {
        e.preventDefault();
        if (key === 'y' || e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (key === 'c' && !hasTextSelection()) {
        const n = state.copy();
        if (n > 0) {
          e.preventDefault();
          topBar.notify(TEXT_VI.copied(n));
        }
        return;
      }
      if (key === 'v') {
        const n = state.paste();
        if (n > 0) {
          e.preventDefault();
          topBar.notify(TEXT_VI.pasted(n));
        }
        return;
      }
      if (key === 'd') {
        e.preventDefault();
        const n = state.duplicate();
        if (n > 0) topBar.notify(TEXT_VI.duplicated(n));
        return;
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (state.deleteSelection()) e.preventDefault();
    }
  });
  window.addEventListener('pagehide', () => flushAutosave());

  showPreview();
  canvas.fitToContent();
  const problem = takeAutosaveProblem();
  if (problem) topBar.notify(problem, 'error');
}
