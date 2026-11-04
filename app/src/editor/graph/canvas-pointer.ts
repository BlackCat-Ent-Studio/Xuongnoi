import { NOTE_MIN_H, NOTE_MIN_W } from '../../engine/notes';
import type { EditorState } from '../editor-state';
import { h } from '../dom';
import { groupsOf } from '../groups/group-model';
import { zoomAround, type Point, type View } from './graph-geometry';
import { syncNotes, type NoteParts } from './note-view';
import type { WireDrag } from './wire-drag';
import { TAP_SLOP, type KnotEditor } from './knot-editor';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
  | { kind: 'items'; id: string; sx: number; sy: number; items: { id: string; ox: number; oy: number }[]; moved: boolean; groupClick: boolean }
  | { kind: 'resize'; id: string; sx: number; sy: number; w: number; h: number }
  | { kind: 'marquee'; sx: number; sy: number; base: Set<string>; box: HTMLElement }
  | { kind: 'wire' }
  | { kind: 'knot' };

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
  /** Cards (or group blocks) are being dragged: draw only the wires that touch them, at most once per frame. */
  moveWires: (cardIds: ReadonlySet<string>) => void;
  knots: KnotEditor;
  /** A tap (press and release without moving) on a node or group block. */
  onTap: (id: string) => void;
  /** A press on bare board. */
  onEmptyDown: () => void;
  /** Where a single dropped card ends up (it slides off the card it landed on). `box` is its dropped rectangle. */
  settle: (id: string, box: { x: number; y: number }) => { x: number; y: number };
}

/** Mouse and wheel handling for the canvas: pan, zoom, move items, resize notes, marquee select, wire drags. */
export function attachPointer({ el, state, wires, nodeEls, noteEls, noteLayer, getView, setView, clientToWorld, render, moveWires, knots, onTap, onEmptyDown, settle }: Ctx): void {
  let drag: Drag | null = null;
  const kindOf = (id: string): 'note' | 'group' | 'node' =>
    noteEls.has(id) ? 'note' : groupsOf(state.getGraph()).some((g) => g.id === id) ? 'group' : 'node';

  /** Pointer pressed on a node or note: Shift toggles it, otherwise select it and maybe start moving. */
  function beginItemDrag(e: PointerEvent, id: string, readonly: boolean): void {
    if (e.shiftKey) {
      state.toggleSelect(id);
      return;
    }
    const multi = state.getMulti();
    const group = multi.size > 1 && multi.has(id);
    if (!group) state.select({ kind: kindOf(id), id });
    if (readonly) return;
    const graph = state.getGraph();
    const notes = state.getNotes();
    const items: { id: string; ox: number; oy: number }[] = [];
    for (const i of group ? [...multi] : [id]) {
      const g = groupsOf(graph).find((x) => x.id === i);
      const pos = graph.nodes.find((n) => n.id === i)?.pos ?? (g ? { x: g.x, y: g.y } : undefined) ?? notes.find((n) => n.id === i)?.pos;
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
    const knotId = target.closest<SVGElement>('.wc-knot')?.dataset.knot;
    if (knotId && !readonly) {
      e.preventDefault();
      if (knots.knotDown(e, knotId)) {
        drag = { kind: 'knot' };
        el.setPointerCapture(e.pointerId);
      }
      return;
    }
    const wireId = target instanceof SVGElement ? target.dataset.wire : undefined;
    if (wireId) {
      state.select({ kind: 'wire', id: wireId });
      if (!readonly && knots.wireDown(e, wireId)) {
        drag = { kind: 'knot' };
        el.setPointerCapture(e.pointerId);
      }
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
    onEmptyDown();
    startPan(e);
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'pan') {
      setView({ ...getView(), panX: drag.px + (e.clientX - drag.sx), panY: drag.py + (e.clientY - drag.sy) });
    } else if (drag.kind === 'items') {
      const dx = (e.clientX - drag.sx) / getView().zoom;
      const dy = (e.clientY - drag.sy) / getView().zoom;
      if (!drag.moved && Math.hypot(dx, dy) * getView().zoom <= TAP_SLOP) return;
      drag.moved = true;
      for (const it of drag.items) {
        const box = nodeEls.get(it.id) ?? noteEls.get(it.id)?.el;
        if (box) {
          box.style.left = `${Math.round(it.ox + dx)}px`;
          box.style.top = `${Math.round(it.oy + dy)}px`;
        }
      }
      moveWires(new Set(drag.items.map((it) => it.id)));
    } else if (drag.kind === 'knot') {
      knots.move(e);
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
        const moves = d.items.map((it) => ({ id: it.id, pos: { x: Math.round(it.ox + dx), y: Math.round(it.oy + dy) } }));
        const only = moves.length === 1 ? moves[0] : undefined;
        if (only && kindOf(only.id) !== 'note') only.pos = settle(only.id, only.pos);
        state.moveItems(moves);
        render();
      } else {
        if (d.groupClick) state.select({ kind: kindOf(d.id), id: d.id });
        if (kindOf(d.id) !== 'note') onTap(d.id);
      }
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
          if (box.offsetWidth === 0) continue; // hidden (notes while a group is open)
          const x = box.offsetLeft;
          const y = box.offsetTop;
          if (x < b.x && x + box.offsetWidth > a.x && y < b.y && y + box.offsetHeight > a.y) hit.add(id);
        }
        state.selectMany([...hit]);
      }
    } else if (d.kind === 'knot') knots.up();
    else if (d.kind === 'wire') wires.end(e);
  });

  el.addEventListener('pointercancel', (e) => {
    if (drag?.kind === 'wire') wires.cancel();
    if (drag?.kind === 'marquee') drag.box.remove();
    if (drag?.kind === 'knot') knots.cancel();
    drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    render();
  });

  // Double-clicking a group block opens it.
  el.addEventListener('dblclick', (e) => {
    // Pointer capture retargets the event to the canvas, so look at what is really under the cursor.
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target.closest('.wc-ui, .wc-port')) return;
    const id = target.closest<HTMLElement>('.wc-group')?.dataset.id;
    if (id) state.enterGroup(id);
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
