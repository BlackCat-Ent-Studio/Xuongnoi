import { h } from '../editor/dom';
import { icon } from '../editor/icons';
import type { EditorState } from '../editor/editor-state';
import type { Board, GameResult } from '../engine/types';
import { DOCK_TEXT as D } from './dock-text-vi';
import { createHighlighter } from './highlight';
import { paletteKinds, pointsAtCanvas } from './palette-targets';
import './lessons-dock.css';
import { chapterOf, type Chapter } from './course';
import { LESSONS } from './lessons';
import { createStepPanel } from './panel';
import { createRunner, type Runner } from './runner';
import { takeSnapshot } from './snapshot';
import {
  clearStash,
  hasSeenInvite,
  loadProgress,
  markInviteSeen,
  saveProgress,
  writeStash,
} from './storage';
import { TUTORIAL_UI as T } from './text-vi';
import type { Lesson, Snapshot, TargetList } from './types';

const PLAY_SEL = '[data-tut="play"]';
const STOP_SEL = '.pbtn.stop';

export interface TutorialDeps {
  state: EditorState;
  notify(text: string, kind?: 'info' | 'error'): void;
  /** Called when a lesson starts, so the host can open the lessons dock. */
  onStart?(): void;
  /** Make a palette item reachable (clear search, expand its category, show the palette tab). */
  revealPaletteItem?(kind: string): void;
  /** Show the wiring canvas (centre tab) when the game view is on top of it. */
  revealGraph?(): void;
}

export interface Tutorial {
  /** Top-bar widget: the button, the lesson list and the first-launch invite. */
  el: HTMLElement;
  /** Lessons dock content (list + step card); mount it into the lessons dock. */
  dock: HTMLElement;
  /** Start the first lesson. */
  startFirst(): void;
  /** Start the lesson with this id; false when there is none. */
  startLesson(id: string): boolean;
  isActive(): boolean;
  /** Leave the lesson (if any) and give the learner's own board back. */
  exit(): void;
  noteGameEnd(result: GameResult): void;
  noteRestart(): void;
}

