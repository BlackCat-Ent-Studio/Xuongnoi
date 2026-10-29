import type { GameView } from '../app-contracts';
import { VIEW_MODES, type Board, type ViewMode } from '../engine/types';
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
import { CONSOLE_TEXT } from './console/console-text-vi';
import { mountConsoleDock, type ConsoleDock, type LogKind } from './console-dock';
import { h, isTypingTarget } from './dom';
import { countUnavailable, createEditorState } from './editor-state';
import { mountSceneTree } from './scene-tree';
import { DOCK_CONSOLE_ID, DOCK_LESSONS_ID, DOCK_SCENE_ID, createDock, createMount } from './dock-tabs';
import { installEntityDrag } from './entity-drag';
import { mountIconSprite } from './icons';
import { createKeyboardInput } from './keyboard-input';
import { LAYOUT_PRESETS } from './layout-model';
import { installLayoutSplitters } from './layout-splitters';
import type { MenuDef } from './menu-bar';
import { createNewGameDialog } from './new-game-dialog';
import { findFreeNoteSpot } from './note-placement';
import { createPalette } from './palette';
import { createPropertiesPanel } from './properties-panel';
import { PRESET_LABELS, SHELL_TEXT } from './shell-text-vi';
import { MODE_LABELS, TEXT_VI } from './text-vi';
import { createTopBar } from './top-bar';
import { createTutorial } from '../tutorial/controller';
import { takeStash } from '../tutorial/storage';
import { TUTORIAL_UI } from '../tutorial/text-vi';
import { createWiringCanvas } from './wiring-canvas';

