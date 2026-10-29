import type { GameResult, HudCorner, HudItem } from '../engine/types';
import { HudModals } from './hud-modals';
import { CornerWidgets, HUD_CORNER_LIST, barTrack, cornerStyle, fillBar, type WidgetEvents } from './hud-widgets';
import { TEXT_VI } from './text-vi';

/** Whole numbers as-is; fractional values (e.g. a running timer) rounded to one decimal. */
export function formatHudValue(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** A text bubble pinned to a screen position (its bottom-center). */
export interface FloatingLabel {
  key: string;
  text: string;
  color: string;
  x: number;
  y: number;
  /** Set = a bar of this fill (0..1) under the text instead of a plain bubble. */
  bar?: number;
}

/** HTML overlay: corner HUD items, end-of-game panel, error message. */
export class Hud {
  readonly root = document.createElement('div');
  private readonly corners = new Map<HudCorner, HTMLElement>();
  private readonly widgets: CornerWidgets;
  private readonly modals: HudModals;
  private pauseMenuReady = false;
  private readonly overlay = document.createElement('div');
  private readonly errorBox = document.createElement('div');
  private readonly floating = new Map<string, HTMLElement>();
  private lastSig = '';

  constructor(
    private readonly onRestart: () => void,
    events: WidgetEvents = { click: () => undefined, hold: () => undefined },
  ) {
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;font:600 16px system-ui,sans-serif;color:#1d2330;overflow:hidden;';
    const widgetColumns = new Map<HudCorner, HTMLElement>();
    for (const c of HUD_CORNER_LIST) {
      const column = document.createElement('div');
      column.style.cssText = cornerStyle(c);
      const texts = document.createElement('div');
      const widgets = document.createElement('div');
      widgets.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
      column.append(texts, widgets);
      this.corners.set(c, texts);
      widgetColumns.set(c, widgets);
      this.root.appendChild(column);
    }
    this.widgets = new CornerWidgets(widgetColumns, events);
    this.modals = new HudModals(this.root, events);
    this.overlay.style.cssText =
      'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,0.7);pointer-events:auto;';
    this.errorBox.style.cssText =
      'position:absolute;left:50%;top:12px;transform:translateX(-50%);display:none;padding:6px 12px;border-radius:6px;background:#ffe3e3;color:#a11;font-size:14px;max-width:90%;';
    this.root.append(this.overlay, this.errorBox);
  }

  setItems(items: readonly HudItem[]): void {
    this.widgets.sync(items.filter((i) => !i.hidden && i.anchor === undefined));
    this.pauseMenuReady = this.modals.sync(items);
    const shown = items.filter((i) => !i.hidden && i.anchor === undefined && i.widget === undefined);
    const sig = shown.map((i) => `${i.corner}|${i.key}|${i.label}|${i.value}|${i.text ?? ''}|${i.color ?? ''}`).join(';');
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    for (const el of this.corners.values()) el.replaceChildren();
    for (const item of shown) {
      const el = this.corners.get(item.corner);
      if (!el) continue;
      const row = document.createElement('div');
      row.textContent = item.text !== undefined ? item.text : `${item.label}: ${formatHudValue(item.value)}`;
      if (item.text !== undefined && item.color) row.style.color = item.color;
      el.appendChild(row);
    }
  }

  /** Labels floating over entities, at pixel positions inside the view. Labels not in the list are removed. */
  setFloating(labels: readonly FloatingLabel[]): void {
    const seen = new Set<string>();
    for (const l of labels) {
      seen.add(l.key);
      let el = this.floating.get(l.key);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText =
          'position:absolute;left:0;top:0;white-space:nowrap;padding:2px 8px;border-radius:10px;background:rgba(255,255,255,0.85);box-shadow:0 1px 4px rgba(0,0,0,0.25);font-size:14px;';
        this.floating.set(l.key, el);
        this.root.insertBefore(el, this.overlay);
      }
      if (l.bar === undefined) {
        if (el.textContent !== l.text) el.textContent = l.text;
      } else {
        this.paintFloatingBar(el, l);
      }
      el.style.color = l.color;
      el.style.transform = `translate(${Math.round(l.x)}px,${Math.round(l.y)}px) translate(-50%,-100%)`;
    }
    for (const [key, el] of this.floating) {
      if (seen.has(key)) continue;
      el.remove();
      this.floating.delete(key);
    }
  }

  private paintFloatingBar(el: HTMLElement, l: FloatingLabel): void {
    let track = el.querySelector<HTMLElement>('[data-ui-track]');
    if (!track) {
      track = barTrack();
      track.dataset.uiTrack = '1';
      el.replaceChildren(document.createElement('div'), track);
    }
    const caption = el.firstElementChild as HTMLElement;
    if (caption.textContent !== l.text) caption.textContent = l.text;
    fillBar(track, l.bar ?? 0, l.color);
  }

  /** True while a started game with a pause-menu start screen is on, so Esc may open the menu. */
  canPause(): boolean {
    return this.pauseMenuReady;
  }

  showPauseMenu(on: boolean, onResume: () => void): void {
    this.modals.showPause(on, onResume, this.onRestart);
  }

  pauseMenuShown(): boolean {
    return this.modals.pauseShown();
  }

  showEnd(result: GameResult, message: string): void {
    const title = document.createElement('div');
    title.textContent = result === 'win' ? TEXT_VI.win : TEXT_VI.lose;
    title.style.cssText = `font-size:40px;font-weight:800;color:${result === 'win' ? '#1b8a3a' : '#c0392b'};`;
    const msg = document.createElement('div');
    msg.textContent = message;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = TEXT_VI.restart;
    btn.style.cssText =
      'padding:8px 20px;font:inherit;border:0;border-radius:8px;background:#2b6cff;color:#fff;cursor:pointer;';
    btn.addEventListener('click', () => this.onRestart());
    this.overlay.replaceChildren(title, msg, btn);
    this.overlay.style.display = 'flex';
  }

  hideEnd(): void {
    this.modals.showPause(false, () => undefined, () => undefined);
    this.overlay.style.display = 'none';
    this.overlay.replaceChildren();
  }

  clearItems(): void {
    this.setItems([]);
    this.setFloating([]);
  }

  showError(text: string): void {
    this.errorBox.textContent = text;
    this.errorBox.style.display = 'block';
  }

  hideError(): void {
    this.errorBox.style.display = 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
