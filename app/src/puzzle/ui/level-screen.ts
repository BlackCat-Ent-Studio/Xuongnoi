import type { GameView } from '../../app-contracts';
import { TICK_DT, type GameResult } from '../../engine/types';
import { h } from '../../editor/dom';
import { viewPitch } from '../../nodes/camera';
import { starsFor } from '../run-level';
import type { PuzzleLevel } from '../types';
import { createBoardView, type BoardView } from './board-view';
import { graphOf, toAnswer } from './board-state';
import { createGuide, type Guide } from './guide';
import { hasGuide, hasSeenIntro, isGuideForced, markGuideSeen, markIntroSeen, newPieceIntros } from './guide-script';
import { extraHints, hintBadge } from './hint-rules';
import { starsOf, withBest, type ProgressMap } from './progress';
import { PUZZLE_UI_TEXT as T } from './puzzle-text';

/** The one game view of the page. It is created once and moved into whichever level screen is open. */
export interface StageHost {
  el: HTMLElement;
  view: GameView;
  /** Set by the open level screen; receives the end of every run. */
  onEnd: ((result: GameResult, message: string) => void) | null;
}

export interface LevelScreenContext {
  level: PuzzleLevel;
  /** The next level when there is one (opens after a win). */
  next: PuzzleLevel | null;
  stage: StageHost;
  progress: () => ProgressMap;
  saveProgress(map: ProgressMap): void;
  go(hash: string): void;
}

type Phase = 'edit' | 'run' | 'ended';
type StageView = 'overview' | 'follow';

/** The player's choice from the "Toàn cảnh / Theo nhân vật" button; kept for the whole visit (all levels). */
let rememberedView: StageView | null = null;

/** Main character: the first character whose look is the level's first cast look, else the first character. */
export function mainCharacterId(level: PuzzleLevel): string | null {
  const chars = level.base.nodes.filter((n) => n.kind === 'character');
  const hero = chars.find((n) => n.params.look === level.cast[0]) ?? chars[0];
  return hero?.id ?? null;
}

