import { lookThumbnails } from '../render/character-thumbnails';
import { h } from './dom';

export interface LookPickerOptions {
  options: readonly { value: string; label: string }[];
  value: string;
  /** Current main color of the character, so thumbnails match what the player will see. */
  getColor: () => string;
  onPick: (value: string) => void;
  /** Overridable for tests / environments without WebGL. */
  thumbnails?: (looks: readonly string[], color: string) => Map<string, string>;
}

export interface LookPicker {
  el: HTMLElement;
  /** Re-render the thumbnails after the character color changed. Coalesced to one render per frame. */
  refreshColor(): void;
  dispose(): void;
}

/**
 * Grid of clickable tiles, one per look, each with a small rendered picture and the Vietnamese label.
 * Behaves as a radio group: one tab stop, arrow keys move the choice, Space/Enter picks the focused tile.
 */
export function createLookPicker(opts: LookPickerOptions): LookPicker {
  const makeThumbs = opts.thumbnails ?? lookThumbnails;
  const el = h('div', 'look-picker');
  el.setAttribute('role', 'radiogroup');
  el.setAttribute('aria-label', 'Kiểu dáng');
  const values = opts.options.map((o) => o.value);
  let selected = values.includes(opts.value) ? opts.value : (values[0] ?? '');
  const tiles = new Map<string, { btn: HTMLButtonElement; img: HTMLImageElement }>();

  function paintSelection(): void {
    for (const [value, { btn }] of tiles) {
      const on = value === selected;
      btn.classList.toggle('selected', on);
      btn.setAttribute('aria-checked', String(on));
      btn.tabIndex = on ? 0 : -1;
    }
  }

  function paintThumbs(): void {
    const urls = makeThumbs(values, opts.getColor());
    for (const [value, { img }] of tiles) {
      const url = urls.get(value);
      if (url) {
        img.src = url;
        img.hidden = false;
      } else {
        img.hidden = true;
      }
    }
  }

  function pick(value: string, focus: boolean): void {
    const tile = tiles.get(value);
    if (!tile) return;
    const changed = value !== selected;
    selected = value;
    paintSelection();
    if (focus) tile.btn.focus();
    if (changed) opts.onPick(value);
  }

  for (const o of opts.options) {
    const btn = h('button', 'look-tile');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.dataset.look = o.value;
    const img = h('img', 'look-thumb');
    img.alt = '';
    img.width = 72;
    img.height = 72;
    img.draggable = false;
    img.hidden = true;
    btn.append(img, h('span', 'look-name', o.label));
    btn.addEventListener('click', () => pick(o.value, false));
    btn.addEventListener('keydown', (e) => {
      const i = values.indexOf(o.value);
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % values.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + values.length) % values.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = values.length - 1;
      if (next < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const target = values[next];
      if (target !== undefined) pick(target, true);
    });
    tiles.set(o.value, { btn, img });
    el.append(btn);
  }
  paintSelection();
  paintThumbs();

  let frame = 0;
  return {
    el,
    refreshColor() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        paintThumbs();
      });
    },
    dispose() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}
