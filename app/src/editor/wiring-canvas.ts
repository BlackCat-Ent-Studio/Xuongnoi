import { getNodeDef } from '../engine/registry';
import type { GraphNode, PortRef, PortType, Runtime, Wire } from '../engine/types';
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
  const nodeLayer = h('div', 'wc-nodes');
  const badgeLayer = h('div', 'wc-badges');
  const hint = h('div', 'wc-hint', TEXT_VI.canvasEmpty);
  const tip = h('div', 'wc-tip');
  tip.hidden = true;
  world.append(wireLayer, nodeLayer, badgeLayer);
  el.append(world, hint, tip);

  let panX = 40;
  let panY = 40;
  let zoom = 1;

  const nodeEls = new Map<string, HTMLElement>();
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
    hint.hidden = graph.nodes.length > 0;
    el.classList.toggle('readonly', state.isPlaying());
    applySelection();
    drawWires();
  }

  function applySelection(): void {
    const sel = state.getSelection();
    for (const [id, box] of nodeEls) box.classList.toggle('selected', sel?.kind === 'node' && sel.id === id);
    for (const [id, path] of wirePaths) path.classList.toggle('selected', sel?.kind === 'wire' && sel.id === id);
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
    const nodes = state.getGraph().nodes;
    if (nodes.length === 0) {
      panX = 40;
      panY = 40;
      zoom = 1;
    } else {
      const minX = Math.min(...nodes.map((n) => n.pos.x));
      const minY = Math.min(...nodes.map((n) => n.pos.y));
      const maxX = Math.max(...nodes.map((n) => n.pos.x)) + 200;
      const maxY = Math.max(...nodes.map((n) => n.pos.y)) + 140;
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
    | { kind: 'node'; id: string; sx: number; sy: number; ox: number; oy: number; moved: boolean }
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

    const box = target.closest<HTMLElement>('.wc-node');
    if (box?.dataset.id) {
      state.select({ kind: 'node', id: box.dataset.id });
      if (!readonly) {
        const node = state.getGraph().nodes.find((n) => n.id === box.dataset.id);
        if (node) {
          drag = { kind: 'node', id: node.id, sx: e.clientX, sy: e.clientY, ox: node.pos.x, oy: node.pos.y, moved: false };
          el.setPointerCapture(e.pointerId);
        }
      }
      return;
    }

    const wireId = target instanceof SVGElement ? target.dataset.wire : undefined;
    if (wireId) {
      state.select({ kind: 'wire', id: wireId });
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
    } else if (drag.kind === 'node') {
      const dx = (e.clientX - drag.sx) / zoom;
      const dy = (e.clientY - drag.sy) / zoom;
      if (!drag.moved && Math.hypot(dx, dy) * zoom < 3) return;
      drag.moved = true;
      const box = nodeEls.get(drag.id);
      if (box) {
        box.style.left = `${Math.round(drag.ox + dx)}px`;
        box.style.top = `${Math.round(drag.oy + dy)}px`;
      }
      drawWires();
    } else {
      updateWireDrag(drag, e);
    }
  });

  const endDrag = (e: PointerEvent): void => {
    const d = drag;
    drag = null;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (!d) return;
    if (d.kind === 'node' && d.moved) {
      const dx = (e.clientX - d.sx) / zoom;
      const dy = (e.clientY - d.sy) / zoom;
      state.setNodePos(d.id, { x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) });
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