export { DOCK_CONSOLE_ID, DOCK_LESSONS_ID, DOCK_SCENE_ID };

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

  let consoleDock: ConsoleDock | null = null;
  const log = (kind: LogKind, text: string): void => consoleDock?.log(kind, text);
  /** Logs at most once per `ms` for a given key, so slider drags and key repeats do not flood the log. */
  const lastLogged = new Map<string, number>();
  const logThrottled = (key: string, ms: number, kind: LogKind, text: string): boolean => {
    const now = Date.now();
    if (now - (lastLogged.get(key) ?? 0) < ms) return false;
    lastLogged.set(key, now);
    log(kind, text);
    return true;
  };

  const gameBox = h('div', 'game-box');
  const canvas = createWiringCanvas({
    state,
    getRuntime: () => gameView.getRuntime(),
    notify: (t, k) => topBar.notify(t, k),
  });

  const addNoteAtCenter = (): void => {
    const c = canvas.viewCenter();
    const n = state.getNotes().length % 6;
    state.addNote(findFreeNoteSpot({ x: c.x - 90 + n * 24, y: c.y - 55 + n * 24 }, state.getGraph(), state.getNotes()));
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

  mountIconSprite();
  const dialog = createNewGameDialog((mode) => loadBoard(createEmptyBoard(mode)));
  const props = createPropertiesPanel(state, {
    onLiveParamChange(nodeId, params) {
      if (gameView.applyNodeParams(nodeId, params)) {
        logThrottled('live-ok', 1500, 'info', CONSOLE_TEXT.logLiveApplied);
      } else if (logThrottled('live-defer', 1500, 'warn', CONSOLE_TEXT.logLiveDeferred)) {
        topBar.notify(CONSOLE_TEXT.logLiveDeferred);
      }
    },
  });

  // ---------- docks ----------

  const work = h('main', 'work');
  let pendingFit = false;
  const isShown = (el: HTMLElement): boolean => el.offsetParent !== null;

  /** Game view and canvas measure themselves from layout, so any dock or tab change re-measures them. */
  function relayout(): void {
    gameView.resize();
    requestAnimationFrame(() => {
      gameView.resize();
      if (pendingFit && isShown(canvas.el)) {
        pendingFit = false;
        canvas.fitToContent();
      }
    });
  }

  const sceneMount = createMount(DOCK_SCENE_ID, SHELL_TEXT.scenePlaceholder);
  mountSceneTree(sceneMount, state, (nodeId) => {
    if (isShown(canvas.el)) canvas.centerOn(nodeId);
  });
  const leftDock = createDock({
    className: 'dock-left',
    ariaLabel: SHELL_TEXT.dockLeftAria,
    initial: 'palette',
    tabs: [
      { id: 'scene', label: SHELL_TEXT.tabScene, icon: 'tree', panel: sceneMount },
      { id: 'palette', label: SHELL_TEXT.tabPalette, icon: 'blocks', panel: palette },
    ],
    onSelect: () => {
      if (layout.leftCollapsed()) layout.setLeftCollapsed(false);
    },
  });

  const centerDock = createDock({
    className: 'dock-center',
    ariaLabel: SHELL_TEXT.dockCenterAria,
    initial: 'graph',
    tabs: [
      { id: 'game', label: SHELL_TEXT.tabGame, icon: 'game', panel: gameBox },
      { id: 'graph', label: SHELL_TEXT.tabGraph, icon: 'graph', panel: canvas.el },
    ],
    onSelect: relayout,
  });
  const liveChip = h('span', 'livechip');
  liveChip.append(h('i'), h('span', '', SHELL_TEXT.liveChip));
  centerDock.bar.append(liveChip);

  const rightDock = createDock({
    className: 'dock-right',
    ariaLabel: SHELL_TEXT.dockRightAria,
    initial: 'props',
    tabs: [{ id: 'props', label: SHELL_TEXT.tabProps, icon: 'sliders', panel: props }],
  });

  const bottomDock = createDock({
    className: 'dock-bottom',
    ariaLabel: SHELL_TEXT.dockBottomAria,
    initial: 'console',
    tabs: [
      { id: 'console', label: SHELL_TEXT.tabConsole, icon: 'term', panel: createMount(DOCK_CONSOLE_ID, SHELL_TEXT.consolePlaceholder) },
      { id: 'lessons', label: SHELL_TEXT.tabLessons, icon: 'book', panel: createMount(DOCK_LESSONS_ID, SHELL_TEXT.lessonsPlaceholder) },
    ],
    onSelect: () => layout.ensureBottomOpen(),
  });

  const mid = h('div', 'mid');
  const layout = installLayoutSplitters({ work, onChange: relayout });
  mid.append(centerDock.el, layout.bottom, bottomDock.el);
  work.append(leftDock.el, layout.left, mid, layout.right, rightDock.el);

  function showCenter(which: 'game' | 'graph'): void {
    centerDock.select(which);
    relayout();
  }

  // ---------- help dialog ----------

  function openHelp(): void {
    topBar.closeMenus();
    const dlg = h('dialog', 'help-dialog');
    const head = h('div', 'dh');
    head.append(h('h2', '', SHELL_TEXT.helpTitle));
    const close = h('button', 'btn ghost', SHELL_TEXT.helpClose);
    close.type = 'button';
    close.addEventListener('click', () => dlg.close());
    head.append(close);
    const dl = h('dl', 'help-rows');
    for (const [keys, what] of SHELL_TEXT.helpRows) {
      dl.append(h('dt', '', keys), h('dd', '', what));
    }
    dlg.append(head, dl);
    dlg.addEventListener('close', () => dlg.remove());
    document.body.append(dlg);
    dlg.showModal();
  }

  // ---------- top bar + menus ----------

  const menus: MenuDef[] = [
    {
      id: 'file',
      label: SHELL_TEXT.menuFile,
      entries: () => [
        { type: 'item', label: SHELL_TEXT.fileNew, onSelect: () => dialog.open() },
        { type: 'item', label: SHELL_TEXT.fileOpen, onSelect: openFile },
        { type: 'item', label: SHELL_TEXT.fileSave, onSelect: saveToFile },
        { type: 'separator' },
        { type: 'heading', label: SHELL_TEXT.fileSamples },
        ...(listSamples().length === 0
          ? [{ type: 'heading', label: TEXT_VI.noSamples } as const]
          : listSamples().map((s) => ({
              type: 'item' as const,
              label: s.label,
              onSelect: () => loadBoard(structuredClone(s.board)),
            }))),
        { type: 'separator' },
        { type: 'heading', label: SHELL_TEXT.fileViewAngle },
        ...VIEW_MODES.map((m) => ({
          type: 'item' as const,
          label: MODE_LABELS[m],
          checked: state.getMode() === m,
          disabled: state.isPlaying(),
          onSelect: () => changeMode(m),
        })),
      ],
    },
    {
      id: 'edit',
      label: SHELL_TEXT.menuEdit,
      entries: () => [
        { type: 'item', label: SHELL_TEXT.editUndo, hint: 'Ctrl+Z', disabled: !state.canUndo(), onSelect: () => state.undo() },
        { type: 'item', label: SHELL_TEXT.editRedo, hint: 'Ctrl+Y', disabled: !state.canRedo(), onSelect: () => state.redo() },
        { type: 'separator' },
        { type: 'item', label: SHELL_TEXT.editAddNote, disabled: state.isPlaying(), onSelect: addNoteAtCenter },
        {
          type: 'item',
          label: SHELL_TEXT.editDuplicate,
          hint: 'Ctrl+D',
          disabled: state.isPlaying(),
          onSelect: () => {
            const n = state.duplicate();
            if (n > 0) topBar.notify(TEXT_VI.duplicated(n));
          },
        },
        {
          type: 'item',
          label: SHELL_TEXT.editDelete,
          hint: 'Delete',
          disabled: state.isPlaying(),
          onSelect: () => void state.deleteSelection(),
        },
      ],
    },
    {
      id: 'view',
      label: SHELL_TEXT.menuView,
      entries: () => {
        const split = layout.preset() === 'split';
        return [
          { type: 'item', label: SHELL_TEXT.viewGame, checked: split || centerDock.selected() === 'game', onSelect: () => showCenter('game') },
          { type: 'item', label: SHELL_TEXT.viewGraph, checked: split || centerDock.selected() === 'graph', onSelect: () => showCenter('graph') },
          { type: 'item', label: SHELL_TEXT.viewMaximize, hint: 'F', onSelect: () => setMaximized(!root.classList.contains('maximized')) },
          { type: 'separator' },
          { type: 'heading', label: SHELL_TEXT.viewLayout },
          ...LAYOUT_PRESETS.map((p) => ({
            type: 'item' as const,
            label: PRESET_LABELS[p],
            checked: layout.preset() === p,
            onSelect: () => layout.setPreset(p),
          })),
          { type: 'separator' },
          { type: 'item', label: SHELL_TEXT.viewLeftDock, checked: !layout.leftCollapsed(), onSelect: () => layout.setLeftCollapsed(!layout.leftCollapsed()) },
        ];
      },
    },
    {
      id: 'help',
      label: SHELL_TEXT.menuHelp,
      entries: () => [{ type: 'item', label: SHELL_TEXT.helpShortcuts, onSelect: openHelp }],
    },
  ];

  function saveToFile(): void {
    if (tutorial.isActive()) return topBar.notify(TUTORIAL_UI.saveBlocked, 'error');
    try {
      downloadBoard(state.getBoard());
      topBar.notify(TEXT_VI.saved);
    } catch (e) {
      topBar.notify(e instanceof Error ? e.message : TEXT_VI.openFailed, 'error');
    }
  }
  function openFile(): void {
    pickBoardFile().then(
      (b) => {
        if (b) loadBoard(b);
      },
      (e: unknown) => topBar.notify(e instanceof Error ? e.message : TEXT_VI.openFailed, 'error'),
    );
  }
  function changeMode(mode: ViewMode): void {
    state.setMode(mode);
    const n = countUnavailable(state.getGraph(), mode);
    if (n > 0) topBar.notify(TEXT_VI.unavailableNodes(n), 'error');
  }

  const topBar = createTopBar({
    state,
    menus,
    onPlay: () => state.setPlaying(true),
    onStop: () => state.setPlaying(false),
    onPause: () => (gameView.isPaused() ? gameView.resume() : gameView.pause()),
    onStep: () => {
      gameView.stepFrame();
      logThrottled('step', 400, 'info', CONSOLE_TEXT.logStep);
    },
    onRestart: restartPlay,
    onNotify: (text, kind) => log(kind, text),
    onHelp: openHelp,
    onPresetChange: (p) => layout.setPreset(p),
    initialPreset: layout.preset(),
  });
  layout.onPrefsChange(() => topBar.setPreset(layout.preset()));

  const tutorial = createTutorial({ state, notify: (t, k) => topBar.notify(t, k) });
  topBar.addControl(tutorial.el);
  document.body.append(tutorial.panel);

  root.replaceChildren(topBar.el, work);
  root.classList.add('app');
  consoleDock = mountConsoleDock({
    state,
    onView(nodeId) {
      if (!isShown(canvas.el)) showCenter('graph');
      state.select({ kind: 'node', id: nodeId });
      canvas.centerOn(nodeId);
      canvas.el.focus({ preventScroll: true });
    },
  });

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
    if (on && !isShown(gameBox)) showCenter('game');
    root.classList.toggle('maximized', on);
    maxBtn.textContent = on ? TEXT_VI.restore : TEXT_VI.maximize;
    maxBtn.title = on ? TEXT_VI.restoreTip : TEXT_VI.maximizeTip;
    relayout();
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

  function restartPlay(): void {
    if (!state.isPlaying()) return;
    gameView.stop();
    startPlay();
    log('info', CONSOLE_TEXT.logRestart);
  }

  gameView.onGameEnd((result, message) => {
    tutorial.noteGameEnd(result);
    if (result === 'win') log('ok', CONSOLE_TEXT.logWin(message));
    else log('warn', CONSOLE_TEXT.logLose(message));
  });
  gameView.onPauseChange((paused) => {
    root.classList.toggle('paused', paused);
    topBar.setPaused(paused);
    if (state.isPlaying()) log('info', paused ? CONSOLE_TEXT.logPause : CONSOLE_TEXT.logResume);
  });
  gameView.onRestartRequest(() => {
    tutorial.noteRestart();
    restartPlay();
  });

  // Structure is locked while the game runs; dragging from a port is the one edit gesture the canvas ignores silently.
  const notifyStructureLocked = (): void => {
    if (logThrottled('locked', 2000, 'warn', CONSOLE_TEXT.blockedStructure)) topBar.notify(CONSOLE_TEXT.blockedStructure);
  };
  canvas.el.addEventListener(
    'pointerdown',
    (e) => {
      if (state.isPlaying() && e.target instanceof Element && e.target.closest('.wc-port')) notifyStructureLocked();
    },
    true,
  );

  setInterval(() => {
    if (state.isPlaying()) canvas.refreshBadges();
  }, 100);

  // ---------- state reactions ----------

  // Playing shows the game even when the wiring board was the open tab; stopping goes back.
  let switchedForPlay = false;
  function followPlayState(playing: boolean): void {
    if (playing) {
      if (layout.preset() !== 'split' && centerDock.selected() === 'graph') {
        switchedForPlay = true;
        showCenter('game');
      }
    } else if (switchedForPlay) {
      switchedForPlay = false;
      if (centerDock.selected() === 'game') showCenter('graph');
    }
  }

  state.subscribe((kind) => {
    switch (kind) {
      case 'playing':
        root.classList.toggle('playing', state.isPlaying());
        if (!state.isPlaying()) root.classList.remove('paused');
        followPlayState(state.isPlaying());
        if (state.isPlaying()) {
          startPlay();
          const open = consoleDock?.issueCount() ?? 0;
          log('info', CONSOLE_TEXT.logPlayStart + (open > 0 ? ` (còn ${open} việc cần sửa)` : ''));
        } else {
          stopPlay();
          log('info', CONSOLE_TEXT.logPlayStop);
        }
        relayout();
        break;
      case 'board':
        gameView.resetCamera();
        schedulePreview();
        // A board loaded while the canvas is hidden is fitted when it next appears.
        if (!isShown(canvas.el)) pendingFit = true;
        // Lessons point at palette blocks, so the palette must be reachable.
        if (tutorial.isActive() && layout.leftCollapsed()) layout.setLeftCollapsed(false);
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
    const saves = !tutorial.isActive();
    if (kind !== 'selection' && kind !== 'playing') {
      topBar.noteDocumentChange({ saves });
      if (saves) scheduleAutosave(state.getBoard());
    }
  });

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (!e.repeat) state.setPlaying(!state.isPlaying());
      return;
    }
    if (e.key === 'Escape' && root.classList.contains('maximized')) {
      setMaximized(false);
      return;
    }
    if (state.isPlaying()) {
      const k = e.key.toLowerCase();
      const editKey = e.key === 'Delete' || e.key === 'Backspace' || ((e.ctrlKey || e.metaKey) && (k === 'v' || k === 'd'));
      if (editKey) notifyStructureLocked();
      return;
    }
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
