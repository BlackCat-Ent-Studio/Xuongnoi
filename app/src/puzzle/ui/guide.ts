import { h } from '../../editor/dom';
import type { PortRef } from '../../engine/types';
import type { PuzzleLevel } from '../types';
import type { BoardState, PortEnd } from './board-state';
import type { BoardView } from './board-view';
import { buildGuideSteps, currentStepIndex, hintLineOf, isStepDone, nextHintStep, resolveSolutionNode, winLine, type GuideStep } from './guide-script';
import { createMascot, type Mascot } from './mascot';
import { PUZZLE_UI_TEXT as T } from './puzzle-text';

import './guide.css';

/**
 * The visual tutorial: Mèo Mun talks, a dim spotlight rings the next thing to tap, a hand taps it and the wire
 * about to be made shows as a dotted "ghost" line. The overlay never takes taps (pointer-events: none), so the
 * player always taps the real piece underneath. Steps come from the level's solution and advance only when the
 * player has really done them (the current step is always "the first one not done yet").
 */

const POLL_MS = 120;
const HINT_SHOW_MS = 7000;
/** While the player is mid-way through a hinted step (port picked, editor open) the help stays this much longer. */
const HINT_BUSY_MS = 3500;
const BYE_SHOW_MS = 4500;
const TIP_SHOW_MS = 4000;
/** Smallest ring (px) so the target stays a comfortable finger size. */
const MIN_RING = 44;

const HAND_SVG =
  '<svg class="pz-hand" viewBox="0 0 64 64" aria-hidden="true"><path d="M26 6c3 0 5 2 5 5v17l3-1c3-1 6 1 6 4v1l2-1c3-1 6 1 6 4v1l1 0c3 0 5 2 5 5v8c0 9-7 16-16 16h-5c-6 0-11-3-14-8L11 41c-1-3 0-6 3-7s5 1 6 3l1 2V11c0-3 2-5 5-5z" fill="#fff" stroke="#241a4a" stroke-width="3" stroke-linejoin="round"/></svg>';

export interface GuideOptions {
  level: PuzzleLevel;
  /** The level screen (`.pz-screen`): the overlay is added here and it gets `guiding` while the guide is on. */
  screen: HTMLElement;
  board: BoardView;
  runBtn: HTMLElement;
  /** True while the player is editing (not running or looking at a result). */
  isEditing(): boolean;
}

export interface Guide {
  /** Starts (or restarts) the guide from its first line. The caller resets the board first when replaying. `skippable` false hides "Bỏ qua". */
  start(skippable: boolean): void;
  /** True while the guide is leading (even when briefly hidden during a run). */
  readonly active: boolean;
  /**
   * "?": the cat, ring and hand show the first step not done yet (and its dotted wire). Returns true when a
   * step was revealed (the caller counts it), false when everything is joined or the guide is leading.
   */
  hint(): boolean;
  /** The cat pops up with each line in turn (no ring, no hand), each for a few seconds or until tapped. */
  tips(lines: readonly string[]): void;
  /** Re-reads the game phase right away (the guide hides during a run). */
  refresh(): void;
  /** The level was won: the cat cheers if the guide was leading. */
  celebrate(): void;
  dispose(): void;
}

type Mode = 'off' | 'guide' | 'bye';