const NO_KEYS = { keysDown: new Set<string>() };
const RESET_AFTER_LOSE_MS = 1700;

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
  let previewTimer = 0;
  let loseTimer = 0;
  let watchRaf = 0;
  let board: BoardView | null = null;
  let guide: Guide | null = null;

  const phone = h('div', 'pz-phone');
  const screen = h('div', 'pz-screen');
  phone.append(screen);

  // ----- stage (left) -----
  const stageSec = h('section', 'pz-stage');
  stageSec.setAttribute('aria-label', T.stageAria);
  const back = h('button', 'pz-back', '‹');
  back.type = 'button';
  back.setAttribute('aria-label', T.backToList);
  back.title = T.backToList;
  const badge = h('span', 'pz-badge', T.levelBadge(level.order, level.title));
  const hudStars = starsEl(starsOf(ctx.progress(), level.id), 'pz-stars');
  const hud = h('div', 'pz-hud');
  hud.append(back, badge, hudStars);
  const task = h('div', 'pz-task');
  const taskHead = h('button', 'pz-task-head');
  taskHead.type = 'button';
  taskHead.append(h('b', '', T.task), h('span', 'pz-task-caret', '▾'));
  taskHead.setAttribute('aria-expanded', 'true');
  const taskBody = h('p', 'pz-task-body', level.task);
  task.append(taskHead, taskBody);
  function setTaskOpen(open: boolean): void {
    task.classList.toggle('is-closed', !open);
    taskHead.setAttribute('aria-expanded', String(open));
  }
  taskHead.addEventListener('click', () => setTaskOpen(task.classList.contains('is-closed')));
  // View toggle: whole scene or close-up on the main character.
  const heroId = mainCharacterId(level);
  const viewBtn = h('button', 'pz-viewtoggle');
  viewBtn.type = 'button';
  viewBtn.hidden = heroId === null;
  const guided = hasGuide(level);
  /** Level 1's first visit: the guide leads and cannot be skipped. */
  const forcedGuide = isGuideForced(level);
  const replayBtn = h('button', 'pz-replay', T.guideReplay);
  replayBtn.type = 'button';
  replayBtn.hidden = !guided || forcedGuide;
  replayBtn.setAttribute('aria-label', T.guideReplayAria);
  stageSec.append(stage.el, hud, viewBtn, replayBtn, task);

  /** What the camera does now: the player's remembered choice, else overview while editing and follow while the game runs. */
  function effectiveView(): StageView {
    return rememberedView ?? (phase === 'edit' ? 'overview' : 'follow');
  }
  function syncViewButton(): void {
    const following = effectiveView() === 'follow';
    viewBtn.textContent = following ? T.viewFollow : T.viewOverview;
    viewBtn.setAttribute('aria-label', following ? T.viewToOverview : T.viewToFollow);
    viewBtn.title = following ? T.viewToOverview : T.viewToFollow;
  }
  viewBtn.addEventListener('click', () => {
    rememberedView = effectiveView() === 'follow' ? 'overview' : 'follow';
    frameStage();
  });

  /** Tells the game view which part of the stage is free of the HUD and task box, so the scene fills that part. */
  function frameStage(): void {
    syncViewButton();
    const H = stageSec.clientHeight;
    if (H <= 0) return;
    const topEdge = viewBtn.hidden ? hud.offsetTop + hud.offsetHeight : viewBtn.offsetTop + viewBtn.offsetHeight;
    const top = Math.min(0.45, (topEdge + 8) / H);
    const bottom = Math.min(0.55, (H - task.offsetTop + 8) / H);
    const camera = level.base.nodes.find((n) => n.kind === 'camera');
    const pitch = level.mode === '3d' && camera ? viewPitch(String(camera.params.view ?? 'free')).pitch : undefined;
    const follow = heroId !== null && effectiveView() === 'follow' ? heroId : null;
    stage.view.setStageFit({ top, bottom, follow, ...(pitch !== undefined ? { pitch } : {}) });
  }
  const stageObserver = new ResizeObserver(frameStage);
  stageObserver.observe(stageSec);
  stageObserver.observe(task);

  // ----- board (right) -----
  const boardEl = h('section', 'pz-board-host');
  boardEl.setAttribute('aria-label', T.boardAria);
  const bottom = h('div', 'pz-bottom');
  const trayEl = h('div', 'pz-tray');
  trayEl.setAttribute('role', 'group');
  trayEl.setAttribute('aria-label', T.trayAria);
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
  bottom.append(trayEl, actions);
  boardEl.append(bottom);

  const rotate = h('div', 'pz-rotate', T.rotate);
  screen.append(stageSec, boardEl, rotate);
  root.replaceChildren(phone);

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
    setTaskOpen(true);
    showPreview();
  }

  function finish(result: GameResult, message: string): void {
    if (phase !== 'run' || !board) return;
    stopWatch();
    stage.view.stop(); // hides the view's own end card; the last frame stays on the canvas
    board.freezeEnergy();
    setPhase('ended');
    if (result !== 'win') {
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
    showWin(stars);
  }

  function showWin(stars: 1 | 2 | 3): void {
    const card = h('div', 'pz-win-card');
    card.append(h('h3', '', T.winTitle), starsEl(stars, 'pz-stars big'), h('p', '', T.winNote(stars, extraHints(level, hintsUsed))));
    const row = h('div', 'pz-win-row');
    const retry = h('button', 'pz-btn ghost', T.winRetry);
    retry.type = 'button';
    retry.addEventListener('click', backToEdit);
    const list = h('button', 'pz-btn ghost', T.winList);
    list.type = 'button';
    list.addEventListener('click', () => ctx.go('#/'));
    row.append(retry);
    if (ctx.next) row.append(list);
    const nextBtn = h('button', 'pz-btn run', ctx.next ? T.winNext : T.winList);
    nextBtn.type = 'button';
    nextBtn.addEventListener('click', () => ctx.go(ctx.next ? `#/level/${ctx.next.id}` : '#/'));
    card.append(nextBtn, row);
    const overlay = h('div', 'pz-win');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', T.winTitle);
    overlay.append(card);
    screen.append(overlay);
    nextBtn.focus();
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
    board.setRunning(true, () => stage.view.getRuntime());
    watchRaf = requestAnimationFrame(watchTime);
  }

  stage.onEnd = finish;

  board = createBoardView({ level, board: boardEl, trayEl, bottomEl: bottom, onChange: schedulePreview });
  guide = createGuide({ level, screen, board, runBtn, isEditing: () => phase === 'edit' });

  // ----- buttons -----
  runBtn.addEventListener('click', () => (phase === 'edit' ? run() : backToEdit()));
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
    if (guide.hint()) {
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
  back.addEventListener('click', () => ctx.go('#/'));

  // The stage canvas was sized while it sat elsewhere; fit it to its new home, then draw the first scene.
  requestAnimationFrame(() => {
    frameStage();
    stage.view.resize();
    showPreview();
  });
  showPreview();
  // Level 1 leads the first visit with the guide (no skip); "↻ Hướng dẫn" brings it back later.
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
    stopWatch();
    stageObserver.disconnect();
    stage.onEnd = null;
    stage.view.stop();
    board?.destroy();
    board = null;
    stage.el.remove();
    root.replaceChildren();
  };
}
