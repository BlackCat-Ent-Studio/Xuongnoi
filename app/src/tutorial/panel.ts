import { h } from '../editor/dom';
import { TUTORIAL_UI as T } from './text-vi';
import type { Step } from './types';

export interface StepView {
  lessonTitle: string;
  step: Step;
  index: number;
  total: number;
  held: boolean;
  isLast: boolean;
  canGoBack: boolean;
}

export interface PanelActions {
  onBack(): void;
  onNext(): void;
  onExit(): void;
}

export interface StepPanel {
  el: HTMLElement;
  show(view: StepView): void;
  hide(): void;
}

/** Small floating card with the current instruction. Draggable by its header so it never blocks the board. */
export function createStepPanel(actions: PanelActions): StepPanel {
  const el = h('div', 'tut-panel');
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Hướng dẫn');

  const head = h('div', 'tut-head');
  const progress = h('span', 'tut-progress');
  const lessonName = h('span', 'tut-lesson');
  const exitBtn = h('button', 'tut-exit', `✕ ${T.exit}`);
  exitBtn.type = 'button';
  exitBtn.title = T.exitTitle;
  exitBtn.addEventListener('click', actions.onExit);
  head.append(progress, lessonName, exitBtn);

  const title = h('div', 'tut-title');
  const text = h('div', 'tut-text');
  const explain = h('div', 'tut-explain');

  const foot = h('div', 'tut-actions');
  const backBtn = h('button', 'btn tut-btn', T.back);
  backBtn.type = 'button';
  backBtn.addEventListener('click', actions.onBack);
  const skipBtn = h('button', 'tut-skip', T.skip);
  skipBtn.type = 'button';
  skipBtn.addEventListener('click', actions.onNext);
  const nextBtn = h('button', 'btn primary tut-btn', T.next);
  nextBtn.type = 'button';
  nextBtn.dataset.tut = 'next';
  nextBtn.addEventListener('click', actions.onNext);
  foot.append(backBtn, skipBtn, nextBtn);

  el.append(head, title, text, explain, foot);

  // ---- dragging ----
  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest('button'))) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const move = (ev: PointerEvent): void => {
      const x = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - 80);
      const y = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 40);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    e.preventDefault();
  });

  return {
    el,
    show(v) {
      progress.textContent = T.stepOf(v.index + 1, v.total);
      lessonName.textContent = v.lessonTitle;
      title.textContent = v.step.title;
      text.textContent = v.step.text;
      explain.textContent = v.step.explain ?? '';
      explain.hidden = !v.step.explain;
      backBtn.disabled = !v.canGoBack;
      const info = !v.step.check;
      // Info steps and held (went back) steps wait for the learner; the rest advance by themselves.
      nextBtn.hidden = !(info || v.held);
      nextBtn.textContent = v.isLast ? T.finish : info ? T.next : T.nextHeld;
      skipBtn.hidden = info || v.held || v.isLast;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
  };
}
