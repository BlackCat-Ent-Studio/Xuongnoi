import type { GameView } from '../app-contracts';
import { runnableGraph } from '../circuits/runnable';
import { type Board, type ViewMode } from '../engine/types';
import {
  clearAutosave,
  createEmptyBoard,
  deleteGame,
  downloadBoard,
  duplicateGame,
  ensureLibrary,
  flushAutosave,
  getCurrentGameId,
  LIBRARY_NAME_MAX,
  listSamples,
  loadAutosave,
  loadGame,
  pickBoardFile,
  renameGame,
  scheduleAutosave,
  setCurrentGameId,
  takeAutosaveProblem,
} from '../io';
import { createGameView } from '../render/game-view';
import { isEnergyEnabled, setEnergyEnabled } from './graph/wire-energy';
import { circuitFromSelection, placeInstance } from './circuits/circuit-actions';
import { createCircuitPalette } from './circuits/circuit-palette';
import { CIRCUIT_VI } from './circuits/circuit-text-vi';
import { CONSOLE_TEXT } from './console/console-text-vi';
import { mountConsoleDock, type ConsoleDock, type LogKind } from './console-dock';
import { h, isTypingTarget } from './dom';
import { countUnavailable, createEditorState } from './editor-state';
import { mountSceneTree } from './scene-tree';
import { DOCK_CONSOLE_ID, DOCK_LESSONS_ID, DOCK_SCENE_ID, createDock, createMount } from './dock-tabs';
import { installEntityDrag } from './entity-drag';
import { createGamePip } from './game-pip';
import { mountIconSprite } from './icons';
import { GROUP_VI } from './groups/group-text-vi';
import { createKeyboardInput } from './keyboard-input';
import { createHandbookDialog } from '../handbook/handbook-dialog';
import { HANDBOOK_OPEN_EVENT } from '../handbook/handbook-request';
import { createLibraryDialog } from './library-dialog';
import { LIBRARY_TEXT } from './library-text-vi';
import { LAYOUT_PRESETS } from './layout-model';
import { installLayoutSplitters } from './layout-splitters';
import type { MenuDef } from './menu-bar';
import { mountLaunchpad } from './launchpad';
import { createNewGameDialog } from './new-game-dialog';
import { findFreeNoteSpot } from './note-placement';
import { createPalette } from './palette';
import { createPropertiesPanel } from './properties-panel';
import { PANELS_TEXT_VI } from './panels/panels-text-vi';
import { PRESET_LABELS, SHELL_TEXT } from './shell-text-vi';
import { TEXT_VI } from './text-vi';
import { relayoutShipped } from './graph/shipped-layout';
import './theme/ui-c-shell.css';
import './theme/ui-c-board.css';
import { uiPrefs } from './theme/ui-prefs';
import { createTopBar } from './top-bar';
import { createTutorial } from '../tutorial/controller';
import { takeStash } from '../tutorial/storage';
import { TUTORIAL_UI } from '../tutorial/text-vi';
import { createWiringCanvas } from './wiring-canvas';
import { createStepRun } from './step/step-run';
import { enterFullscreenOnTouch } from '../puzzle/ui/fullscreen';

export { DOCK_CONSOLE_ID, DOCK_LESSONS_ID, DOCK_SCENE_ID };

function loadInitialBoard(): Board {
  try {
    const saved = loadAutosave();
    // First run after the library was added: the single old autosave becomes the first library entry.
    ensureLibrary(saved);
    return takeStash() ?? saved ?? createEmptyBoard('3d');
  } catch {
    return createEmptyBoard('3d');
  }
}

/** True when the user has highlighted page text, so Ctrl+C should keep its normal meaning. */
function hasTextSelection(): boolean {
  return (window.getSelection()?.toString() ?? '') !== '';
}

