import { h } from '../editor/dom';
import { icon } from '../editor/icons';
import { DOCK_TEXT as D } from './dock-text-vi';
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
  onShow(): void;
}

export interface StepPanel {
  el: HTMLElement;
  show(view: StepView): void;
  /** Back to the "pick a lesson" state. */
  hide(): void;
}

/** The step card inside the lessons dock: segmented progress, text and the step buttons. */
export function createStepPanel(actions: PanelActions): StepPanel {
  const el = h('div', 'ld-card');
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Hướng dẫn');

  const idle = h('div', 'ld-idle');
  idle.append(h('h3', '', D.idleTitle), h('p', '', D.idleText));

  const steps = h('div', 'ld-steps');
  const head = h('div', 'ld-head');
  const title = h('h3', 'ld-title');
  const where = h('span', 'ld-where');
  const exitBtn = h('button', 'btn ghost ld-exit', D.exit);
  exitBtn.type = 'button';
  exitBtn.title = D.exitTitle;
  exitBtn.dataset.tut = 'exit';
  exitBtn.addEventListener('click', actions.onExit);
  head.append(title, where, exitBtn);
  const text = h('p', 'ld-text');
  const explain = h('p', 'ld-explain');

  const foot = h('div', 'ld-btns');
  const showBtn = h('button', 'btn primary', D.show);
  showBtn.type = 'button';
  showBtn.title = D.showTitle;
  showBtn.dataset.tut = 'show';
  showBtn.prepend(icon('eye'));
  showBtn.addEventListener('click', actions.onShow);
  const backBtn = h('button', 'btn', D.back);
  backBtn.type = 'button';
  backBtn.dataset.tut = 'back';
  backBtn.addEventListener('click', actions.onBack);
  const nextBtn = h('button', 'btn', D.next);
  nextBtn.type = 'button';
  nextBtn.dataset.tut = 'next';
  nextBtn.addEventListener('click', actions.onNext);
  foot.append(showBtn, backBtn, nextBtn);

  const body = h('div', 'ld-body');
  body.append(steps, head, text, explain, foot);
  body.hidden = true;
  el.append(idle, body);

  return {
    el,
    show(v) {
      steps.replaceChildren();
      steps.setAttribute('aria-label', D.stepsAria(v.index + 1, v.total));
      for (let i = 0; i < v.total; i += 1) steps.append(h('i', i < v.index ? 'd' : i === v.index ? 'c' : ''));
      title.textContent = v.step.title;
      where.textContent = D.lessonStep(v.lessonTitle, v.index + 1, v.total);
      text.textContent = v.step.text;
      explain.textContent = v.step.explain ?? '';
      explain.hidden = !v.step.explain;
      showBtn.hidden = !v.step.target;
      backBtn.disabled = !v.canGoBack;
      // Info steps and held (went back) steps wait for the learner; the rest advance by themselves,
      // so for them the button is an explicit skip.
      const waiting = !v.step.check || v.held;
      nextBtn.textContent = v.isLast ? D.finish : waiting ? D.next : D.skip;
      nextBtn.title = waiting || v.isLast ? '' : D.skipTitle;
      nextBtn.classList.toggle('primary', waiting);
      idle.hidden = true;
      body.hidden = false;
    },
    hide() {
      body.hidden = true;
      idle.hidden = false;
    },
  };
}
