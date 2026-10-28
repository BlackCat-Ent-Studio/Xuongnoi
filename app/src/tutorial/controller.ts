import { h } from '../editor/dom';
import type { EditorState } from '../editor/editor-state';
import type { Board, GameResult } from '../engine/types';
import { createHighlighter } from './highlight';
import { LESSONS } from './lessons';
import { createStepPanel } from './panel';
import { createRunner, type Runner } from './runner';
import {
  clearStash,
  hasSeenInvite,
  loadProgress,
  markInviteSeen,
  saveProgress,
  writeStash,
} from './storage';
import { TUTORIAL_UI as T } from './text-vi';
import type { Lesson, Snapshot } from './types';

export interface TutorialDeps {
  state: EditorState;
  notify(text: string, kind?: 'info' | 'error'): void;
}

export interface Tutorial {
  /** Top-bar widget: the button, the lesson list and the first-launch invite. */
  el: HTMLElement;
  /** Floating step card; append to the page body. */
  panel: HTMLElement;
  isActive(): boolean;
  /** Leave the lesson (if any) and give the learner's own board back. */
  exit(): void;
  noteGameEnd(result: GameResult): void;
  noteRestart(): void;
}

export function createTutorial({ state, notify }: TutorialDeps): Tutorial {
  const highlighter = createHighlighter();
  const done = loadProgress();
  let runner: Runner | null = null;
  let stash: Board | null = null;
  let ended: GameResult | null = null;
  let pollTimer = 0;

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
  });

  function snapshot(): Snapshot {
    return { graph: state.getGraph(), mode: state.getMode(), playing: state.isPlaying(), ended };
  }

  function refreshHighlight(): void {
    if (!runner) return;
    const step = runner.step();
    highlighter.apply(step.target ? step.target(snapshot()) : []);
  }

  function refresh(): void {
    if (!runner) return;
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
    // Only the first lesson of a session stashes: switching lessons keeps the learner's own board.
    if (!stash) {
      stash = state.getBoard();
      writeStash(stash);
    }
    ended = null;
    state.setPlaying(false);
    runner = createRunner(lesson);
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
    window.clearInterval(pollTimer);
    highlighter.clear();
    panel.hide();
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
    if (kind === 'graph' || kind === 'params' || kind === 'mode' || kind === 'board' || kind === 'playing') {
      advance();
    }
  });

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
    menu.replaceChildren(h('div', 'tut-menu-title', T.menuTitle), h('div', 'tut-menu-hint', T.menuHint));
    for (const lesson of LESSONS) {
      const item = h('button', 'menu-item tut-lesson-item');
      item.type = 'button';
      item.dataset.lesson = lesson.id;
      item.append(h('strong', '', lesson.title), h('span', 'tut-lesson-summary', lesson.summary));
      if (done.has(lesson.id)) item.append(h('span', 'tut-done', `✓ ${T.done}`));
      item.addEventListener('click', () => {
        menu.hidden = true;
        start(lesson);
      });
      menu.append(item);
    }
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
    panel: panel.el,
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
