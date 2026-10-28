import type { GameResult, HudCorner, HudItem } from '../engine/types';
import { TEXT_VI } from './text-vi';

const CORNERS: HudCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** Whole numbers as-is; fractional values (e.g. a running timer) rounded to one decimal. */
export function formatHudValue(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function cornerStyle(c: HudCorner): string {
  const v = c.startsWith('top') ? 'top:8px;' : 'bottom:8px;';
  const h = c.endsWith('left') ? 'left:8px;text-align:left;' : 'right:8px;text-align:right;';
  return `position:absolute;${v}${h}display:flex;flex-direction:column;gap:2px;text-shadow:0 1px 2px #fff;`;
}

/** A text bubble pinned to a screen position (its bottom-center). */
export interface FloatingLabel {
  key: string;
  text: string;
  color: string;
  x: number;
  y: number;
}

/** HTML overlay: corner HUD items, end-of-game panel, error message. */
export class Hud {
  readonly root = document.createElement('div');
  private readonly corners = new Map<HudCorner, HTMLElement>();
  private readonly overlay = document.createElement('div');
  private readonly errorBox = document.createElement('div');
  private readonly floating = new Map<string, HTMLElement>();
  private lastSig = '';

  constructor(private readonly onRestart: () => void) {
    this.root.style.cssText =
      'position:absolute;inset:0;pointer-events:none;font:600 16px system-ui,sans-serif;color:#1d2330;overflow:hidden;';
    for (const c of CORNERS) {
      const el = document.createElement('div');
      el.style.cssText = cornerStyle(c);
      this.corners.set(c, el);
      this.root.appendChild(el);
    }
    this.overlay.style.cssText =
      'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:rgba(255,255,255,0.7);pointer-events:auto;';
    this.errorBox.style.cssText =
      'position:absolute;left:50%;top:12px;transform:translateX(-50%);display:none;padding:6px 12px;border-radius:6px;background:#ffe3e3;color:#a11;font-size:14px;max-width:90%;';
    this.root.append(this.overlay, this.errorBox);
  }

  setItems(items: readonly HudItem[]): void {
    const shown = items.filter((i) => !i.hidden && i.anchor === undefined);
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
      if (el.textContent !== l.text) el.textContent = l.text;
      el.style.color = l.color;
      el.style.transform = `translate(${Math.round(l.x)}px,${Math.round(l.y)}px) translate(-50%,-100%)`;
    }
    for (const [key, el] of this.floating) {
      if (seen.has(key)) continue;
      el.remove();
      this.floating.delete(key);
    }
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
