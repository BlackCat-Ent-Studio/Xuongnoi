import { listNodeDefs } from '../engine/registry';
import type { NodeCategory } from '../engine/types';
import { NODE_CATEGORY_LABELS } from '../nodes';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { TEXT_VI } from './text-vi';

const CATEGORY_ORDER: NodeCategory[] = ['input', 'logic', 'math', 'object', 'output'];
const DRAG_THRESHOLD = 5;

export interface PaletteDeps {
  state: EditorState;
  /** Add a node. Coordinates are client px when dropped, or null for "add at the center". */
  onAdd(kind: string, clientX: number | null, clientY: number | null): void;
}

export function createPalette({ state, onAdd }: PaletteDeps): HTMLElement {
  const el = h('aside', 'palette');
  const title = h('div', 'panel-title', TEXT_VI.paletteTitle);
  const hint = h('div', 'panel-hint', TEXT_VI.paletteHint);
  const list = h('div', 'palette-list');
  el.append(title, hint, list);

  function render(): void {
    list.replaceChildren();
    const defs = listNodeDefs(state.getMode());
    for (const cat of CATEGORY_ORDER) {
      const inCat = defs.filter((d) => d.category === cat);
      if (inCat.length === 0) continue;
      const group = h('div', 'palette-group');
      group.append(h('div', `palette-cat cat-${cat}`, NODE_CATEGORY_LABELS[cat]));
      for (const def of inCat) {
        const item = h('button', `palette-item cat-${cat}`, def.label);
        item.type = 'button';
        item.title = def.description;
        item.dataset.kind = def.kind;
        attachDrag(item, def.kind);
        group.append(item);
      }
      list.append(group);
    }
  }

  function attachDrag(item: HTMLElement, kind: string): void {
    item.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state.isPlaying()) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost: HTMLElement | null = null;

      const move = (ev: PointerEvent): void => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
        if (!ghost) {
          ghost = h('div', 'drag-ghost', item.textContent ?? '');
          document.body.append(ghost);
        }
        ghost.style.left = `${ev.clientX + 8}px`;
        ghost.style.top = `${ev.clientY + 8}px`;
      };
      const finish = (ev: PointerEvent, commit: boolean): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        const dragged = ghost !== null;
        ghost?.remove();
        ghost = null;
        if (!commit) return;
        if (dragged) onAdd(kind, ev.clientX, ev.clientY);
        else onAdd(kind, null, null);
      };
      const up = (ev: PointerEvent): void => finish(ev, true);
      const cancel = (ev: PointerEvent): void => finish(ev, false);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    });
    // Keyboard activation (Enter/Space on the focused button) has detail 0.
    item.addEventListener('click', (e) => {
      if (e.detail === 0 && !state.isPlaying()) onAdd(kind, null, null);
    });
  }

  state.subscribe((kind) => {
    if (kind === 'mode' || kind === 'board') render();
    if (kind === 'playing') el.classList.toggle('disabled', state.isPlaying());
  });
  render();
  return el;
}
