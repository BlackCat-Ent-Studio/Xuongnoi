import { NOTE_MIN_H, NOTE_MIN_W } from '../../engine/notes';
import type { EditorState } from '../editor-state';
import { h } from '../dom';
import { zoomAround, type Point, type View } from './graph-geometry';
import { syncNotes, type NoteParts } from './note-view';
import type { WireDrag } from './wire-drag';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
  | { kind: 'items'; id: string; sx: number; sy: number; items: { id: string; ox: number; oy: number }[]; moved: boolean; groupClick: boolean }
  | { kind: 'resize'; id: string; sx: number; sy: number; w: number; h: number }
  | { kind: 'marquee'; sx: number; sy: number; base: Set<string>; box: HTMLElement }
  | { kind: 'wire' };

interface Ctx {
  el: HTMLElement;
  state: EditorState;
  wires: WireDrag;
  nodeEls: Map<string, HTMLElement>;
  noteEls: Map<string, NoteParts>;
  noteLayer: HTMLElement;
  getView: () => View;
  setView: (v: View) => void;
  clientToWorld: (cx: number, cy: number) => Point;
  render: () => void;
  drawWires: () => void;
}

/** Mouse and wheel handling for the canvas: pan, zoom, move items, resize notes, marquee select, wire drags. */
export function attachPointer({ el, state, wires, nodeEls, noteEls, noteLayer, getView, setView, clientToWorld, render, drawWires }: Ctx): void {
  let drag: Drag | null = null;

  /** Pointer pressed on a node or note: Shift toggles it, otherwise select it and maybe start moving. */
  function beginItemDrag(e: PointerEvent, id: string, readonly: boolean): void {
    if (e.shiftKey) {
      state.toggleSelect(id);
      return;
    }
    const multi = state.getMulti();
    const group = multi.size > 1 && multi.has(id);
    if (!group) state.select({ kind: noteEls.has(id) ? 'note' : 'node', id });
    if (readonly) return;
    const graph = state.getGraph();
    const notes = state.getNotes();
    const items: { id: string; ox: number; oy: number }[] = [];
    for (const i of group ? [...multi] : [id]) {
      const pos = graph.nodes.find((n) => n.id === i)?.pos ?? notes.find((n) => n.id === i)?.pos;
      if (pos) items.push({ id: i, ox: pos.x, oy: pos.y });
    }
    if (items.length === 0) return;
    drag = { kind: 'items', id, sx: e.clientX, sy: e.clientY, items, moved: false, groupClick: group };
    el.setPointerCapture(e.pointerId);
  }

  function startPan(e: PointerEvent): void {
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: getView().panX, py: getView().panY };
    el.setPointerCapture(e.pointerId);
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target || target.closest('.wc-ui')) return;
    el.focus({ preventScroll: true });
    const readonly = state.isPlaying();
    if (e.button === 1) {
      e.preventDefault();
      startPan(e);
      return;
    }
    const row = target.closest<HTMLElement>('.wc-port');
    if (row && !readonly) {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      if (wires.begin(row, e)) drag = { kind: 'wire' };
      else el.releasePointerCapture(e.pointerId);
      return;
    }
    const noteBox = target.closest<HTMLElement>('.wc-note');
    if (noteBox?.dataset.id) {
      const id = noteBox.dataset.id;
      if (target.closest('button')) return;
      if (target.closest('.wc-note-resize')) {
        const note = state.getNotes().find((n) => n.id === id);
        if (note && !readonly) {
          e.preventDefault();
          state.select({ kind: 'note', id });
          drag = { kind: 'resize', id, sx: e.clientX, sy: e.clientY, w: note.size.w, h: note.size.h };
          el.setPointerCapture(e.pointerId);
        }
      } else if (target.closest('textarea')) {
        if (e.shiftKey) state.toggleSelect(id);
        else state.select({ kind: 'note', id });
      } else beginItemDrag(e, id, readonly);
      return;
    }
    const box = target.closest<HTMLElement>('.wc-node');
    if (box?.dataset.id) {
      beginItemDrag(e, box.dataset.id, readonly);
      return;
    }
    const wireId = target instanceof SVGElement ? target.dataset.wire : undefined;
    if (wireId) {
      state.select({ kind: 'wire', id: wireId });
      return;
    }
    if (e.shiftKey) {
      const marquee = h('div', 'wc-marquee');
      el.append(marquee);
      drag = { kind: 'marquee', sx: e.clientX, sy: e.clientY, base: new Set(state.getMulti()), box: marquee };
      el.setPointerCapture(e.pointerId);
      return;
    }
    state.select(null);
    startPan(e);
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'pan') {
      setView({ ...getView(), panX: drag.px + (e.clientX - drag.sx), panY: drag.py + (e.clientY - drag.sy) });
    } else if (drag.kind === 'items') {
      const dx = (e.clientX - drag.sx) / getView().zoom;
      const dy = (e.clientY - drag.sy) / getView().zoom;
      if (!drag.moved && Math.hypot(dx, dy) * getView().zoom < 3) return;
      drag.moved = true;
      for (const it of drag.items) {
        const box = nodeEls.get(it.id) ?? noteEls.get(it.id)?.el;
        if (box) {
          box.style.left = `${Math.round(it.ox + dx)}px`;
          box.style.top = `${Math.round(it.oy + dy)}px`;
        }
      }
      drawWires();
    } else if (drag.kind === 'resize') {
      const box = noteEls.get(drag.id)?.el;
      if (box) {
        box.style.width = `${Math.max(NOTE_MIN_W, Math.round(drag.w + (e.clientX - drag.sx) / getView().zoom))}px`;
        box.style.height = `${Math.max(NOTE_MIN_H, Math.round(drag.h + (e.clientY - drag.sy) / getView().zoom))}px`;
      }
    } else if (drag.kind === 'marquee') {
      const r = el.getBoundingClientRect();
      drag.box.style.left = `${Math.min(drag.sx, e.clientX) - r.left}px`;
      drag.box.style.top = `${Math.min(drag.sy, e.clientY) - r.top}px`;
      drag.box.style.width = `${Math.abs(e.clientX - drag.sx)}px`;
      drag.box.style.height = `${Math.abs(e.clientY - drag.sy)}px`;
    } else wires.move(e);
  });

  el.addEventListener('pointerup', (e) => {
    const d = drag;
    drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.kind === 'items') {
      if (d.moved) {
        const dx = (e.clientX - d.sx) / getView().zoom;
        const dy = (e.clientY - d.sy) / getView().zoom;
        state.moveItems(d.items.map((it) => ({ id: it.id, pos: { x: Math.round(it.ox + dx), y: Math.round(it.oy + dy) } })));
        render();
      } else if (d.groupClick) state.select({ kind: noteEls.has(d.id) ? 'note' : 'node', id: d.id });
    } else if (d.kind === 'resize') {
      state.updateNote(d.id, { size: { w: d.w + (e.clientX - d.sx) / getView().zoom, h: d.h + (e.clientY - d.sy) / getView().zoom } });
      syncNotes(state, noteLayer, noteEls);
    } else if (d.kind === 'marquee') {
      d.box.remove();
      const a = clientToWorld(Math.min(d.sx, e.clientX), Math.min(d.sy, e.clientY));
      const b = clientToWorld(Math.max(d.sx, e.clientX), Math.max(d.sy, e.clientY));
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) >= 3) {
        const hit = new Set(d.base);
        const boxes = [...nodeEls.entries(), ...[...noteEls.entries()].map(([i, p]) => [i, p.el] as const)];
        for (const [id, box] of boxes) {
          const x = box.offsetLeft;
          const y = box.offsetTop;
          if (x < b.x && x + box.offsetWidth > a.x && y < b.y && y + box.offsetHeight > a.y) hit.add(id);
        }
        state.selectMany([...hit]);
      }
    } else if (d.kind === 'wire') wires.end(e);
  });

  el.addEventListener('pointercancel', (e) => {
    if (drag?.kind === 'wire') wires.cancel();
    if (drag?.kind === 'marquee') drag.box.remove();
    drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    render();
  });

  el.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      setView(zoomAround(getView(), getView().zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top));
    },
    { passive: false },
  );
  el.addEventListener('auxclick', (e) => {
    if (e.button === 1) e.preventDefault();
  });
}