export function createGuide(opts: GuideOptions): Guide {
  const { level, screen, board, runBtn, isEditing } = opts;
  const steps = buildGuideSteps(level);

  // ----- DOM -----
  const root = h('div', 'pz-guide');
  root.setAttribute('aria-label', T.guideAria);
  const spot = h('div', 'pz-spot');
  const sayGhost = h('span', 'pz-say-ghost');
  const sayTyped = h('span', 'pz-say-typed');
  sayTyped.setAttribute('aria-hidden', 'true');
  const say = h('span', 'pz-say');
  say.append(sayGhost, sayTyped);
  const dots = h('span', 'pz-dots');
  const nextBtn = h('button', 'pz-guide-btn pz-next', T.guideNext);
  nextBtn.type = 'button';
  const skipBtn = h('button', 'pz-guide-btn pz-skip', T.guideSkip);
  skipBtn.type = 'button';
  const btns = h('span', 'pz-bubble-btns');
  btns.append(nextBtn, skipBtn);
  const bubble = h('div', 'pz-bubble');
  bubble.append(say, dots, btns);
  const mascotEl = h('div', 'pz-mascot');
  const mascot: Mascot = createMascot(sayTyped);
  mascot.el.setAttribute('aria-label', T.guideCatAria);
  mascotEl.append(mascot.el, bubble);
  root.append(spot);
  root.insertAdjacentHTML('beforeend', HAND_SVG);
  root.append(mascotEl);
  const hand = root.querySelector<SVGElement>('.pz-hand');
  screen.append(root);

  // ----- state -----
  let mode: Mode = 'off';
  let introDone = false;
  let shownIdx = -1;
  let lastStep: GuideStep | null = null;
  /** "?" in progress: the step it points at and when its ring fades. */
  let hintStep: GuideStep | null = null;
  let hintUntil = 0;
  /** A hint's ghost wire stays until that wire is joined. */
  let hintGhost: Extract<GuideStep, { type: 'wire' }> | null = null;
  let byeTimer = 0;
  const state = (): BoardState => board.state();

  let shownKey = '';
  function setShown(on: boolean, flags: { hinting?: boolean; bye?: boolean; tip?: boolean } = {}): void {
    root.classList.toggle('on', on);
    root.classList.toggle('hinting', !!flags.hinting);
    root.classList.toggle('bye', !!flags.bye || !!flags.tip);
    root.classList.toggle('tip', !!flags.tip);
    const key = String(on);
    if (key !== shownKey) mascot.setVisible(on);
    shownKey = key;
  }

  function setGuiding(on: boolean): void {
    screen.classList.toggle('guiding', on);
  }

  // ----- aiming -----

  const endOf = (ref: PortRef, dir: 'in' | 'out'): PortEnd | null => {
    const node = resolveSolutionNode(level, state(), ref.node);
    return node ? { node, port: ref.port, dir } : null;
  };

  /** Where the ring and hand go for a step, plus the ghost wire to draw (wire steps only). */
  function targetOf(step: GuideStep): { el: HTMLElement | null; ghost: { from: PortRef; to: PortRef } | null } {
    switch (step.type) {
      case 'piece':
        return { el: board.chipEl(step.slot), ghost: null };
      case 'run':
        return { el: runBtn, ghost: null };
      case 'param': {
        const node = resolveSolutionNode(level, state(), step.solNode);
        if (!node) return { el: null, ghost: null };
        return { el: paramTarget(node, step), ghost: null };
      }
      case 'wire': {
        const from = endOf(step.wire.from, 'out');
        const to = endOf(step.wire.to, 'in');
        if (!from || !to) return { el: null, ghost: null };
        const picked = board.pickedEnd();
        const same = (a: PortEnd | null, b: PortEnd): boolean => !!a && a.node === b.node && a.port === b.port && a.dir === b.dir;
        // Output first; once it is picked, point at the input (and the other way round).
        const el = same(picked, from) ? board.portEl(to) : same(picked, to) ? board.portEl(from) : board.portEl(from);
        return { el, ghost: { from: { node: from.node, port: from.port }, to: { node: to.node, port: to.port } } };
      }
      default:
        return { el: null, ghost: null };
    }
  }

  /** The param row, or once its editor is open the button that moves the number the right way. */
  function paramTarget(nodeId: string, step: Extract<GuideStep, { type: 'param' }>): HTMLElement | null {
    const pop = board.popoverEl();
    if (pop && pop.dataset.node === nodeId && pop.dataset.param === step.paramId) {
      if (typeof step.value === 'string') {
        return Array.from(pop.querySelectorAll<HTMLElement>('.pz-pop-opt')).find((b) => b.dataset.value === step.value) ?? pop;
      }
      const cur = Number(pop.querySelector('.pz-pop-num')?.textContent);
      const buttons = pop.querySelectorAll<HTMLElement>('.pz-step');
      const pick = Number.isFinite(cur) && cur > Number(step.value) ? buttons[0] : buttons[1];
      return pick ?? pop;
    }
    return board.paramEl(nodeId, step.paramId);
  }

  function aim(el: HTMLElement | null): void {
    const r = el?.isConnected ? el.getBoundingClientRect() : null;
    if (!r || r.width === 0 || r.height === 0) {
      root.classList.add('no-target');
      return;
    }
    root.classList.remove('no-target');
    const S = screen.getBoundingClientRect();
    const pad = Math.max(10, Math.min(r.width, r.height) * 0.25);
    const w = Math.max(MIN_RING, r.width + pad * 2);
    const hh = Math.max(MIN_RING, r.height + pad * 2);
    const cx = r.left - S.left + r.width / 2;
    const cy = r.top - S.top + r.height / 2;
    Object.assign(spot.style, { left: `${cx - w / 2}px`, top: `${cy - hh / 2}px`, width: `${w}px`, height: `${hh}px` });
    if (hand) {
      // Keep the whole hand on screen when the target sits near the bottom edge.
      const handH = hand.getBoundingClientRect().height;
      hand.style.left = `${cx}px`;
      hand.style.top = `${Math.min(cy, S.height - handH * 0.8)}px`;
    }
  }

  // ----- the leading guide -----

  function speak(text: string, mood: 'normal' | 'happy' = 'normal'): void {
    sayGhost.textContent = text;
    mascot.talk(text, mood);
  }

  function showStep(idx: number): void {
    const step = steps[idx];
    if (!step) return;
    if (lastStep?.type === 'param' && step.type !== 'param') board.closePopover();
    lastStep = step;
    shownIdx = idx;
    speak(step.text);
    dots.replaceChildren(...steps.map((_, k) => h('i', k <= idx ? 'on' : '')));
    nextBtn.hidden = step.type !== 'intro';
    const t = targetOf(step);
    board.setGhost(t.ghost?.from ?? null, t.ghost?.to);
  }

  function updateGuide(): void {
    if (!isEditing()) {
      setShown(false); // hidden during a run; back after a lost run
      if (shownIdx >= 0) board.setGhost(null);
      shownIdx = -1;
      return;
    }
    const idx = currentStepIndex(steps, level, state(), false, introDone);
    const step = steps[idx];
    if (!step) return;
    setShown(true);
    setGuiding(true);
    if (idx !== shownIdx) showStep(idx);
    const t = targetOf(step);
    // A wire step keeps its ghost line current (cards move when pieces are added).
    board.setGhost(t.ghost?.from ?? null, t.ghost?.to);
    aim(step.type === 'intro' ? null : t.el);
  }

  // ----- the "?" hint -----

  function clearHint(): void {
    hintStep = null;
    if (hintGhost) board.setGhost(null);
    hintGhost = null;
    if (mode !== 'guide') {
      setShown(false);
      setGuiding(false);
    }
  }

  /** The help goes away when its step is done, after a few seconds, or when the cat is tapped. */
  function updateHint(): void {
    if (!hintStep) return;
    if (!isEditing() || isStepDone(hintStep, level, state(), false)) {
      clearHint();
      return;
    }
    const busy = hintStep.type === 'wire' ? board.pickedEnd() !== null : hintStep.type === 'param' ? board.popoverEl() !== null : false;
    if (busy) hintUntil = Math.max(hintUntil, Date.now() + HINT_BUSY_MS);
    if (Date.now() > hintUntil) {
      clearHint();
      return;
    }
    if (hintGhost) {
      const t = targetOf(hintGhost);
      board.setGhost(t.ghost?.from ?? null, t.ghost?.to);
    }
    aim(targetOf(hintStep).el);
  }

  // ----- new-piece tips -----

  let tipQueue: string[] = [];
  let tipTimer = 0;

  function clearTips(): void {
    window.clearTimeout(tipTimer);
    tipQueue = [];
    if (root.classList.contains('tip') && mode === 'off') setShown(false);
  }

  function nextTip(): void {
    window.clearTimeout(tipTimer);
    const line = tipQueue.shift();
    if (line === undefined || mode !== 'off' || hintStep || !isEditing()) {
      clearTips();
      return;
    }
    setShown(true, { tip: true });
    speak(line);
    tipTimer = window.setTimeout(nextTip, TIP_SHOW_MS);
  }

  // ----- timer -----

  function tick(): void {
    if (mode === 'guide') updateGuide();
    else if (hintStep) updateHint();
    else if (mode === 'off' && !isEditing() && root.classList.contains('tip')) clearTips();
  }
  const timer = window.setInterval(tick, POLL_MS);
  const onResize = (): void => tick();
  window.addEventListener('resize', onResize);

  function stop(): void {
    mode = 'off';
    window.clearTimeout(byeTimer);
    shownIdx = -1;
    lastStep = null;
    board.setGhost(null);
    setShown(false);
    setGuiding(false);
  }

  skipBtn.addEventListener('click', stop);
  nextBtn.addEventListener('click', () => {
    introDone = true;
    tick();
  });
  bubble.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (mode === 'off' && hintStep) clearHint(); // tapping the cat dismisses a "?" step
    else if (mode === 'off' && (tipQueue.length > 0 || root.classList.contains('tip'))) nextTip(); // next tip, or none
    else mascot.finish();
  });

  return {
    get active() {
      return mode === 'guide';
    },
    start(skippable) {
      if (steps.length === 0) return;
      window.clearTimeout(byeTimer);
      clearHint();
      clearTips();
      skipBtn.hidden = !skippable;
      mode = 'guide';
      introDone = false;
      shownIdx = -1;
      lastStep = null;
      updateGuide();
    },
    hint() {
      if (!isEditing() || mode !== 'off') return false;
      clearTips();
      const step = nextHintStep(level, state());
      hintGhost = null;
      board.setGhost(null);
      hintUntil = Date.now() + HINT_SHOW_MS;
      if (!step) {
        hintStep = { type: 'run', text: T.hintAllJoined };
      } else {
        hintStep = step;
        if (step.type === 'wire') hintGhost = step;
      }
      setShown(true, { hinting: true });
      setGuiding(false);
      speak(step ? hintLineOf(step) : T.hintAllJoined);
      updateHint();
      return step !== null;
    },
    tips(lines) {
      if (mode !== 'off' || hintStep || lines.length === 0) return;
      tipQueue = [...lines];
      nextTip();
    },
    refresh: tick,
    celebrate() {
      if (mode !== 'guide') return;
      mode = 'bye';
      board.setGhost(null);
      setShown(true, { bye: true });
      speak(winLine(level), 'happy');
      byeTimer = window.setTimeout(stop, BYE_SHOW_MS);
    },
    dispose() {
      window.clearInterval(timer);
      window.clearTimeout(byeTimer);
      window.clearTimeout(tipTimer);
      window.removeEventListener('resize', onResize);
      mascot.dispose();
      root.remove();
      setGuiding(false);
    },
  };
}
