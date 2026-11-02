import type { GameView } from '../../app-contracts';
import { TICK_DT, type GameResult } from '../../engine/types';
import { h } from '../../editor/dom';
import { viewPitch } from '../../nodes/camera';
import { starsFor } from '../run-level';
import { renderObjectThumbnails } from '../../render/object-thumbnails';
import { STAGE_CHARACTER_SCALE, createCozyStage } from '../stage/cozy-stage';
import type { PuzzleLevel } from '../types';
import { createBoardView, type BoardView } from './board-view';
import { graphOf, toAnswer } from './board-state';
import { createGuide, type Guide } from './guide';
import { isFloorLike } from './object-cards';
import { hasGuide, hasSeenIntro, isGuideForced, markGuideSeen, markIntroSeen, newPieceIntros } from './guide-script';
import { countHint, extraHints, hintBadge } from './hint-rules';
import { starsOf, withBest, type ProgressMap } from './progress';
import { PUZZLE_UI_TEXT as T } from './puzzle-text';
import { ICONS, roundButton, svg } from './shell-kit';
import { playSfx } from './sound';
import { attachStageCameraInput } from './stage-camera-input';
import { buildBackdrop } from './themes/theme';
import { showWinCard } from './win-card';

/** The one game view of the page. It is created once and moved into whichever level screen is open. */
export interface StageHost {
  el: HTMLElement;
  view: GameView;
  /** Set by the open level screen; receives the end of every run. */
  onEnd: ((result: GameResult, message: string) => void) | null;
}

export interface LevelScreenContext {
  level: PuzzleLevel;
  /** The next level when there is one (opens after a win); null after the last level, where the win leads to the ending. */
  next: PuzzleLevel | null;
  stage: StageHost;
  progress: () => ProgressMap;
  saveProgress(map: ProgressMap): void;
  go(hash: string): void;
  /** Opens the settings dialog on top of `host`. */
  openSettings(host: HTMLElement): void;
}

type Phase = 'edit' | 'run' | 'ended';
/** Which layer is full screen; the other one is the live picture-in-picture window in the bottom-right corner. */
type Focus = 'board' | 'stage';
/** How far (screen px) from a tap on the stage an object still counts as tapped. */
const TAP_REACH_PX = 18;

/** Main character: the first character whose look is the level's first cast look, else the first character. */
export function mainCharacterId(level: PuzzleLevel): string | null {
  const chars = level.base.nodes.filter((n) => n.kind === 'character');
  const hero = chars.find((n) => n.params.look === level.cast[0]) ?? chars[0];
  return hero?.id ?? null;
}

/** The side-view stage looks down a little (radians) so the planks of the floor show. */
const SIDE_TILT = 0.2;
const NO_KEYS = { keysDown: new Set<string>() };
const RESET_AFTER_LOSE_MS = 1700;
/** The corner window is this share of the screen width (kept between these pixel sizes). */
const PIP_SHARE = 0.21;
const PIP_MIN_PX = 150;
const PIP_MAX_PX = 340;
/** Gap between the corner window and the screen edge, as a share of the screen width. */
const PIP_GAP_SHARE = 0.014;
/** Stage space under the bottom edge that stays free of the scene (the corner board sits there). */
const STAGE_BOTTOM_COVER = 0.03;
const ZOOM_STEP = 1.4;
/** The task text opened at the start of a level stays this long unless the player puts it away first. */
const TASK_SHOWN_MS = 12000;
/** Cards stay this many px away from the corner window. */
const PIP_CLEAR_PX = 6;

function starsEl(count: 0 | 1 | 2 | 3, className: string): HTMLElement {
  const el = h('span', className);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', T.starsAria(count));
  for (let i = 0; i < 3; i++) el.append(h('i', i < count ? 'on' : ''));
  return el;
}

