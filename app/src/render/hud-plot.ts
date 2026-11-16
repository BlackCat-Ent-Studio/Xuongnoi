import type { HudItem, HudWidget } from '../engine/types';
import { plotFraction } from '../nodes/plot-buffer';

type PlotWidget = Extract<HudWidget, { type: 'plot' }>;

const BACKDROP = 'color:#fff;background:rgba(10,12,16,0.6);padding:2px 8px;border-radius:6px;';
const PANEL_BG = 'rgba(10,12,16,0.6)';
const GRID = 'rgba(255,255,255,0.14)';
const ZERO = 'rgba(255,255,255,0.35)';

function fmt(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(2);
}

/**
 * Draws one scrolling chart into a HUD cell: a caption, a canvas (2D context, no filters) and a legend with the
 * latest values. The caller repaints only when the widget's `rev` changes, so a run redraws about 20 times a second.
 */
export function paintPlot(el: HTMLElement, item: HudItem, w: PlotWidget): void {
  el.dataset.uiPlot = item.key;
  el.style.cssText = 'display:flex;flex-direction:column;gap:3px;';
  const caption = document.createElement('div');
  caption.textContent = item.label;
  caption.style.cssText = `${BACKDROP}align-self:flex-start;font-size:14px;`;
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  canvas.width = Math.round(w.width * dpr);
  canvas.height = Math.round(w.height * dpr);
  canvas.style.cssText = `width:${w.width}px;height:${w.height}px;border-radius:6px;background:${PANEL_BG};`;
  const children: HTMLElement[] = [caption, canvas];
  if (w.legend) children.push(legendRow(w));
  el.replaceChildren(...children);
  drawPlot(canvas, w, dpr);
}

function legendRow(w: PlotWidget): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `${BACKDROP}display:flex;flex-direction:column;gap:1px;font-size:13px;text-align:left;align-self:stretch;`;
  for (const t of w.traces) {
    const line = document.createElement('div');
    const dot = document.createElement('span');
    dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:${t.color};`;
    line.append(dot, document.createTextNode(`${t.label}: ${fmt(t.current)}`));
    row.appendChild(line);
  }
  return row;
}

export function drawPlot(canvas: HTMLCanvasElement, w: PlotWidget, dpr: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  const pad = 4 * dpr;
  const top = pad;
  const plotH = ch - pad * 2;
  const range = { min: w.min, max: w.max };
  const yOf = (v: number): number => top + (1 - plotFraction(v, range)) * plotH;

  ctx.lineWidth = 1;
  ctx.strokeStyle = GRID;
  ctx.beginPath();
  for (let g = 0; g <= 4; g++) {
    const y = Math.round(top + (g / 4) * plotH) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(cw, y);
  }
  ctx.stroke();
  if (w.min < 0 && w.max > 0) {
    ctx.strokeStyle = ZERO;
    ctx.beginPath();
    const y0 = Math.round(yOf(0)) + 0.5;
    ctx.moveTo(0, y0);
    ctx.lineTo(cw, y0);
    ctx.stroke();
  }

  // Scale labels at the two ends.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${10 * dpr}px system-ui,sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(fmt(w.max), 3 * dpr, top);
  ctx.textBaseline = 'bottom';
  ctx.fillText(fmt(w.min), 3 * dpr, ch - pad);

  ctx.lineWidth = 2 * dpr;
  ctx.lineJoin = 'round';
  for (const t of w.traces) {
    if (t.values.length === 0) continue;
    ctx.strokeStyle = t.color;
    ctx.beginPath();
    // Samples fill the chart from the left; once the window is full the oldest scroll off the left edge.
    const step = (cw - pad * 2) / Math.max(1, w.points - 1);
    const x0 = pad;
    t.values.forEach((v, k) => {
      const x = x0 + k * step;
      if (k === 0) ctx.moveTo(x, yOf(v));
      else ctx.lineTo(x, yOf(v));
    });
    ctx.stroke();
  }
}
