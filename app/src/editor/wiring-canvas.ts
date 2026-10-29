import { NOTE_COLORS, NOTE_MAX_TEXT, NOTE_MIN_H, NOTE_MIN_W } from '../engine/notes';
import { getNodeDef } from '../engine/registry';
import type { GraphNode, Note, PortRef, PortType, Runtime, Wire } from '../engine/types';
import { CONNECT_FAIL_TEXT } from '../engine/text-vi';
import { canConnect } from '../engine/wiring';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { TEXT_VI, formatWireValue } from './text-vi';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

export interface WiringCanvas {
  el: HTMLElement;
  /** Convert screen coordinates to canvas (world) coordinates. */
  clientToWorld(clientX: number, clientY: number): { x: number; y: number };
  /** World coordinates of the visible center. */
  viewCenter(): { x: number; y: number };
  isOver(clientX: number, clientY: number): boolean;
  fitToContent(): void;
  /** Update live wire value badges (play mode). */
  refreshBadges(): void;
}

interface Deps {
  state: EditorState;
  getRuntime: () => Runtime | null;
  notify: (text: string, kind?: 'info' | 'error') => void;
}

type PortDir = 'in' | 'out';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, className = ''): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (className) el.setAttribute('class', className);
  return el;
}

function wirePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function createWiringCanvas({ state, getRuntime, notify }: Deps): WiringCanvas {
  const el = h('div', 'wc');
  el.tabIndex = 0;
  const world = h('div', 'wc-world');
  const wireLayer = svg('svg', 'wc-wires');
  const noteLayer = h('div', 'wc-notes');
  const nodeLayer = h('div', 'wc-nodes');
  const badgeLayer = h('div', 'wc-badges');
  const hint = h('div', 'wc-hint', TEXT_VI.canvasEmpty);
  const tip = h('div', 'wc-tip');
  tip.hidden = true;
  world.append(wireLayer, noteLayer, nodeLayer, badgeLayer);
  el.append(world, hint, tip);

  let panX = 40;
  let panY = 40;
  let zoom = 1;

  const nodeEls = new Map<string, HTMLElement>();
  const noteEls = new Map<string, { el: HTMLElement; text: HTMLTextAreaElement }>();
  const portEls = new Map<string, HTMLElement>(); // `${node}|${port}|${dir}` → dot
  const wirePaths = new Map<string, SVGPathElement>();
  const badgeEls = new Map<string, { el: HTMLElement; wire: Wire; type: PortType }>();
  let tempPath: SVGPathElement | null = null;

  const portKey = (node: string, port: string, dir: PortDir): string => `${node}|${port}|${dir}`;

  function applyView(): void {
    world.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    el.style.backgroundPosition = `${panX}px ${panY}px`;
    el.style.backgroundSize = `${24 * zoom}px ${24 * zoom}px`;
  }

  function clientToWorld(cx: number, cy: number): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return { x: (cx - r.left - panX) / zoom, y: (cy - r.top - panY) / zoom };
  }

  function portCenter(key: string): { x: number; y: number } | null {
    const dot = portEls.get(key);
    if (!dot) return null;
    const r = dot.getBoundingClientRect();
    return clientToWorld(r.left + r.width / 2, r.top + r.height / 2);
  }

  // ---------- rendering ----------

  function renderPorts(node: GraphNode, col: HTMLElement, dir: PortDir, ports: { id: string; type: PortType; label: string }[]): void {
    for (const p of ports) {
      const row = h('div', `wc-port ${dir}`);
      row.dataset.node = node.id;
      row.dataset.port = p.id;
      row.dataset.dir = dir;
      const dot = h('span', `wc-dot type-${p.type}`);
      const label = h('span', 'wc-port-label', p.label);
      if (dir === 'in') row.append(dot, label);
      else row.append(label, dot);
      row.title = p.label;
      portEls.set(portKey(node.id, p.id, dir), dot);
      col.append(row);
    }
  }

  function renderNode(node: GraphNode): void {
    const def = getNodeDef(node.kind);
    const box = h('div', 'wc-node');
    box.dataset.id = node.id;
    box.dataset.kind = node.kind;
    box.style.left = `${node.pos.x}px`;
    box.style.top = `${node.pos.y}px`;
    const head = h('div', `wc-node-head cat-${def?.category ?? 'unknown'}`, def?.label ?? 'Khối lạ');
    if (def) head.title = def.description;
    const body = h('div', 'wc-node-body');
    const ins = h('div', 'wc-col in');
    const outs = h('div', 'wc-col out');
    if (def) {
      renderPorts(node, ins, 'in', def.inputs);
      renderPorts(node, outs, 'out', def.outputs);
    }
    body.append(ins, outs);
    box.append(head, body);
    nodeLayer.append(box);
    nodeEls.set(node.id, box);
  }

  function wireType(wire: Wire): PortType | null {
    const from = state.getGraph().nodes.find((n) => n.id === wire.from.node);
    const def = from ? getNodeDef(from.kind) : undefined;
    return def?.outputs.find((p) => p.id === wire.from.port)?.type ?? null;
  }

  function drawWires(): void {
    wireLayer.replaceChildren();
    wirePaths.clear();
    badgeLayer.replaceChildren();
    badgeEls.clear();
    const playing = state.isPlaying();
    const sel = state.getSelection();
    for (const wire of state.getGraph().wires) {
      const a = portCenter(portKey(wire.from.node, wire.from.port, 'out'));
      const b = portCenter(portKey(wire.to.node, wire.to.port, 'in'));
      const type = wireType(wire);
      if (!a || !b || !type) continue;
      const d = wirePath(a.x, a.y, b.x, b.y);
      const hit = svg('path', 'wc-wire-hit');
      hit.setAttribute('d', d);
      hit.dataset.wire = wire.id;
      const path = svg('path', `wc-wire type-${type}`);
      path.setAttribute('d', d);
      if (sel?.kind === 'wire' && sel.id === wire.id) path.classList.add('selected');
      wireLayer.append(path, hit);
      wirePaths.set(wire.id, path);
      if (playing) {
        const badge = h('div', `wc-badge type-${type}`);
        badge.style.left = `${(a.x + b.x) / 2}px`;
        badge.style.top = `${(a.y + b.y) / 2}px`;
        badgeLayer.append(badge);
        badgeEls.set(wire.id, { el: badge, wire, type });
      }
    }
    if (tempPath) wireLayer.append(tempPath);
    refreshBadges();
  }

  function render(): void {
    nodeLayer.replaceChildren();
    nodeEls.clear();
    portEls.clear();
    const graph = state.getGraph();
    for (const n of graph.nodes) renderNode(n);
    renderNotes();
    el.classList.toggle('readonly', state.isPlaying());
    applySelection();
    drawWires();
  }

  // ---------- sticky notes ----------

  function buildNote(note: Note): { el: HTMLElement; text: HTMLTextAreaElement } {
    const box = h('div', 'wc-note');
    box.dataset.id = note.id;
    const tools = h('div', 'wc-note-tools');
    tools.append(h('span', 'wc-note-grip', '📝'));
    const colors = h('span', 'wc-note-colors');
    for (const c of NOTE_COLORS) {
      const dot = h('button', `wc-note-dot dot-${c}`);
      dot.type = 'button';
      dot.title = TEXT_VI.noteColor;
      dot.addEventListener('click', () => state.updateNote(note.id, { color: c }));
      colors.append(dot);
    }
    const del = h('button', 'wc-note-del', '🗑');
    del.type = 'button';
    del.title = TEXT_VI.noteDelete;
    del.addEventListener('click', () => {
      state.select({ kind: 'note', id: note.id });
      state.deleteSelection();
    });
    tools.append(colors, del);
    const text = h('textarea', 'wc-note-text');
    text.placeholder = TEXT_VI.noteHolder;
    text.maxLength = NOTE_MAX_TEXT;
    text.spellcheck = false;
    text.addEventListener('input', () => state.updateNote(note.id, { text: text.value }));
    const grab = h('div', 'wc-note-resize');
    grab.title = TEXT_VI.noteResize;
    box.append(tools, text, grab);
    return { el: box, text };
  }

  /** Updates note elements in place so a note being typed in keeps its focus. */
  function renderNotes(): void {
    const notes = state.getNotes();
    const alive = new Set(notes.map((n) => n.id));
    for (const [id, parts] of noteEls) {
      if (!alive.has(id)) {
        parts.el.remove();
        noteEls.delete(id);
      }
    }
    const readonly = state.isPlaying();
    for (const note of notes) {
      let parts = noteEls.get(note.id);
      if (!parts) {
        parts = buildNote(note);
        noteEls.set(note.id, parts);
        noteLayer.append(parts.el);
      }
      const { el: box, text } = parts;
      box.style.left = `${note.pos.x}px`;
      box.style.top = `${note.pos.y}px`;
      box.style.width = `${note.size.w}px`;
      box.style.height = `${note.size.h}px`;
      for (const c of NOTE_COLORS) box.classList.toggle(`color-${c}`, c === note.color);
      if (text.value !== note.text) text.value = note.text;
      text.readOnly = readonly;
    }
    hint.hidden = state.getGraph().nodes.length > 0 || notes.length > 0;
  }

  function applySelection(): void {
    const sel = state.getSelection();
    const multi = state.getMulti();
    for (const [id, box] of nodeEls) box.classList.toggle('selected', multi.has(id));
    for (const [id, parts] of noteEls) parts.el.classList.toggle('selected', multi.has(id));
    for (const [id, path] of wirePaths) path.classList.toggle('selected', sel?.kind === 'wire' && sel.id === id);
  }

  function itemEl(id: string): HTMLElement | undefined {
    return nodeEls.get(id) ?? noteEls.get(id)?.el;
  }

  function refreshBadges(): void {
    const rt = getRuntime();
    if (!rt) return;
    for (const { el: badge, wire, type } of badgeEls.values()) {
      let text: string;
      try {
        const value = rt.getWireValue(wire);
        const src = state.getGraph().nodes.find((n) => n.id === wire.from.node);
        const name = (src && getNodeDef(src.kind)?.label) || TEXT_VI.none;
        text = formatWireValue(type, value, name);
      } catch {
        text = TEXT_VI.none;
      }
      if (badge.textContent !== text) badge.textContent = text;
    }
  }

  // ---------- fit ----------

  function fitToContent(): void {
    const boxes = [
      ...state.getGraph().nodes.map((n) => ({ x: n.pos.x, y: n.pos.y, w: 200, h: 140 })),
      ...state.getNotes().map((n) => ({ x: n.pos.x, y: n.pos.y, w: n.size.w, h: n.size.h })),
    ];
    if (boxes.length === 0) {
      panX = 40;
      panY = 40;
      zoom = 1;
    } else {
      const minX = Math.min(...boxes.map((b) => b.x));
      const minY = Math.min(...boxes.map((b) => b.y));
      const maxX = Math.max(...boxes.map((b) => b.x + b.w));
      const maxY = Math.max(...boxes.map((b) => b.y + b.h));
      const r = el.getBoundingClientRect();
      const w = r.width || 800;
      const hgt = r.height || 600;
      zoom = Math.min(1, Math.max(MIN_ZOOM, Math.min((w - 80) / (maxX - minX), (hgt - 80) / (maxY - minY))));
      panX = 40 - minX * zoom;
      panY = 40 - minY * zoom;
    }
    applyView();
  }

  // ---------- pointer interaction ----------

  type Drag =
    | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
    | { kind: 'items'; id: string; sx: number; sy: number; items: { id: string; ox: number; oy: number }[]; moved: boolean; groupClick: boolean }
    | { kind: 'resize'; id: string; sx: number; sy: number; w: number; h: number }
    | { kind: 'marquee'; sx: number; sy: number; base: Set<string>; box: HTMLElement }
    | { kind: 'wire'; start: PortRef; startDir: PortDir; hover: HTMLElement | null };
  let drag: Drag | null = null;

  function setTip(text: string | null, cx = 0, cy = 0): void {
    if (!text) {
      tip.hidden = true;
      return;
    }
    const r = el.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = `${cx - r.left + 14}px`;
    tip.style.top = `${cy - r.top + 14}px`;
    tip.hidden = false;
  }

  /** Normalise a drag between two ports into (output → input) refs, keeping direction errors reportable. */
  function orient(start: PortRef, startDir: PortDir, target: PortRef): [PortRef, PortRef] {
    return startDir === 'in' ? [target, start] : [start, target];
  }

  function portRefOf(row: HTMLElement): PortRef | null {
    const { node, port } = row.dataset;
    return node && port ? { node, port } : null;
  }

  function clearHover(d: Extract<Drag, { kind: 'wire' }>): void {
    d.hover?.classList.remove('ok', 'bad');
    d.hover = null;
  }

  function updateWireDrag(d: Extract<Drag, { kind: 'wire' }>, e: PointerEvent): void {
    clearHover(d);
    const startDot = portEls.get(portKey(d.start.node, d.start.port, d.startDir));
    const s = startDot ? portCenter(portKey(d.start.node, d.start.port, d.startDir)) : null;
    const p = clientToWorld(e.clientX, e.clientY);
    if (s && tempPath) {
      tempPath.setAttribute('d', d.startDir === 'out' ? wirePath(s.x, s.y, p.x, p.y) : wirePath(p.x, p.y, s.x, s.y));
    }
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const row = under instanceof Element ? under.closest<HTMLElement>('.wc-port') : null;
    const target = row ? portRefOf(row) : null;
    if (!row || !target) {
      setTip(null);
      return;
    }
    const [from, to] = orient(d.start, d.startDir, target);
    const res = canConnect(state.getGraph(), from, to);
    // Dropping on the same side of a port as the start is a direction mistake.
    const sameSide = row.dataset.dir === d.startDir;
    const reason = sameSide ? CONNECT_FAIL_TEXT['wrong-direction'] : res.ok ? null : CONNECT_FAIL_TEXT[res.reason];
    row.classList.add(reason ? 'bad' : 'ok');
    d.hover = row;
    setTip(reason, e.clientX, e.clientY);
  }

  function finishWireDrag(d: Extract<Drag, { kind: 'wire' }>, e: PointerEvent): void {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const row = under instanceof Element ? under.closest<HTMLElement>('.wc-port') : null;
    const target = row ? portRefOf(row) : null;
    clearHover(d);
    setTip(null);
    tempPath?.remove();
    tempPath = null;
    if (!row || !target) return;
    if (row.dataset.dir === d.startDir) {
      notify(CONNECT_FAIL_TEXT['wrong-direction'], 'error');
      return;
    }
    const [from, to] = orient(d.start, d.startDir, target);
    const res = state.connect(from, to);
    if (!res.ok) notify(CONNECT_FAIL_TEXT[res.reason], 'error');
  }

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
    const ids = group ? [...multi] : [id];
    const graph = state.getGraph();
    const notes = state.getNotes();
    const items: { id: string; ox: number; oy: number }[] = [];
    for (const i of ids) {
      const pos = graph.nodes.find((n) => n.id === i)?.pos ?? notes.find((n) => n.id === i)?.pos;
      if (pos) items.push({ id: i, ox: pos.x, oy: pos.y });
    }
    if (items.length === 0) return;
    drag = { kind: 'items', id, sx: e.clientX, sy: e.clientY, items, moved: false, groupClick: group };
    el.setPointerCapture(e.pointerId);
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    el.focus({ preventScroll: true });
    const readonly = state.isPlaying();

    if (e.button === 1) {
      e.preventDefault();
      drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: panX, py: panY };
      el.setPointerCapture(e.pointerId);
      return;
    }

    const row = target.closest<HTMLElement>('.wc-port');
    if (row && !readonly) {
      const ref = portRefOf(row);
      const dir = row.dataset.dir as PortDir | undefined;
      if (ref && dir) {
        e.preventDefault();
        tempPath = svg('path', 'wc-wire-temp');
        wireLayer.append(tempPath);
        drag = { kind: 'wire', start: ref, startDir: dir, hover: null };
        el.setPointerCapture(e.pointerId);
        updateWireDrag(drag, e);
        return;
      }
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
        return;
      }
      if (target.closest('textarea')) {
        if (e.shiftKey) state.toggleSelect(id);
        else state.select({ kind: 'note', id });
        return;
      }
      beginItemDrag(e, id, readonly);
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
    drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, px: panX, py: panY };
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'pan') {
      panX = drag.px + (e.clientX - drag.sx);
      panY = drag.py + (e.clientY - drag.sy);
      applyView();
    } else if (drag.kind === 'items') {
      const dx = (e.clientX - drag.sx) / zoom;
      const dy = (e.clientY - drag.sy) / zoom;
      if (!drag.moved && Math.hypot(dx, dy) * zoom < 3) return;
      drag.moved = true;
      for (const it of drag.items) {
        const box = itemEl(it.id);
        if (box) {
          box.style.left = `${Math.round(it.ox + dx)}px`;
          box.style.top = `${Math.round(it.oy + dy)}px`;
        }
      }
      drawWires();
    } else if (drag.kind === 'resize') {
      const box = noteEls.get(drag.id)?.el;
      if (box) {
        box.style.width = `${Math.max(NOTE_MIN_W, Math.round(drag.w + (e.clientX - drag.sx) / zoom))}px`;
        box.style.height = `${Math.max(NOTE_MIN_H, Math.round(drag.h + (e.clientY - drag.sy) / zoom))}px`;
      }
    } else if (drag.kind === 'marquee') {
      const r = el.getBoundingClientRect();
      drag.box.style.left = `${Math.min(drag.sx, e.clientX) - r.left}px`;
      drag.box.style.top = `${Math.min(drag.sy, e.clientY) - r.top}px`;
      drag.box.style.width = `${Math.abs(e.clientX - drag.sx)}px`;
      drag.box.style.height = `${Math.abs(e.clientY - drag.sy)}px`;
    } else {
      updateWireDrag(drag, e);
    }
  });

  const endDrag = (e: PointerEvent): void => {
    const d = drag;
    drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.kind === 'items') {
      if (d.moved) {
        const dx = (e.clientX - d.sx) / zoom;
        const dy = (e.clientY - d.sy) / zoom;
        state.moveItems(d.items.map((it) => ({ id: it.id, pos: { x: Math.round(it.ox + dx), y: Math.round(it.oy + dy) } })));
        render();
      } else if (d.groupClick) {
        state.select({ kind: noteEls.has(d.id) ? 'note' : 'node', id: d.id });
      }
    } else if (d.kind === 'resize') {
      state.updateNote(d.id, { size: { w: d.w + (e.clientX - d.sx) / zoom, h: d.h + (e.clientY - d.sy) / zoom } });
      renderNotes();
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
    } else if (d.kind === 'wire') {
      finishWireDrag(d, e);
    }
  };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', (e) => {
    if (drag?.kind === 'wire') {
      clearHover(drag);
      setTip(null);
      tempPath?.remove();
      tempPath = null;
    }
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
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.exp(-e.deltaY * 0.0015)));
      const wx = (mx - panX) / zoom;
      const wy = (my - panY) / zoom;
      zoom = next;
      panX = mx - wx * zoom;
      panY = my - wy * zoom;
      applyView();
    },
    { passive: false },
  );
  el.addEventListener('auxclick', (e) => {
    if (e.button === 1) e.preventDefault();
  });

  // ---------- state sync ----------

  state.subscribe((kind) => {
    if (kind === 'graph' || kind === 'playing') render();
    else if (kind === 'notes') {
      renderNotes();
      applySelection();
    }
    else if (kind === 'board') {
      render();
      fitToContent();
    } else if (kind === 'selection') applySelection();
  });

  applyView();
  render();

  return {
    el,
    clientToWorld,
    viewCenter() {
      const r = el.getBoundingClientRect();
      return clientToWorld(r.left + r.width / 2, r.top + r.height / 2);
    },
    isOver(cx, cy) {
      const r = el.getBoundingClientRect();
      return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    },
    fitToContent,
    refreshBadges,
  };
}