/** Builds the level screen inside `root`. Returns a function that tears it down. */
export function mountLevelScreen(root: HTMLElement, ctx: LevelScreenContext): () => void {
  const { level, stage } = ctx;
  let phase: Phase = 'edit';
  /** "?" presses that revealed a step; the free ones are `level.freeHints`. */
  let hintsUsed = 0;
  /** Solution steps already revealed by "?" this visit: pressing "?" again on one of them is not counted. */
  const revealedHints = new Set<string>();
  let previewTimer = 0;
  let loseTimer = 0;
  let watchRaf = 0;
  /** Puts the opening task text away after a while, so it never stays over the cards or the stage. */
  let taskTimer = 0;
  let board: BoardView | null = null;
  let guide: Guide | null = null;

  const phone = h('div', 'pz-phone');
  const screen = h('div', 'pz-screen');
  phone.append(screen);

  // ----- top bar: back, level, task, stars, settings, and the board's buttons -----
  const back = h('button', 'pz-back', '‹');
  back.type = 'button';
  back.setAttribute('aria-label', T.backToMap);
  back.title = T.backToMap;
  const badge = h('span', 'pz-badge', T.levelBadge(level.order, level.title));
  badge.title = badge.textContent ?? '';
  const hudStars = starsEl(starsOf(ctx.progress(), level.id), 'pz-stars');
  const hud = h('div', 'pz-hud');
  const gear = roundButton(ICONS.gear, T.settingsAria, () => ctx.openSettings(screen));
  gear.classList.add('pz-hud-gear');
  const taskBtn = h('button', 'pz-task-btn');
  taskBtn.type = 'button';
  taskBtn.append(h('span', '', T.task), h('span', 'pz-task-caret', '▾'));
  taskBtn.setAttribute('aria-expanded', 'true');
  const task = h('div', 'pz-task');
  task.id = 'pz-task-text';
  taskBtn.setAttribute('aria-controls', task.id);
  task.append(h('p', 'pz-task-body', level.task));
  function setTaskOpen(open: boolean): void {
    task.classList.toggle('is-closed', !open);
    taskBtn.setAttribute('aria-expanded', String(open));
  }
  taskBtn.addEventListener('click', () => {
    window.clearTimeout(taskTimer);
    setTaskOpen(task.classList.contains('is-closed'));
  });
  const heroId = mainCharacterId(level);
  const guided = hasGuide(level);
  /** Level 1's and level 5's first visit: the guide leads and cannot be skipped. */
  const forcedGuide = isGuideForced(level);
  const replayBtn = h('button', 'pz-replay', T.guideReplay);
  replayBtn.type = 'button';
  replayBtn.hidden = !guided || forcedGuide;
  replayBtn.setAttribute('aria-label', T.guideReplayAria);

  const hintBtn = h('button', 'pz-btn small pz-hint-btn', '?');
  hintBtn.type = 'button';
  const hintCount = h('span', 'pz-hint-badge');
  hintBtn.append(hintCount);
  /** Shows the free hints left; red with a crossed star once the next press costs a star. */
  function syncHintBadge(): void {
    const badgeState = hintBadge(level, hintsUsed);
    hintBtn.classList.toggle('costly', badgeState.costly);
    hintCount.textContent = badgeState.costly ? '★' : String(badgeState.left);
    const label = badgeState.costly ? T.hintCostly : T.hintFree(badgeState.left);
    hintBtn.setAttribute('aria-label', label);
    hintBtn.title = label;
  }
  syncHintBadge();
  const resetBtn = h('button', 'pz-btn small', '↺');
  resetBtn.type = 'button';
  resetBtn.setAttribute('aria-label', T.reset);
  resetBtn.title = T.reset;
  const runBtn = h('button', 'pz-btn run', T.run);
  runBtn.type = 'button';
  const actions = h('div', 'pz-actions');
  actions.append(hintBtn, resetBtn, runBtn);
  hud.append(back, badge, taskBtn, hudStars, gear, actions);

  // ----- stage layer -----
  const stageSec = h('section', 'pz-stage');
  stageSec.setAttribute('aria-label', T.stageAria);
  stageSec.append(stage.el);
  // The look's animated backdrop sits behind the transparent stage canvas.
  stageSec.prepend(buildBackdrop('stage'));

  // ----- board layer -----
  const boardEl = h('section', 'pz-board-host');
  boardEl.setAttribute('aria-label', T.boardAria);
  const bottom = h('div', 'pz-bottom');
  const trayEl = h('div', 'pz-tray');
  trayEl.setAttribute('role', 'group');
  trayEl.setAttribute('aria-label', T.trayAria);
  bottom.append(trayEl);
  boardEl.append(bottom);

  // ----- swap controls -----
  const pipHit = h('button', 'pz-pip-hit');
  pipHit.type = 'button';
  const camBar = h('div', 'pz-cam');
  camBar.setAttribute('role', 'group');
  camBar.setAttribute('aria-label', T.camTools);
  const camButton = (icon: string, label: string, onClick: () => void): HTMLButtonElement => {
    const btn = h('button', 'pz-btn small');
    btn.type = 'button';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.append(svg(icon));
    btn.addEventListener('click', onClick);
    return btn;
  };
  const zoomChip = h('span', 'pz-zoomchip');
  zoomChip.hidden = true;
  camBar.append(
    camButton(ICONS.zoomIn, T.camZoomIn, () => zoomStep(ZOOM_STEP)),
    camButton(ICONS.zoomOut, T.camZoomOut, () => zoomStep(1 / ZOOM_STEP)),
    camButton(ICONS.recenter, T.camReset, () => resetCamera()),
    camButton(ICONS.shrink, T.camBackToBoard, () => setFocus('board')),
    zoomChip,
  );

  const rotate = h('div', 'pz-rotate', T.rotate);
  screen.classList.add('pz-noanim');
  screen.dataset.focus = 'board';
  screen.append(boardEl, stageSec, hud, task, replayBtn, camBar, pipHit, rotate);
  root.replaceChildren(phone);

  // ----- picture-in-picture swap -----
  let focus: Focus = 'board';
  /** Share of the stage height the top bar covers (set by frameStage). */
  let fitTop = 0;
  /** The corner window on screen (also board px: both layers fill the screen); cards keep clear of it. */
  let pipRect = { x: 0, y: 0, w: 0, h: 0 };

  /** Sizes the corner window from the real screen; both layers keep their full layout size and are only scaled. */
  function placePip(): void {
    const W = screen.clientWidth;
    const H = screen.clientHeight;
    if (W <= 0 || H <= 0) return;
    const gap = Math.round(W * PIP_GAP_SHARE);
    const pw = Math.round(Math.min(PIP_MAX_PX, Math.max(PIP_MIN_PX, W * PIP_SHARE)));
    const k = pw / W;
    const ph = Math.round(H * k);
    const set = (name: string, value: string): void => screen.style.setProperty(name, value);
    set('--pip-k', String(k));
    set('--pip-w', `${pw}px`);
    set('--pip-h', `${ph}px`);
    set('--pip-gap', `${gap}px`);
    set('--pip-x', `${W - pw - gap}px`);
    set('--pip-y', `${H - ph - gap}px`);
    pipRect = { x: W - pw - gap, y: H - ph - gap, w: pw, h: ph };
  }

  function syncCamera(): void {
    const st = stage.view.cameraState();
    zoomChip.hidden = !st.custom;
    zoomChip.textContent = `${st.zoom.toFixed(1)}×`;
  }

  /** The stage's own camera: drag, wheel, pinch and double tap, only while the stage is the big view. */
  const cameraInput = attachStageCameraInput(stageSec, stage.view, () => focus === 'stage', syncCamera, onStageTap);

  /** The object that glows on the stage and whose card is lit on the board (they always go together). */
  let litObject: string | null = null;
  function lightObject(id: string | null): void {
    litObject = id;
    stage.view.setHighlight(id === null ? new Set() : new Set([id]));
  }

  /** A tap on the big stage: an object with a card lights both; a second tap on it, the floor or empty space lets go. */
  function onStageTap(clientX: number, clientY: number): void {
    // Floors, scenery and anything without a card are see-through for the tap, so a thin bot or door behind or beside them still counts.
    const ignore = new Set(level.base.nodes.filter((n) => isFloorLike(n) || !board?.hasObjectCard(n.id)).map((n) => n.id));
    const id = stage.view.pickEntityOwner(clientX, clientY, { slopPx: TAP_REACH_PX, ignore });
    const next = id !== null && id !== litObject ? id : null;
    board?.pickCard(next);
    lightObject(next);
  }

  function zoomStep(factor: number): void {
    const r = stageSec.getBoundingClientRect();
    // The middle of the part of the stage the top bar leaves free.
    const mid = fitTop + (1 - fitTop - STAGE_BOTTOM_COVER) / 2;
    stage.view.zoomCamera(factor, r.left + r.width / 2, r.top + r.height * mid);
    syncCamera();
  }

  function resetCamera(): void {
    stage.view.resetStageCamera(true);
    syncCamera();
  }

  /** Brings one layer full screen; the other shrinks into the corner window. */
  function setFocus(next: Focus): void {
    if (next === focus) return;
    focus = next;
    screen.dataset.focus = next;
    stageSec.inert = next === 'board';
    boardEl.inert = next === 'stage';
    pipHit.setAttribute('aria-label', next === 'board' ? T.pipOpenStage : T.pipOpenBoard);
    pipHit.title = pipHit.getAttribute('aria-label') ?? '';
    board?.closePopover();
    if (next === 'stage') setTaskOpen(false);
    // The corner window always shows the default framing (it follows the character while the game runs).
    if (next === 'board') resetCamera();
    else syncCamera();
  }
  stageSec.inert = true;
  pipHit.setAttribute('aria-label', T.pipOpenStage);
  pipHit.title = T.pipOpenStage;
  placePip();
  // Start without the swap animation so the first frame is already in place.
  requestAnimationFrame(() => requestAnimationFrame(() => screen.classList.remove('pz-noanim')));

  /** Tells the game view which part of the stage the top bar covers, and whether to follow the character. */
  function frameStage(): void {
    const H = stageSec.clientHeight;
    if (H <= 0) return;
    const top = Math.min(0.45, (hud.offsetTop + hud.offsetHeight + 8) / H);
    fitTop = top;
    const camera = level.base.nodes.find((n) => n.kind === 'camera');
    const pitch = level.mode === '3d' && camera ? viewPitch(String(camera.params.view ?? 'free')).pitch : undefined;
    // Editing shows the whole scene; a running game follows the character (the player can pan and zoom from there).
    const follow = heroId !== null && phase !== 'edit' ? heroId : null;
    stage.view.setStageFit({
      top,
      bottom: STAGE_BOTTOM_COVER,
      follow,
      heroScale: STAGE_CHARACTER_SCALE,
      ...(pitch !== undefined ? { pitch } : {}),
      ...(level.mode === '2d-side' ? { sidePitch: SIDE_TILT } : {}),
    });
    syncCamera();
  }
  const screenObserver = new ResizeObserver(() => {
    placePip();
    frameStage();
  });
  screenObserver.observe(screen);

  // ----- stage helpers -----
  function showPreview(): void {
    if (phase !== 'edit' || !board) return;
    try {
      stage.view.showPreview(graphOf(level, board.state()), level.mode);
    } catch (err) {
      console.error(err);
    }
  }
  function schedulePreview(): void {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(showPreview, 40);
  }

  function setPhase(next: Phase): void {
    phase = next;
    runBtn.textContent = next === 'edit' ? T.run : T.stop;
    runBtn.classList.toggle('stop', next !== 'edit');
    resetBtn.disabled = next !== 'edit';
    frameStage();
    guide?.refresh();
  }

  function stopWatch(): void {
    if (watchRaf) cancelAnimationFrame(watchRaf);
    watchRaf = 0;
  }

  /** Back to the editing scene: stops the game, clears the lit wires, redraws the first scene. */
  function backToEdit(): void {
    window.clearTimeout(loseTimer);
    stopWatch();
    stage.view.stop();
    board?.setRunning(false);
    root.querySelector('.pz-win')?.remove();
    setPhase('edit');
    setFocus('board');
    showPreview();
  }

  function finish(result: GameResult, message: string): void {
    if (phase !== 'run' || !board) return;
    stopWatch();
    stage.view.stop(); // hides the view's own end card; the last frame stays on the canvas
    board.freezeEnergy();
    setPhase('ended');
    if (result !== 'win') {
      playSfx('lose');
      board.toast(message || T.loseDefault);
      loseTimer = window.setTimeout(backToEdit, RESET_AFTER_LOSE_MS);
      return;
    }
    const answer = toAnswer(board.state());
    const stars = starsFor(level, answer, hintsUsed);
    if (forcedGuide) markGuideSeen(level.id); // the first guided win ends the mandatory guide
    ctx.saveProgress(withBest(ctx.progress(), level.id, stars));
    hudStars.replaceWith(starsEl(starsOf(ctx.progress(), level.id), 'pz-stars'));
    guide?.celebrate();
    playSfx('win');
    showWin(stars);
  }

  function showWin(stars: 1 | 2 | 3): void {
    showWinCard({
      screen,
      stars,
      note: T.winNote(stars, extraHints(level, hintsUsed)),
      onNext: () => ctx.go(ctx.next ? `#/level/${ctx.next.id}` : '#/end'),
      onRetry: backToEdit,
      onMap: () => ctx.go('#/map'),
    });
  }

  /** Ends a run that went past the level's time limit (counted in game time, so a paused game does not run out). */
  function watchTime(): void {
    watchRaf = 0;
    if (phase !== 'run') return;
    const rt = stage.view.getRuntime();
    if (rt && rt.tickIndex * TICK_DT >= level.timeLimit) {
      stage.view.stop();
      board?.freezeEnergy();
      setPhase('ended');
      playSfx('lose');
      board?.toast(T.timeout);
      loseTimer = window.setTimeout(backToEdit, RESET_AFTER_LOSE_MS);
      return;
    }
    watchRaf = requestAnimationFrame(watchTime);
  }

  function run(): void {
    if (!board) return;
    window.clearTimeout(previewTimer);
    try {
      stage.view.play(graphOf(level, board.state()), level.mode, () => NO_KEYS);
    } catch (err) {
      console.error(err);
    }
    if (!stage.view.isPlaying()) {
      board.toast(T.runFailed);
      showPreview();
      return;
    }
    setPhase('run');
    setTaskOpen(false);
    setFocus('stage');
    board.setRunning(true, () => stage.view.getRuntime());
    watchRaf = requestAnimationFrame(watchTime);
  }

  stage.onEnd = finish;

  board = createBoardView({ level, board: boardEl, trayEl, bottomEl: bottom, onChange: schedulePreview, toastHost: screen, onCardPick: lightObject, thumbnails: (ids) => renderObjectThumbnails(level.base, level.mode, createCozyStage(), ids), keepClear: () => ({ x: pipRect.x - PIP_CLEAR_PX, y: pipRect.y - PIP_CLEAR_PX, w: pipRect.w + 2 * PIP_CLEAR_PX, h: pipRect.h + 2 * PIP_CLEAR_PX }) });
  guide = createGuide({ level, screen, board, runBtn, isEditing: () => phase === 'edit', showBoard: () => setFocus('board') });

  // ----- buttons -----
  runBtn.addEventListener('click', () => {
    playSfx(phase === 'edit' ? 'run' : 'stop');
    if (phase === 'edit') run();
    else backToEdit();
  });
  pipHit.addEventListener('click', () => {
    // While the guide leads, the board stays in front: the cat points at it.
    if (phase === 'edit' && guide?.active) return;
    setFocus(focus === 'board' ? 'stage' : 'board');
  });
  // Touching the board puts the task text away.
  boardEl.addEventListener('pointerdown', () => setTaskOpen(false), true);
  taskTimer = window.setTimeout(() => setTaskOpen(false), TASK_SHOWN_MS);
  resetBtn.addEventListener('click', () => {
    if (phase !== 'edit') return;
    board?.reset();
  });
  // "?" reveals exactly one next step (cat, ring, hand, dotted wire). While the guide leads it already shows
  // that, so the cat just nods at the hand and nothing is counted.
  hintBtn.addEventListener('click', () => {
    if (phase !== 'edit' || !guide) return;
    if (guide.active) {
      board?.toast(T.guideFollow);
      return;
    }
    playSfx('hint');
    if (countHint(revealedHints, guide.hint())) {
      hintsUsed++;
      syncHintBadge();
    }
  });
  replayBtn.addEventListener('click', () => {
    if (!guide) return;
    if (phase !== 'edit') backToEdit();
    board?.reset();
    guide.start(true);
  });
  back.addEventListener('click', () => ctx.go('#/map'));

  // The stage canvas was sized while it sat elsewhere; fit it to its new home, then draw the first scene.
  requestAnimationFrame(() => {
    frameStage();
    stage.view.resize();
    showPreview();
  });
  showPreview();
  // Levels 1 and 5 lead the first visit with the guide (no skip); "↻ Hướng dẫn" brings it back later.
  // Other levels introduce each piece the player has not met yet, once per level.
  if (forcedGuide) {
    guide.start(false);
  } else if (!guided && !hasSeenIntro(level.id)) {
    const lines = newPieceIntros(level);
    if (lines.length > 0) {
      markIntroSeen(level.id);
      guide.tips(lines);
    }
  }

  return () => {
    guide?.dispose();
    guide = null;
    window.clearTimeout(previewTimer);
    window.clearTimeout(loseTimer);
    window.clearTimeout(taskTimer);
    stopWatch();
    screenObserver.disconnect();
    cameraInput.dispose();
    lightObject(null);
    stage.onEnd = null;
    stage.view.stop();
    board?.destroy();
    board = null;
    stage.el.remove();
    root.replaceChildren();
  };
}
