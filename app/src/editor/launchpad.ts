import type { Board } from '../engine/types';
import { listSamples } from '../io';
import { LAUNCHPAD_TEXT as L } from '../tutorial/dock-text-vi';
import { h } from './dom';
import { icon, type IconName } from './icons';

export interface LaunchpadDeps {
  /** The wiring canvas element (positioned); the card is centred inside it. */
  host: HTMLElement;
  /** Current number of nodes on the board. */
  nodeCount(): number;
  isPlaying(): boolean;
  tutorialActive(): boolean;
  startLesson(): void;
  openSample(board: Board): void;
  /** Focus the palette search for the "Tự làm" path. */
  startBlank(): void;
}

export interface Launchpad {
  /** Re-evaluate visibility; call after any state change. */
  update(): void;
  /** A new board was loaded: the card may show again if it is empty. */
  boardLoaded(): void;
}

function option(iconName: IconName, title: string, hint: string, main = false): HTMLButtonElement {
  const b = h('button', main ? 'lp-opt main' : 'lp-opt');
  b.type = 'button';
  b.append(icon(iconName), h('b', '', title), h('small', '', hint));
  return b;
}

/** Centred card on an empty board offering the three ways to begin. */
export function mountLaunchpad(deps: LaunchpadDeps): Launchpad {
  const el = h('div', 'launchpad');
  el.hidden = true;
  const inner = h('div', 'launchpad-in');
  inner.dataset.launchpad = 'card';
  // The canvas pans and selects on pointer events; keep clicks on the card to the card.
  for (const type of ['pointerdown', 'wheel', 'dblclick']) {
    inner.addEventListener(type, (e) => e.stopPropagation());
  }
  el.append(inner);
  deps.host.append(el);

  let dismissed = false;

  function renderMain(): void {
    const learn = option('book', L.learn, L.learnHint, true);
    learn.dataset.launch = 'learn';
    learn.addEventListener('click', () => deps.startLesson());
    const sample = option('game', L.sample, L.sampleHint);
    sample.dataset.launch = 'sample';
    sample.addEventListener('click', renderSamples);
    const blank = option('blocks', L.blank, L.blankHint);
    blank.dataset.launch = 'blank';
    blank.addEventListener('click', () => {
      dismissed = true;
      update();
      deps.startBlank();
    });
    const opts = h('div', 'lp-opts');
    opts.append(learn, sample, blank);
    inner.replaceChildren(h('h2', '', L.title), h('p', '', L.hint), opts);
  }

  function renderSamples(): void {
    const samples = listSamples();
    const list = h('div', 'lp-samples');
    if (samples.length === 0) list.append(h('p', '', L.noSamples));
    for (const s of samples) {
      const b = h('button', 'lp-opt');
      b.type = 'button';
      b.dataset.sample = s.id;
      b.append(h('b', '', s.label));
      b.addEventListener('click', () => deps.openSample(structuredClone(s.board)));
      list.append(b);
    }
    const back = h('button', 'btn', L.samplesBack);
    back.type = 'button';
    back.addEventListener('click', renderMain);
    inner.replaceChildren(h('h2', '', L.samplesTitle), list, back);
  }

  function update(): void {
    const show = !dismissed && deps.nodeCount() === 0 && !deps.tutorialActive() && !deps.isPlaying();
    if (show && el.hidden) renderMain();
    el.hidden = !show;
  }

  renderMain();
  update();
  return {
    update,
    boardLoaded() {
      dismissed = false;
      update();
    },
  };
}
