import type { HudItem } from '../engine/types';
import type { WidgetEvents } from './hud-widgets';
import { TEXT_VI } from './text-vi';

const BACKDROP_CSS =
  'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,0.72);pointer-events:auto;text-align:center;padding:16px;';
const BTN_CSS = 'padding:8px 22px;font:inherit;color:#fff;background:#2b6cff;border:0;border-radius:8px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.3);';

function backdrop(kind: string): HTMLElement {
  const el = document.createElement('div');
  el.dataset.uiModal = kind;
  el.style.cssText = BACKDROP_CSS;
  // Clicks on the card belong to the game, never to the editor behind it.
  for (const type of ['pointerdown', 'pointerup', 'click', 'wheel']) el.addEventListener(type, (e) => e.stopPropagation());
  return el;
}

function text(tag: string, content: string, css: string): HTMLElement {
  const el = document.createElement(tag);
  el.textContent = content;
  el.style.cssText = css;
  return el;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = BTN_CSS;
  b.addEventListener('click', onClick);
  return b;
}

/** Full-view cards: the start screen, a question box and the Esc pause menu. */
export class HudModals {
  private readonly start = backdrop('start');
  private readonly dialog = backdrop('dialog');
  private readonly pause = backdrop('pause');
  /** First card in the DOM: floating labels go in front of it so every card covers them. */
  readonly firstEl: HTMLElement = this.dialog;
  private startSig = '';
  private dialogSig = '';

  constructor(root: HTMLElement, private readonly events: WidgetEvents) {
    root.append(this.dialog, this.start, this.pause);
  }

  /** Shows the first visible start screen and question box; true when the start node asked for an Esc menu once started. */
  sync(items: readonly HudItem[]): boolean {
    let start: HudItem | undefined;
    let dialog: HudItem | undefined;
    let pauseMenu = false;
    for (const item of items) {
      const w = item.widget;
      if (w?.type === 'start') {
        if (!item.hidden) start ??= item;
        else if (w.pauseMenu) pauseMenu = true;
      } else if (w?.type === 'dialog' && !item.hidden) dialog ??= item;
    }
    this.paintStart(start);
    this.paintDialog(dialog);
    return pauseMenu && start === undefined;
  }

  private paintStart(item: HudItem | undefined): void {
    const w = item?.widget;
    if (!item || w?.type !== 'start') {
      this.start.style.display = 'none';
      this.startSig = '';
      return;
    }
    const sig = JSON.stringify([item.key, w]);
    this.start.style.display = 'flex';
    if (sig === this.startSig) return;
    this.startSig = sig;
    this.start.replaceChildren(
      text('div', w.title, 'font-size:36px;font-weight:800;'),
      button(w.buttonText, () => this.events.click(item.key)),
    );
  }

  private paintDialog(item: HudItem | undefined): void {
    const w = item?.widget;
    if (!item || w?.type !== 'dialog') {
      this.dialog.style.display = 'none';
      this.dialogSig = '';
      return;
    }
    const sig = JSON.stringify([item.key, w]);
    this.dialog.style.display = 'flex';
    if (sig === this.dialogSig) return;
    this.dialogSig = sig;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center;';
    w.answers.forEach((a, i) => row.appendChild(button(a, () => this.events.click(`${item.key}#${i}`))));
    this.dialog.replaceChildren(text('div', w.question, 'font-size:22px;font-weight:700;max-width:480px;'), row);
  }

  /** The Esc menu. `onResume` and `onRestart` run from its two buttons. */
  showPause(on: boolean, onResume: () => void, onRestart: () => void): void {
    if (!on) {
      this.pause.style.display = 'none';
      this.pause.replaceChildren();
      return;
    }
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;';
    row.append(button(TEXT_VI.resume, onResume), button(TEXT_VI.restart, onRestart));
    this.pause.replaceChildren(text('div', TEXT_VI.paused, 'font-size:32px;font-weight:800;'), row);
    this.pause.style.display = 'flex';
  }

  pauseShown(): boolean {
    return this.pause.style.display !== 'none';
  }
}