export function mountEditor(root: HTMLElement): void {
  /** Colour theme + display mode; reading them also puts data-theme / data-mode on <html> before anything is drawn. */
  const look = uiPrefs();
  const state = createEditorState(loadInitialBoard());
  const gameView: GameView = createGameView();
  const keyboard = createKeyboardInput();

  /** Param values the running game currently holds, per node; reset on every (re)start. */
  const liveBase = new Map<string, Record<string, unknown>>();
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
    if (state.getCircuitPath().length > 0) return topBar.notify(CIRCUIT_VI.noteNoNotes);
    const c = canvas.viewCenter();
    const n = state.getNotes().length % 6;
    const { blocked, visible } = canvas.placementAreas();
    state.addNote(findFreeNoteSpot({ x: c.x - 90 + n * 24, y: c.y - 55 + n * 24 }, state.getGraph(), state.getNotes(), blocked, visible));
  };

  /** Where a palette item lands: where it was dropped on the board, or near the middle of the view; null when dropped elsewhere. */
  const dropSpot = (cx: number | null, cy: number | null): { x: number; y: number } | null => {
    if (cx !== null && cy !== null) return canvas.isOver(cx, cy) ? canvas.clientToWorld(cx, cy) : null;
    const c = canvas.viewCenter();
    const n = state.getGraph().nodes.length % 6;
    return { x: c.x - 70 + n * 24, y: c.y - 40 + n * 24 };
  };
  const circuitPalette = createCircuitPalette({
    state,
    notify: (t, k) => topBar.notify(t, k),
    onPlace(circuitId, cx, cy) {
      const pos = dropSpot(cx, cy);
      if (pos) placeInstance(state, circuitId, pos, (t, k) => topBar.notify(t, k));
    },
  });
  const palette = createPalette({
    state,
    circuits: circuitPalette,
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
  const library = createLibraryDialog({
    openGame(id) {
      flushAutosave();
      const res = loadGame(id);
      if (!res.ok) return res.error;
      loadBoard(res.board, id);
      topBar.notify(LIBRARY_TEXT.opened(res.board.name));
      return null;
    },
    renameGame(id, name) {
      const clean = name.trim().slice(0, LIBRARY_NAME_MAX);
      if (clean !== '' && id === getCurrentGameId() && !tutorial.isActive()) {
        // The open game owns its name: change it on the board and let the autosave carry it into the library.
        state.setName(clean);
        flushAutosave();
        topBar.notify(LIBRARY_TEXT.renamed);
        return null;
      }
      const res = renameGame(id, name);
      if (res.ok) topBar.notify(LIBRARY_TEXT.renamed);
      return res.ok ? null : res.error;
    },
    duplicateGame(id) {
      flushAutosave();
      const res = duplicateGame(id);
      if (!res.ok) return res.error;
      topBar.notify(LIBRARY_TEXT.duplicated);
      return null;
    },
    deleteGame(id) {
      const wasCurrent = id === getCurrentGameId();
      const res = deleteGame(id);
      if (!res.ok) return res.error;
      if (wasCurrent) {
        // The open game is gone from the library; leave the editor on a fresh board so it cannot come back by autosave.
        clearAutosave();
        loadBoard(createEmptyBoard(state.getMode()));
      }
      topBar.notify(LIBRARY_TEXT.deleted);
      return null;
    },
  });
  const props = createPropertiesPanel(state, {
    notify: (t, k) => topBar.notify(t, k),
    onLiveParamChange(nodeId, params) {
      // The panel reports the node's full param set; send only what differs from what the running game has.
      const running = liveBase.get(nodeId) ?? {};
      const patch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(params)) if (JSON.stringify(v) !== JSON.stringify(running[k])) patch[k] = v;
      if (Object.keys(patch).length === 0) return;
      liveBase.set(nodeId, { ...running, ...patch });
      if (gameView.applyNodeParams(nodeId, patch)) {
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
    onSelect: () => {
      syncPip();
      relayout();
    },
  });
  const liveChip = h('span', 'livechip');
  liveChip.append(h('i'), h('span', '', SHELL_TEXT.liveChip));
  centerDock.bar.append(liveChip);

  // The floating game window: the same game view container moves between its tab and the window.
  const pip = createGamePip({
    host: centerDock.el.querySelector<HTMLElement>('.panes')!,
    gameBox,
    tabBar: centerDock.bar,
    gameTab: centerDock.bar.querySelector<HTMLElement>('#tab-game')!,
    onDockBack: () => showCenter('game'),
    onSplit: () => layout.setPreset('split'),
    onFloatRequest: () => showCenter('graph'),
    onMoved: relayout,
    onGeometry: updateCanvasInsets,
  });
  /** Tells the wiring board how much of its bottom-right corner the floating window covers. */
  function updateCanvasInsets(): void {
    if (!pip.visible()) {
      canvas.el.style.removeProperty('--pip-inset-r');
      return canvas.setOverlayInsets({ right: 0, bottom: 0 });
    }
    const c = canvas.el.getBoundingClientRect();
    const p = pip.el.getBoundingClientRect();
    if (c.width === 0 || p.width === 0) return;
    const right = Math.max(0, c.right - p.left + 12);
    canvas.el.style.setProperty('--pip-inset-r', `${right}px`);
    canvas.setOverlayInsets({ right, bottom: Math.max(0, c.bottom - p.top + 12) });
  }
  /** The window floats while the board tab is open, except in the split layout where the game is already beside it. */
  function syncPip(): void {
    pip.setVisible(centerDock.selected() === 'graph' && layout.preset() !== 'split');
  }

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
    syncPip();
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
      entries: () => {
        const samples = listSamples();
        return [
          { type: 'item', label: SHELL_TEXT.fileNew, icon: 'plus', onSelect: () => dialog.open() },
          {
            type: 'item',
            label: SHELL_TEXT.fileSamples,
            icon: 'star',
            disabled: samples.length === 0,
            submenu: samples.map((s) => ({
              type: 'item' as const,
              label: s.label,
              onSelect: () => loadBoard(structuredClone(s.board), null, true),
            })),
            onSelect: () => undefined,
          },
          { type: 'item', label: SHELL_TEXT.fileLibrary, icon: 'layers', onSelect: () => library.open() },
          { type: 'item', label: SHELL_TEXT.fileOpen, icon: 'folder', onSelect: openFile },
          { type: 'separator' },
          { type: 'item', label: SHELL_TEXT.fileSave, icon: 'save', hint: 'Ctrl S', onSelect: saveLocal },
          { type: 'item', label: SHELL_TEXT.fileExport, icon: 'download', onSelect: saveToFile },
          { type: 'separator' },
          { type: 'heading', label: SHELL_TEXT.fileGameSettings },
          {
            type: 'item',
            label: PANELS_TEXT_VI.solidBodiesLabel,
            checked: state.getSolidBodies(),
            disabled: state.isPlaying(),
            onSelect: () => state.setSolidBodies(!state.getSolidBodies()),
          },
          {
            type: 'item',
            label: PANELS_TEXT_VI.realPhysicsLabel,
            checked: state.getRealPhysics(),
            disabled: state.isPlaying(),
            onSelect: () => state.setRealPhysics(!state.getRealPhysics()),
          },
        ];
      },
    },
    {
      id: 'edit',
      label: SHELL_TEXT.menuEdit,
      entries: () => [
        { type: 'item', label: SHELL_TEXT.editUndo, icon: 'undo', hint: 'Ctrl Z', disabled: !state.canUndo(), onSelect: () => state.undo() },
        { type: 'item', label: SHELL_TEXT.editRedo, icon: 'redo', hint: 'Ctrl Y', disabled: !state.canRedo(), onSelect: () => state.redo() },
        { type: 'separator' },
        { type: 'item', label: SHELL_TEXT.editAddNote, icon: 'note', disabled: state.isPlaying(), onSelect: addNoteAtCenter },
        {
          type: 'item',
          label: SHELL_TEXT.editDuplicate,
          icon: 'copy',
          hint: 'Ctrl D',
          disabled: state.isPlaying(),
          onSelect: () => {
            const n = state.duplicate();
            if (n > 0) topBar.notify(TEXT_VI.duplicated(n));
          },
        },
        {
          type: 'item',
          label: SHELL_TEXT.editDelete,
          icon: 'trash',
          hint: 'Del',
          disabled: state.isPlaying(),
          onSelect: () => void state.deleteSelection(),
        },
        { type: 'separator' },
        { type: 'item', label: GROUP_VI.group, hint: 'Ctrl G', disabled: state.isPlaying(), onSelect: groupSelected },
        { type: 'item', label: GROUP_VI.ungroup, hint: 'Ctrl Shift G', disabled: state.isPlaying(), onSelect: ungroupSelected },
        {
          type: 'item',
          label: CIRCUIT_VI.fromSelectionLong,
          disabled: state.isReadOnly() || state.getMulti().size === 0,
          onSelect: () => {
            if (circuitFromSelection(state, (t, k) => topBar.notify(t, k)) !== null && !isShown(canvas.el)) showCenter('graph');
          },
        },
        { type: 'separator' },
        { type: 'item', label: SHELL_TEXT.editArrange, icon: 'arrange', disabled: state.isPlaying(), onSelect: () => canvasAction(() => canvas.arrange()) },
        { type: 'item', label: SHELL_TEXT.editFit, icon: 'fit', onSelect: () => canvasAction(() => canvas.fitToContent()) },
      ],
    },
    {
      id: 'view',
      label: SHELL_TEXT.menuView,
      entries: () => {
        const split = layout.preset() === 'split';
        return [
          { type: 'item', label: SHELL_TEXT.viewGame, icon: 'game', checked: split || centerDock.selected() === 'game', onSelect: () => showCenter('game') },
          { type: 'item', label: SHELL_TEXT.viewGraph, icon: 'graph', checked: split || centerDock.selected() === 'graph', onSelect: () => showCenter('graph') },
          { type: 'item', label: SHELL_TEXT.viewMaximize, icon: 'expand', hint: 'F', onSelect: () => setMaximized(!root.classList.contains('maximized')) },
          { type: 'separator' },
          { type: 'heading', label: SHELL_TEXT.viewLayout },
          ...LAYOUT_PRESETS.map((p) => ({
            type: 'item' as const,
            label: PRESET_LABELS[p],
            checked: layout.preset() === p,
            onSelect: () => layout.setPreset(p),
          })),
          { type: 'separator' },
          { type: 'item', label: SHELL_TEXT.viewLeftDock, icon: 'tree', checked: !layout.leftCollapsed(), onSelect: () => layout.setLeftCollapsed(!layout.leftCollapsed()) },
          { type: 'item', label: SHELL_TEXT.viewWireEnergy, checked: isEnergyEnabled(), onSelect: () => setEnergyEnabled(!isEnergyEnabled()) },
          { type: 'separator' },
          { type: 'heading', label: SHELL_TEXT.viewThemeHeading },
          { type: 'item', label: SHELL_TEXT.themeLight, icon: 'sun', checked: look.theme() === 'light', onSelect: () => look.setTheme('light') },
          { type: 'item', label: SHELL_TEXT.themeDark, icon: 'moon', checked: look.theme() === 'dark', onSelect: () => look.setTheme('dark') },
          { type: 'heading', label: SHELL_TEXT.viewModeHeading },
          { type: 'item', label: SHELL_TEXT.uiModeStudent, checked: look.mode() === 'student', onSelect: () => look.setMode('student') },
          { type: 'item', label: SHELL_TEXT.uiModeTeacher, checked: look.mode() === 'teacher', onSelect: () => look.setMode('teacher') },
        ];
      },
    },
    {
      id: 'help',
      label: SHELL_TEXT.menuHelp,
      entries: () => [
        {
          type: 'item',
          label: SHELL_TEXT.helpLessons,
          icon: 'book',
          onSelect: () => {
            bottomDock.select('lessons');
            layout.ensureBottomOpen();
          },
        },
        { type: 'item', label: SHELL_TEXT.helpHandbook, icon: 'book', onSelect: () => handbook.open() },
        { type: 'item', label: SHELL_TEXT.helpShortcuts, icon: 'keyboard', hint: '?', onSelect: openHelp },
        { type: 'separator' },
        { type: 'item', label: 'Chơi giải đố', onSelect: () => void window.open('giai-do.html', '_blank', 'noopener') },
      ],
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
  /** Writes the current game to the browser's own storage now; lessons never overwrite the learner's save. */
  function saveLocal(): void {
    if (tutorial.isActive()) return topBar.notify(TUTORIAL_UI.saveBlocked, 'error');
    scheduleAutosave(state.getBoard());
    flushAutosave();
    topBar.notify(SHELL_TEXT.savedLocal);
  }
  /** Runs a wiring-board action, showing the board first when the game tab is on top. */
  function canvasAction(run: () => void): void {
    if (!isShown(canvas.el)) showCenter('graph');
    requestAnimationFrame(run);
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
    onPlay: () => {
      enterFullscreenOnTouch();
      state.setPlaying(true);
    },
    onStop: () => state.setPlaying(false),
    onPause: () => (gameView.isPaused() ? gameView.resume() : gameView.pause()),
    onStep: () => {
      if (!state.isPlaying()) enterFullscreenOnTouch();
      if (!stepRun.state().stepping) log('info', CONSOLE_TEXT.logStep);
      stepRun.press();
    },
    onRestart: restartPlay,
    onNotify: (text, kind) => log(kind, text),
    onHelp: openHelp,
    onModeChange: changeMode,
    onPresetChange: (p) => layout.setPreset(p),
    initialPreset: layout.preset(),
  });
  const stepRun = createStepRun({
    isPlaying: () => state.isPlaying(),
    startPlay: () => state.setPlaying(true),
    // The game runs the main board's cards; inside a circuit the canvas shows none of them, so no step stops there.
    getGraph: () => (state.getCircuitPath().length === 0 ? state.getGraph() : { nodes: [], wires: [] }),
    restingHighlight: () => state.getMulti(),
    view: gameView,
    board: canvas,
    onChange: (s) => {
      topBar.setStepState(s);
      tutorial.noteStep(s);
      if (s.waiting) log('info', CONSOLE_TEXT.logStepBreak);
    },
  });
  layout.onPrefsChange(() => {
    topBar.setPreset(layout.preset());
    syncPip();
  });
  syncPip();

  const revealLeft = (): void => {
    leftDock.select('palette');
    if (layout.leftCollapsed()) layout.setLeftCollapsed(false);
  };
  const tutorial = createTutorial({
    state,
    notify: (t, k) => topBar.notify(t, k),
    onStart: () => {
      bottomDock.select('lessons');
      layout.ensureBottomOpen();
    },
    revealPaletteItem: (kind) => {
      revealLeft();
      palette.reveal(kind);
    },
    revealGraph: () => {
      if (centerDock.selected() === 'game') showCenter('graph');
    },
  });
  topBar.addControl(tutorial.el);
  const handbook = createHandbookDialog({
    openBoard: (b) => loadBoard(structuredClone(b), null, true),
    startLesson: (id) => tutorial.startLesson(id),
  });
  document.addEventListener(HANDBOOK_OPEN_EVENT, (e) => {
    topBar.closeMenus();
    handbook.open((e as CustomEvent<string>).detail);
  });
  bottomDock.el.querySelector(`#${DOCK_LESSONS_ID}`)?.append(tutorial.dock);

  const launchpad = mountLaunchpad({
    host: canvas.el,
    // An entered circuit, even an empty one, is work in progress: the start screen stays away.
    nodeCount: () => state.getBoard().graph.nodes.length + (state.getBoard().circuits?.length ?? 0),
    isPlaying: () => state.isPlaying(),
    tutorialActive: () => tutorial.isActive(),
    startLesson: () => tutorial.startFirst(),
    openSample: (b) => loadBoard(b, null, true),
    openLibrary: () => library.open(),
    startBlank: revealLeft,
  });
  state.subscribe((kind) => (kind === 'board' ? launchpad.boardLoaded() : launchpad.update()));

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
  installEntityDrag(gameBox, gameView, state, (nodeId) => {
    if (isShown(canvas.el)) canvas.revealNode(nodeId);
  });
  const ro = new ResizeObserver(() => gameView.resize());
  ro.observe(gameBox);

  // Sizes depend on laid-out elements, so apply once everything is attached.
  window.dispatchEvent(new Event('resize'));

  // ---------- maximize game view ----------

  const maxBtn = h('button', 'view-max');
  maxBtn.type = 'button';
  function setMaximized(on: boolean): void {
    if (on && (pip.visible() || !isShown(gameBox))) showCenter('game');
    root.classList.toggle('maximized', on);
    maxBtn.textContent = on ? TEXT_VI.restore : TEXT_VI.maximize;
    maxBtn.title = on ? TEXT_VI.restoreTip : TEXT_VI.maximizeTip;
    relayout();
  }
  maxBtn.addEventListener('click', () => setMaximized(!root.classList.contains('maximized')));
  gameBox.append(maxBtn);
  setMaximized(false);

  /**
   * Replaces the game in the editor. The game being left already lives in the library, so it is flushed
   * first. `libraryId` names the entry the new board comes from; null means it is not in the library until edited.
   */
  function loadBoard(board: Board, libraryId: string | null = null, shipped = false): void {
    flushAutosave();
    tutorial.exit();
    setCurrentGameId(libraryId);
    state.setPlaying(false);
    // Boards that ship with the app are spread once for the biggest card size; a saved board is never moved on its own,
    // the board only offers to tidy it when its cards overlap.
    state.loadBoard(shipped ? relayoutShipped(board) : board);
    topBar.notify(TEXT_VI.opened);
    if (!shipped) requestAnimationFrame(() => canvas.offerArrangeHint(`${libraryId ?? ''}|${board.name}|${board.graph.nodes.length}`));
  }

  // ---------- preview / play ----------

  let previewTimer = 0;
  function showPreview(): void {
    try {
      gameView.showPreview(runnableGraph(state.getBoard()), state.getMode());
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
    liveBase.clear();
    for (const n of state.getGraph().nodes) liveBase.set(n.id, structuredClone(n.params));
    keyboard.attach();
    try {
      gameView.play(runnableGraph(state.getBoard()), state.getMode(), () => keyboard.snapshot());
    } catch {
      keyboard.detach();
      topBar.notify(TEXT_VI.playFailed, 'error');
      queueMicrotask(() => state.setPlaying(false));
    }
  }
  function stopPlay(): void {
    gameView.stop();
    stepRun.reset();
    keyboard.detach();
    showPreview();
  }

  function restartPlay(): void {
    if (!state.isPlaying()) return;
    gameView.stop();
    stepRun.reset();
    startPlay();
    log('info', CONSOLE_TEXT.logRestart);
  }

  gameView.onGameEnd((result, message) => {
    stepRun.reset();
    tutorial.noteGameEnd(result);
    if (result === 'win') log('ok', CONSOLE_TEXT.logWin(message));
    else log('warn', CONSOLE_TEXT.logLose(message));
  });
  gameView.onPauseChange((paused) => {
    root.classList.toggle('paused', paused);
    topBar.setPaused(paused);
    if (!paused) stepRun.noteResume();
    pip.setStatus(state.isPlaying(), paused);
    if (state.isPlaying()) log('info', paused ? CONSOLE_TEXT.logPause : CONSOLE_TEXT.logResume);
  });
  gameView.onRestartRequest(() => {
    tutorial.noteRestart();
    restartPlay();
  });

  // Structure is locked while the game runs; dragging from a port is the one edit gesture the canvas ignores silently.
  /** Gom nhóm: wrap the selected mảnh ghép in a named block, then put the cursor in its name field. */
  function groupSelected(): void {
    const res = state.groupSelection();
    if (!res.ok) {
      topBar.notify(GROUP_VI.fail[res.reason], 'error');
      return;
    }
    const name = state.getGraph().groups?.find((g) => g.id === res.groupId)?.name ?? '';
    topBar.notify(GROUP_VI.grouped(name));
    if (isShown(canvas.el)) canvas.centerOn(res.groupId);
    requestAnimationFrame(() => {
      const input = root.querySelector<HTMLInputElement>('.pn-group-name');
      input?.focus();
      input?.select();
    });
  }
  function ungroupSelected(): void {
    const n = state.ungroupSelection();
    if (n > 0) topBar.notify(GROUP_VI.ungrouped(n));
  }

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

  let loadedUnedited = false;

  // Playing no longer switches tabs: on the board tab the game plays in the floating window.
  state.subscribe((kind) => {
    switch (kind) {
      case 'playing':
        root.classList.toggle('playing', state.isPlaying());
        if (!state.isPlaying()) root.classList.remove('paused');
        pip.setStatus(state.isPlaying(), false);
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
      case 'selection':
        gameView.setSelection(state.getMulti());
        gameView.setHighlight(state.getMulti());
        break;
      default:
        break;
    }
    // A freshly loaded board is not an edit: until the first real change it must not re-stamp or create a library entry.
    if (kind === 'board') loadedUnedited = true;
    else if (kind !== 'history' && kind !== 'selection' && kind !== 'playing') loadedUnedited = false;
    // A lesson board must never replace the learner's own autosave.
    const saves = !tutorial.isActive();
    if (kind !== 'selection' && kind !== 'playing' && kind !== 'scope') {
      topBar.noteDocumentChange({ saves });
      if (saves) scheduleAutosave(state.getBoard(), { library: !loadedUnedited });
    }
  });

  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      if (!e.repeat) state.setPlaying(!state.isPlaying());
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!e.repeat) saveLocal();
      return;
    }
    if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      openHelp();
      return;
    }
    if (e.key === 'Escape' && root.classList.contains('maximized')) {
      setMaximized(false);
      return;
    }
    if (e.key === 'Escape' && state.getCircuitPath().length > 0) {
      state.exitCircuit();
      return;
    }
    if (e.key === 'Escape' && state.getScope() !== null) {
      state.exitGroup();
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
      if (key === 'g') {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }
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
      else if (e.key === 'Backspace' && state.getCircuitPath().length > 0) state.exitCircuit();
      else if (e.key === 'Backspace' && state.getScope() !== null) state.exitGroup();
    }
  });
  window.addEventListener('pagehide', () => flushAutosave());

  showPreview();
  canvas.fitToContent();
  const problem = takeAutosaveProblem();
  if (problem) topBar.notify(problem, 'error');
}
