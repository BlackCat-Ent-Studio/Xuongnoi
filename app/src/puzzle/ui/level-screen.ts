import type { GameView } from '../../app-contracts';
import { TICK_DT, type GameResult } from '../../engine/types';
import { h } from '../../editor/dom';
import { starsFor } from '../run-level';
import type { PuzzleLevel } from '../types';
import { createBoardView, type BoardView } from './board-view';
import { graphOf, toAnswer } from './board-state';
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
  let hintUsed = false;
  let previewTimer = 0;
  let loseTimer = 0;
  let watchRaf = 0;
  let board: BoardView | null = null;

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
  task.append(h('b', '', T.task), document.createTextNode(level.task));
  stageSec.append(stage.el, hud, task);

  // ----- board (right) -----
  const boardEl = h('section', 'pz-board-host');
  boardEl.setAttribute('aria-label', T.boardAria);
  const bottom = h('div', 'pz-bottom');
  const trayEl = h('div', 'pz-tray');
  trayEl.setAttribute('role', 'group');
  trayEl.setAttribute('aria-label', T.trayAria);
  const hintBtn = h('button', 'pz-btn small', '?');
  hintBtn.type = 'button';
  hintBtn.setAttribute('aria-label', T.hint);
  hintBtn.title = T.hint;
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
    const stars = starsFor(level, answer, hintUsed);
    ctx.saveProgress(withBest(ctx.progress(), level.id, stars));
    hudStars.replaceWith(starsEl(starsOf(ctx.progress(), level.id), 'pz-stars'));
    showWin(stars);
  }

  function showWin(stars: 1 | 2 | 3): void {
    const card = h('div', 'pz-win-card');
    card.append(h('h3', '', T.winTitle), starsEl(stars, 'pz-stars big'), h('p', '', T.winNote(stars, hintUsed)));
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
    board.setRunning(true, () => stage.view.getRuntime());
    watchRaf = requestAnimationFrame(watchTime);
  }

  stage.onEnd = finish;

  board = createBoardView({ level, board: boardEl, trayEl, bottomEl: bottom, onChange: schedulePreview });

  // ----- buttons -----
  runBtn.addEventListener('click', () => (phase === 'edit' ? run() : backToEdit()));
  resetBtn.addEventListener('click', () => {
    if (phase !== 'edit') return;
    board?.reset();
  });
  hintBtn.addEventListener('click', () => {
    hintUsed = true;
    boardEl.querySelector('.pz-hint')?.remove();
    const box = h('div', 'pz-hint');
    box.setAttribute('role', 'note');
    const ok = h('button', 'pz-hint-ok', T.hintClose);
    ok.type = 'button';
    ok.addEventListener('click', () => box.remove());
    box.append(h('b', '', T.hint), h('p', '', level.hint), ok);
    boardEl.append(box);
  });
  back.addEventListener('click', () => ctx.go('#/'));

  // The stage canvas was sized while it sat elsewhere; fit it to its new home, then draw the first scene.
  requestAnimationFrame(() => {
    stage.view.resize();
    showPreview();
  });
  showPreview();

  return () => {
    window.clearTimeout(previewTimer);
    window.clearTimeout(loseTimer);
    stopWatch();
    stage.onEnd = null;
    stage.view.stop();
    board?.destroy();
    board = null;
    stage.el.remove();
    root.replaceChildren();
  };
}
