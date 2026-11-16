import type { HudCorner, HudItem } from '../engine/types';
import { paintPlot } from './hud-plot';

export const HUD_CORNER_LIST: HudCorner[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/** Where a screen-corner column sits and which way its text leans. */
export function cornerStyle(c: HudCorner): string {
  const v = c.startsWith('top') ? 'top:8px;' : 'bottom:8px;';
  const h = c.endsWith('left') ? 'left:8px;text-align:left;align-items:flex-start;' : 'right:8px;text-align:right;align-items:flex-end;';
  return `position:absolute;${v}${h}display:flex;flex-direction:column;gap:4px;text-shadow:0 1px 2px rgba(0,0,0,0.6);`;
}

/** Text colour used when a HUD item sets none: white, for the dark backdrop. */
export const HUD_TEXT_COLOR = '#ffffff';
const BACKDROP_DARK = 'rgba(10,12,16,0.6)';
const BACKDROP_LIGHT = 'rgba(255,255,255,0.8)';

function isDarkColor(c: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) return false;
  const n = Number.parseInt(m[1] ?? '000000', 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.4;
}

/** Text colour and backdrop that keep `color` (default white) readable over any scene. A dark chosen colour gets a light backdrop. */
export function readableStyle(color?: string): { color: string; background: string } {
  const c = color ?? HUD_TEXT_COLOR;
  return { color: c, background: isDarkColor(c) ? BACKDROP_LIGHT : BACKDROP_DARK };
}

/** CSS for a rounded text backdrop. */
export function backdropCss(color?: string, radius = 6): string {
  const s = readableStyle(color);
  return `color:${s.color};background:${s.background};padding:2px 8px;border-radius:${radius}px;`;
}

/** Click and hold events a widget sends back to the game. */
export interface WidgetEvents {
  click(key: string): void;
  hold(key: string, down: boolean): void;
}

const BUTTON_CSS =
  'padding:8px 18px;font:inherit;color:#fff;border:0;border-radius:8px;cursor:pointer;pointer-events:auto;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
const BAR_TRACK_CSS = 'height:12px;min-width:120px;border-radius:6px;background:rgba(0,0,0,0.25);overflow:hidden;';

function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Button label colour that stays readable on any chosen fill. */
function onColor(bg: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(bg);
  if (!m) return '#fff';
  const n = Number.parseInt(m[1] ?? '000000', 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.65 ? '#1d2330' : '#fff';
}

/** Bar markup shared by corner bars and bars floating over an entity. */
export function fillBar(track: HTMLElement, fraction: number, color: string): void {
  let fill = track.firstElementChild as HTMLElement | null;
  if (!fill) {
    fill = document.createElement('div');
    track.appendChild(fill);
  }
  fill.style.cssText = `height:100%;width:${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%;background:${color};`;
}

export function barTrack(): HTMLElement {
  const track = document.createElement('div');
  track.style.cssText = BAR_TRACK_CSS;
  return track;
}

/** Corner widgets: on-screen buttons and bars. Elements persist between frames so a held button stays held. */
export class CornerWidgets {
  private readonly els = new Map<string, { el: HTMLElement; corner: HudCorner; sig: string }>();

  /** `columns`: one container per screen corner that the widgets are placed in. */
  constructor(
    private readonly columns: ReadonlyMap<HudCorner, HTMLElement>,
    private readonly events: WidgetEvents,
  ) {}

  /** `items` are the visible items that carry a button or bar widget and sit in a corner. */
  sync(items: readonly HudItem[]): void {
    const live = new Set<string>();
    for (const item of items) {
      const w = item.widget;
      if (!w || (w.type !== 'button' && w.type !== 'bar' && w.type !== 'plot')) continue;
      live.add(item.key);
      // A plot repaints only when its revision changes; hashing every sample each frame would defeat the point.
      const sig = w.type === 'plot' ? `plot|${w.rev}|${item.label}|${w.width}|${w.height}` : JSON.stringify([w, item.label, item.value, item.color]);
      let entry = this.els.get(item.key);
      if (entry && entry.sig === sig && entry.corner === item.corner) continue;
      if (!entry) {
        entry = { el: w.type === 'button' ? this.makeButton(item.key) : document.createElement('div'), corner: item.corner, sig: '' };
        this.els.set(item.key, entry);
      }
      entry.sig = sig;
      if (entry.corner !== item.corner || !entry.el.parentElement) {
        entry.corner = item.corner;
        this.columns.get(item.corner)?.appendChild(entry.el);
      }
      if (w.type === 'button') this.paintButton(entry.el, w.text, item.color ?? '#2b6cff');
      else if (w.type === 'plot') paintPlot(entry.el, item, w);
      else this.paintBar(entry.el, item, w.fraction);
    }
    for (const [key, entry] of this.els) {
      if (live.has(key)) continue;
      if (entry.el.dataset.held === '1') this.events.hold(key, false);
      entry.el.remove();
      this.els.delete(key);
    }
  }

  private makeButton(key: string): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.uiKey = key;
    btn.style.cssText = BUTTON_CSS;
    const release = (): void => {
      if (btn.dataset.held !== '1') return;
      btn.dataset.held = '0';
      this.events.hold(key, false);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      btn.dataset.held = '1';
      this.events.hold(key, true);
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.events.click(key);
    });
    return btn;
  }

  private paintButton(el: HTMLElement, text: string, color: string): void {
    el.textContent = text;
    el.style.background = color;
    el.style.color = onColor(color);
  }

  private paintBar(el: HTMLElement, item: HudItem, fraction: number): void {
    el.dataset.uiBar = item.key;
    el.style.cssText = 'display:flex;flex-direction:column;gap:2px;min-width:140px;';
    const caption = document.createElement('div');
    caption.textContent = `${item.label}: ${fmt(item.value)}`;
    caption.style.cssText = `${backdropCss()}align-self:flex-start;`;
    const track = barTrack();
    fillBar(track, fraction, item.color ?? '#e11d48');
    el.replaceChildren(caption, track);
  }
}