export function createTutorial({ state, notify, onStart, revealPaletteItem, revealGraph }: TutorialDeps): Tutorial {
  const highlighter = createHighlighter();
  const done = loadProgress();
  let runner: Runner | null = null;
  let stash: Board | null = null;
  let ended: GameResult | null = null;
  let pollTimer = 0;
  let revealedStep = '';

  // ---------- step panel ----------

  const panel = createStepPanel({
    onBack: () => {
      runner?.back();
      refresh();
    },
    onNext: () => {
      if (!runner) return;
      runner.next();
      if (runner.isFinished()) return finish();
      advance();
    },
    onExit: () => exit(),
    onShow: () => showMe(),
  });

  function snapshot(): Snapshot {
    return takeSnapshot(state, ended);
  }

  /** While a game runs the play button is disabled, so a step that points at it means the stop button. */
  function playAware(targets: TargetList): TargetList {
    if (!state.isPlaying()) return targets;
    return targets.map((t) => (t === PLAY_SEL ? STOP_SEL : t));
  }

  function refreshHighlight(): void {
    if (!runner) return;
    const step = runner.step();
    highlighter.apply(playAware(step.target ? step.target(snapshot()) : []));
  }

  /** Palette items can be hidden by a search or a collapsed category; open the way to them. */
  function revealTargets(): void {
    if (!runner || !revealPaletteItem) return;
    const step = runner.step();
    for (const kind of paletteKinds(step.target ? step.target(snapshot()) : [])) revealPaletteItem(kind);
  }

  /** "Chỉ cho tôi": reveal the targets and pulse them again. */
  function showMe(): void {
    if (!runner) return;
    revealTargets();
    if (revealGraph && pointsAtCanvas(runner.step().target?.(snapshot()) ?? [])) revealGraph();
    highlighter.clear();
    refreshHighlight();
    window.setTimeout(refreshHighlight, 0);
  }

  function refresh(): void {
    if (!runner) return;
    const stepKey = `${runner.lesson.id}:${runner.step().id}`;
    if (stepKey !== revealedStep) {
      revealedStep = stepKey;
      revealTargets();
    }
    panel.show({
      lessonTitle: runner.lesson.title,
      step: runner.step(),
      index: runner.index(),
      total: runner.total(),
      held: runner.isHeld(),
      isLast: runner.isLast(),
      canGoBack: runner.index() > 0,
    });
    refreshHighlight();
    // Other listeners rebuild the canvas after us; re-apply once the DOM settles.
    window.setTimeout(refreshHighlight, 0);
  }

  /** Let satisfied checks move the lesson forward, then redraw. */
  function advance(): void {
    if (!runner) return;
    runner.evaluate(snapshot());
    if (runner.isFinished()) return finish();
    refresh();
  }

  // ---------- lifecycle ----------

  function start(lesson: Lesson): void {
    // Starting a lesson from anywhere (launchpad, menu, list) answers the first-launch invite.
    invite.hidden = true;
    markInviteSeen();
    // Only the first lesson of a session stashes: switching lessons keeps the learner's own board.
    if (!stash) {
      stash = state.getBoard();
      writeStash(stash);
    }
    ended = null;
    revealedStep = '';
    state.setPlaying(false);
    runner = createRunner(lesson);
    renderList();
    onStart?.();
    state.loadBoard(lesson.createBoard());
    window.clearInterval(pollTimer);
    pollTimer = window.setInterval(refreshHighlight, 300);
    advance();
  }

  function leave(): void {
    const own = stash;
    runner = null;
    stash = null;
    ended = null;
    revealedStep = '';
    window.clearInterval(pollTimer);
    highlighter.clear();
    panel.hide();
    renderList();
    if (!own) return;
    state.setPlaying(false);
    state.loadBoard(own);
    clearStash();
  }

  function exit(): void {
    if (!runner) return;
    leave();
    notify(T.exited);
  }

  function finish(): void {
    if (!runner) return;
    const lesson = runner.lesson;
    done.add(lesson.id);
    saveProgress(done);
    leave();
    notify(T.finished(lesson.title));
  }

  state.subscribe((kind) => {
    if (!runner) return;
    if (kind === 'playing') ended = null;
    if (kind === 'graph' || kind === 'params' || kind === 'mode' || kind === 'board' || kind === 'playing' ||
      kind === 'selection' || kind === 'notes' || kind === 'history'
    ) {
      advance();
    }
  });

  // ---------- lessons dock ----------

  const dock = h('div', 'ld');
  const list = h('ul', 'ld-list');
  list.setAttribute('aria-label', D.listAria);
  dock.append(list, panel.el);

  function renderList(): void {
    list.replaceChildren();
    for (const lesson of LESSONS) {
      const isDone = done.has(lesson.id);
      const isCur = runner?.lesson.id === lesson.id;
      const item = h('button', `ld-item${isDone ? ' done' : ''}${isCur ? ' cur' : ''}`);
      item.type = 'button';
      item.dataset.lesson = lesson.id;
      item.title = lesson.summary;
      if (isCur) item.setAttribute('aria-current', 'true');
      const tick = h('span', 'ld-tick');
      if (isDone) {
        tick.append(icon('check'));
        tick.title = D.listDone;
      }
      item.append(tick, h('span', '', lesson.title));
      item.addEventListener('click', () => start(lesson));
      const li = h('li');
      li.append(item);
      list.append(li);
    }
  }
  renderList();

  // ---------- top-bar widget ----------

  const el = h('div', 'menu-wrap tut-wrap');
  const button = h('button', 'btn', T.button);
  button.type = 'button';
  button.dataset.tut = 'tutorial';
  const menu = h('div', 'menu tut-menu');
  menu.hidden = true;
  const invite = h('div', 'menu tut-invite');
  invite.hidden = true;
  el.append(button, menu, invite);

  function renderMenu(): void {
    const doneCount = LESSONS.filter((l) => done.has(l.id)).length;
    const head = h('div', 'tut-menu-head');
    const headText = h('div', 'tut-menu-head-text');
    headText.append(h('div', 'tut-menu-title', T.menuTitle), h('div', 'tut-menu-hint', T.menuHint));
    const progress = h('div', 'tut-menu-progress');
    const bar = h('div', 'tut-menu-bar');
    const fill = h('div', 'tut-menu-bar-fill');
    fill.style.width = `${(doneCount / LESSONS.length) * 100}%`;
    bar.append(fill);
    progress.append(bar, h('span', 'tut-menu-count', `${doneCount}/${LESSONS.length}`));
    head.append(headText, progress);
    const list = h('div', 'tut-menu-list');
    let chapter: Chapter | undefined;
    for (const lesson of LESSONS) {
      const ch = chapterOf(lesson.id);
      if (ch && ch !== chapter) {
        // One heading per chapter, with how many of its lessons are done.
        chapter = ch;
        const ids = LESSONS.filter((l) => chapterOf(l.id) === ch).map((l) => l.id);
        const sec = h('div', 'tut-chapter');
        sec.dataset.chapter = ch.id;
        sec.append(h('span', 'tut-chapter-title', ch.title), h('span', 'tut-chapter-count', `${ids.filter((id) => done.has(id)).length}/${ids.length}`));
        list.append(sec);
      }
      // Titles carry their number ("3. Thắng và thua"); show it as a badge instead.
      const match = /^(\d+)\.\s*(.*)$/.exec(lesson.title);
      const isDone = done.has(lesson.id);
      const item = h('button', `menu-item tut-lesson-item${isDone ? ' is-done' : ''}`);
      item.type = 'button';
      item.dataset.lesson = lesson.id;
      const body = h('span', 'tut-lesson-body');
      body.append(h('strong', 'tut-lesson-title', match ? match[2] : lesson.title), h('span', 'tut-lesson-summary', lesson.summary));
      item.append(h('span', 'tut-lesson-num', match ? match[1] : '•'), body);
      if (isDone) {
        const mark = h('span', 'tut-done', '✓');
        mark.title = T.done;
        mark.setAttribute('aria-label', T.done);
        item.append(mark);
      }
      item.addEventListener('click', () => {
        menu.hidden = true;
        start(lesson);
      });
      list.append(item);
    }
    menu.replaceChildren(head, list);
  }

  button.addEventListener('click', () => {
    invite.hidden = true;
    markInviteSeen();
    if (!menu.hidden) {
      menu.hidden = true;
      return;
    }
    renderMenu();
    menu.hidden = false;
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.target instanceof Node && !el.contains(e.target)) menu.hidden = true;
  });

  if (!hasSeenInvite()) {
    const yes = h('button', 'btn primary', T.inviteYes);
    yes.type = 'button';
    yes.dataset.tut = 'invite-yes';
    const no = h('button', 'btn', T.inviteNo);
    no.type = 'button';
    no.dataset.tut = 'invite-no';
    const row = h('div', 'tut-invite-row');
    row.append(yes, no);
    invite.append(h('div', 'tut-invite-text', T.inviteText), row);
    invite.hidden = false;
    const dismiss = (): void => {
      markInviteSeen();
      invite.hidden = true;
    };
    yes.addEventListener('click', () => {
      dismiss();
      const first = LESSONS[0];
      if (first) start(first);
    });
    no.addEventListener('click', dismiss);
  }

  return {
    el,
    dock,
    startFirst() {
      const first = LESSONS[0];
      if (first) start(first);
    },
    startLesson(id) {
      const lesson = LESSONS.find((l) => l.id === id);
      if (!lesson) return false;
      start(lesson);
      return true;
    },
    isActive: () => runner !== null,
    exit,
    noteGameEnd(result) {
      ended = result;
      advance();
    },
    noteRestart() {
      ended = null;
    },
  };
}
