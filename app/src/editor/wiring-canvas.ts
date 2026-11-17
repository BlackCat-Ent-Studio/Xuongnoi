import { activeInputs, activeOutputs, getNodeDef, knownOutputsOf } from '../engine/registry';
import { curveRoute, hitsCard, midPoint, routeWires, type RouteCard, type WireRoute, type WireSpec } from '../puzzle/ui/wire-geometry';
import { knotPoints } from '../puzzle/ui/wire-knots';
import type { GraphNode, PortType, Runtime, Wire } from '../engine/types';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { CORNER_GAP, LOW_ZOOM, clampZoom, estimateNodeSize, fitView, screenRectToWorld, unionBox, wirePath, zoomAround, type Box, type CornerInsets, type Point, type Size, type View } from './graph/graph-geometry';
import { createGraphToolbar } from './graph/graph-toolbar';
import './graph/graph.css';
import './graph/node-cards.css';
import './graph/group.css';
import { knotKey, wireIdOfKnotKey } from './graph/board-knots';
import { settleDrop } from './graph/drop-settle';
import { createKnotEditor } from './graph/knot-editor';
import { createGroupCrumb } from './graph/group-crumb';
import { buildGroupView, buildStub, layoutStubs, stubBox, type StubSpot } from './graph/group-view';
import { deriveGroupPorts, findGroup, groupOfNode, groupsOf, nodesInScope, sceneGraph } from './groups/group-model';
import { listMissingWires } from './graph/missing-wires';
import { createMinimap } from './graph/minimap';
import { findFreeNodeSpot, occupiedBoxes } from './graph/node-placement';
import { buildNodeView } from './graph/node-view';
import { syncNotes, type NoteParts } from './graph/note-view';
import type { PortDir } from './graph/port-compat';
import { attachPointer } from './graph/canvas-pointer';
import { createNodeActions } from './graph/node-actions';
import { createWireDrag } from './graph/wire-drag';
import './graph/wire-energy.css';
import './graph/object-link.css';
import { createWireEnergy, isEnergyEnabled, onEnergySettingChange } from './graph/wire-energy';
import { TEXT_VI, formatWireValue } from './text-vi';
import { createStepLightLayer, type StepLightSet } from './step/step-light-layer';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MIN_MAP_HEIGHT = 480;
const ZOOM_STEP = 1.2;
/**
 * Wires are routed around the cards (right-angle paths) only while the open board or group shows at most this many
 * cards; a bigger one keeps the plain curves. Measured (headless Chrome, first draw of every wire): a 58-card group
 * with 115 wires takes 0.38 s, the flat 128-card city sample with 165 wires 1.0 s. Later redraws only touch the wires
 * of the card that moved (about 1 to 8 ms), so only the first draw of a board sets the limit.
 */
export const ROUTE_CARD_LIMIT = 60;
/** Router grid cell (px): the editor's cards are big, so a coarse grid keeps routing quick. */
const ROUTE_GRID = 16;
/** Free room kept around the pins of the wires being routed, so a route can go round the cards in the way (px). */
const ROUTE_ROOM = 200;

/** What a drawn wire needs to be redrawn alone: its ends, the cards they belong to and its element. */
interface WireDraw {
  wire: Wire;
  type: PortType;
  /** Cards (node, group block or group stub) the wire starts and ends on. */
  from: string;
  to: string;
  outKey: string;
  inKey: string;
  g: SVGGElement;
}

export interface WiringCanvas {
  el: HTMLElement;
  /** Convert screen coordinates to canvas (world) coordinates. */
  clientToWorld(clientX: number, clientY: number): { x: number; y: number };
  /** World coordinates of the visible center. */
  viewCenter(): { x: number; y: number };
  /** World-space regions covered by overlays, and the part of the board on screen, for placing new items. */
  placementAreas(): { blocked: Box[]; visible: Box };
  isOver(clientX: number, clientY: number): boolean;
  fitToContent(): void;
  /** Pan so the node (or group block) sits in the middle of the view (zoom unchanged). No-op for an unknown id. */
  centerOn(nodeId: string): void;
  /** Brings the node's card into view (pans only when it is off screen or under a floating window) and flashes it. */
  revealNode(nodeId: string): void;
  /** Update live wire value badges (play mode). */
  refreshBadges(): void;
  /** Nearest free spot (no overlap with nodes or notes) for a new node of `kind`, starting from `want`. */
  findFreeSpot(want: Point, kind?: string): Point;
  /** Re-lay out all nodes in layers, animated. */
  arrange(): void;
  /**
   * Reserve the bottom-right corner (px of the canvas) for a floating window such as the game view.
   * Fit and new-node placement keep clear of a `right` x `bottom` box pinned to that corner.
   * Call again whenever the window moves or resizes; zeros (the default) release it.
   */
  setOverlayInsets(insets: { right: number; bottom: number }): void;
  /** Step run: is this output pin drawn on the board right now? */
  hasOutPin(nodeId: string, portId: string): boolean;
  /** Step run: keeps only these cards, wires and pins bright (rest fades) and brings the cards on screen; null clears. */
  setStepLight(light: StepLightSet | null): void;
}

interface Deps {
  state: EditorState;
  getRuntime: () => Runtime | null;
  notify: (text: string, kind?: 'info' | 'error') => void;
}

const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, className = ''): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG_NS, tag);
  if (className) el.setAttribute('class', className);
  return el;
};

export function createWiringCanvas({ state, getRuntime, notify }: Deps): WiringCanvas {
  const el = h('div', 'wc');
  el.tabIndex = 0;
  const world = h('div', 'wc-world');
  const wireLayer = svgEl('svg', 'wc-wires');
  const noteLayer = h('div', 'wc-notes');
  const nodeLayer = h('div', 'wc-nodes');
  const knotLayer = svgEl('svg', 'wc-wires wc-knots');
  const badgeLayer = h('div', 'wc-badges');
  const hint = h('div', 'wc-hint', TEXT_VI.canvasEmpty);
  const crumb = createGroupCrumb(state);
  const tip = h('div', 'wc-tip');
  tip.hidden = true;
  const stubLayer = h('div', 'wc-stubs');
  world.append(wireLayer, noteLayer, stubLayer, nodeLayer, knotLayer, badgeLayer);

  let view: View = { panX: 40, panY: 40, zoom: 1 };
  let overlayBR = { w: 0, h: 0 };
  const nodeEls = new Map<string, HTMLElement>();
  const noteEls = new Map<string, NoteParts>();
  const portEls = new Map<string, HTMLElement>(); // `${node}|${port}|${dir}` → dot
  const wirePaths = new Map<string, SVGPathElement>();
  const wireDraws = new Map<string, WireDraw>();
  const portCard = new Map<string, string>(); // port key → the card it sits on
  /** Routes found on a grid, with what they were found for (see `routeSpecs`). */
  const routed = new Map<string, { sig: string; route: WireRoute }>();
  let drawnRects = new Map<string, string>(); // card id → its box when the wires were last routed
  /** The card whose wires stay clear while the others fade (a tap on it; a tap on the board or Esc lets go). */
  let focusId: string | null = null;
  let moveRaf = 0;
  let pendingMove = new Set<string>();
  const badgeEls = new Map<string, { el: HTMLElement; wire: Wire; type: PortType }>();
  let stepLayer: ReturnType<typeof createStepLightLayer> | null = null;
  const energy = createWireEnergy(wireLayer);
  let energyRaf = 0;
  let energyLast = 0;
  let stubSpots: StubSpot[] = [];
  const seenNodes = new Set(state.getGraph().nodes.map((n) => n.id));

  const portKey = (node: string, port: string, dir: PortDir): string => `${node}|${port}|${dir}`;
  const sizeOf = (id: string): Size | undefined => {
    const box = nodeEls.get(id);
    return box ? { w: box.offsetWidth, h: box.offsetHeight } : undefined;
  };

  function clientToWorld(cx: number, cy: number): Point {
    const r = el.getBoundingClientRect();
    return { x: (cx - r.left - view.panX) / view.zoom, y: (cy - r.top - view.panY) / view.zoom };
  }

  function portCenter(key: string): Point | null {
    const r = portEls.get(key)?.getBoundingClientRect();
    return r ? clientToWorld(r.left + r.width / 2, r.top + r.height / 2) : null;
  }

  function worldViewport(): Box {
    const r = el.getBoundingClientRect();
    const a = clientToWorld(r.left, r.top);
    return { x: a.x, y: a.y, w: r.width / view.zoom, h: r.height / view.zoom };
  }

  const inGroup = (): boolean => state.getScope() !== null;
  /** Notes belong to the main board; they are hidden while a group is open. */
  const notesInView = () => (inGroup() ? [] : state.getNotes());

  function contentBoxes(): Box[] {
    const graph = state.getGraph();
    return [
      ...nodesInScope(graph, state.getScope()).map((n) => ({ x: n.pos.x, y: n.pos.y, ...(sizeOf(n.id) ?? estimateNodeSize(n)) })),
      ...(inGroup() ? [] : groupsOf(graph).map((g) => ({ x: g.x, y: g.y, ...(sizeOf(g.id) ?? { w: 200, h: 110 }) }))),
      ...stubSpots.map(stubBox),
      ...notesInView().map((n) => ({ x: n.pos.x, y: n.pos.y, w: n.size.w, h: n.size.h })),
    ];
  }

  // ---------- overlays ----------

  const minimap = createMinimap({
    items: contentBoxes,
    viewport: worldViewport,
    centerOn(p) {
      const r = el.getBoundingClientRect();
      view = { ...view, panX: r.width / 2 - p.x * view.zoom, panY: r.height / 2 - p.y * view.zoom };
      applyView();
    },
  });
  const toolbar = createGraphToolbar(
    {
      zoomOut: () => zoomBy(1 / ZOOM_STEP),
      zoomIn: () => zoomBy(ZOOM_STEP),
      reset: () => zoomBy(1 / view.zoom),
      fit: () => fitToContent(),
      arrange: () => arrange(),
    },
    minimap.el,
  );
  el.append(world, hint, toolbar.el, crumb.el, tip);

  /** Canvas-relative screen rect of an element, or null when it is not laid out. */
  function localRect(target: Element): Box | null {
    const r = target.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const c = el.getBoundingClientRect();
    return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height };
  }

  /** Screen rects of the overlays that sit on the canvas (bottom-left cluster, reserved bottom-right box). */
  function overlayRects(): Box[] {
    const rects: Box[] = [];
    const corner = localRect(toolbar.el);
    if (corner) rects.push(corner);
    if (overlayBR.w > 0 && overlayBR.h > 0) {
      const c = el.getBoundingClientRect();
      rects.push({ x: c.width - overlayBR.w, y: c.height - overlayBR.h, w: overlayBR.w, h: overlayBR.h });
    }
    return rects;
  }

  function cornerInsets(): CornerInsets {
    const corner = localRect(toolbar.el);
    const height = el.getBoundingClientRect().height;
    return {
      bl: corner ? { w: corner.x + corner.w, h: height - corner.y } : { w: 0, h: 0 },
      br: { ...overlayBR },
    };
  }

  const blockedWorld = (): Box[] => overlayRects().map((r) => screenRectToWorld(view, r, CORNER_GAP));
  /** The part of the board on screen, in world units (a small pad keeps nodes off the very edge). */
  const visibleWorld = (): Box => {
    const c = el.getBoundingClientRect();
    return screenRectToWorld(view, { x: 0, y: 0, w: c.width, h: c.height }, -8);
  };

  function applyView(): void {
    world.style.transform = `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
    el.style.backgroundPosition = `${view.panX}px ${view.panY}px`;
    el.style.backgroundSize = `${24 * view.zoom}px ${24 * view.zoom}px`;
    el.classList.toggle('lowzoom', view.zoom < LOW_ZOOM);
    toolbar.setZoom(view.zoom);
    minimap.redraw();
  }

  function zoomBy(factor: number): void {
    const r = el.getBoundingClientRect();
    view = zoomAround(view, clampZoom(view.zoom * factor), r.width / 2, r.height / 2);
    applyView();
  }

  function fitToContent(): void {
    const r = el.getBoundingClientRect();
    view = fitView(unionBox(contentBoxes()), { w: r.width || 800, h: r.height || 600 }, cornerInsets());
    applyView();
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      minimap.el.hidden = el.clientHeight < MIN_MAP_HEIGHT;
      minimap.redraw();
    }).observe(el);
  }

  // ---------- rendering ----------

  function renderNodes(): void {
    nodeLayer.replaceChildren();
    stubLayer.replaceChildren();
    nodeEls.clear();
    portEls.clear();
    portCard.clear();
    stubSpots = [];
    const graph = state.getGraph();
    const scope = state.getScope();
    const missing = new Map<string, Set<string>>();
    for (const m of listMissingWires(graph)) {
      const set = missing.get(m.nodeId) ?? new Set<string>();
      set.add(m.portId);
      missing.set(m.nodeId, set);
    }
    for (const node of nodesInScope(graph, scope)) {
      const { box, dots } = buildNodeView(node, missing.get(node.id) ?? new Set());
      for (const [k, dot] of dots) {
        const [dir, port] = k.split('|') as [PortDir, string];
        portEls.set(portKey(node.id, port, dir), dot);
        portCard.set(portKey(node.id, port, dir), node.id);
      }
      nodeLayer.append(box);
      nodeEls.set(node.id, box);
    }
    if (scope === null) {
      for (const group of groupsOf(graph)) {
        const inside = new Set(group.nodeIds);
        const miss = [...missing].reduce((n, [id, ports]) => (inside.has(id) ? n + ports.size : n), 0);
        const { box, dots } = buildGroupView(group, deriveGroupPorts(graph, group), miss);
        for (const d of dots) {
          portEls.set(portKey(d.node, d.port, d.dir), d.dot);
          portCard.set(portKey(d.node, d.port, d.dir), group.id);
        }
        nodeLayer.append(box);
        nodeEls.set(group.id, box);
      }
      return;
    }
    const group = findGroup(graph, scope);
    if (!group) return;
    stubSpots = layoutStubs(deriveGroupPorts(graph, group), nodesInScope(graph, scope), sizeOf);
    stubSpots.forEach((spot, i) => {
      const { el: stub, dot } = buildStub(spot);
      stubLayer.append(stub);
      // The stub's dot is the outside end of every wire crossing through this port.
      for (const w of spot.port.wires) {
        const out = spot.port.dir === 'in' ? portKey(w.from.node, w.from.port, 'out') : portKey(w.to.node, w.to.port, 'in');
        portEls.set(out, dot);
        portCard.set(out, `stub:${i}`);
      }
    });
  }

  function wireType(wire: Wire): PortType | null {
    const from = state.getGraph().nodes.find((n) => n.id === wire.from.node);
    return (from && knownOutputsOf(from.kind).find((p) => p.id === wire.from.port)?.type) || null;
  }

  /** Every card as a box in world space (nodes, group blocks and, inside a group, its boundary stubs). */
  function cardRects(): RouteCard[] {
    const out: RouteCard[] = [];
    for (const [id, box] of nodeEls) out.push({ id, x: box.offsetLeft, y: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight });
    stubSpots.forEach((spot, i) => out.push({ id: `stub:${i}`, ...stubBox(spot) }));
    return out;
  }

  /** The part of the board a set of wires can need: their pins and knots plus room around them to go round cards. */
  function routeBox(specs: readonly WireSpec[]): Box {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const sp of specs) {
      for (const p of [sp.a, sp.b, ...sp.via]) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
    }
    return { x: x0 - ROUTE_ROOM, y: y0 - ROUTE_ROOM, w: x1 - x0 + 2 * ROUTE_ROOM, h: y1 - y0 + 2 * ROUTE_ROOM };
  }

  const routingOn = (): boolean => nodeEls.size <= ROUTE_CARD_LIMIT;

  function specOf(d: Omit<WireDraw, 'g'>, a: Point, b: Point): WireSpec {
    return { id: d.wire.id, fromCard: d.from, toCard: d.to, a, b, via: knotPoints(knots.book(), knotKey(state.getScope(), d.wire.id)), fromKey: d.outKey, toKey: d.inKey };
  }

  const pk = (p: Point): string => `${Math.round(p.x)},${Math.round(p.y)}`; // pins are measured from the screen: ignore sub-pixel noise
  const sigOf = (sp: WireSpec): string => `${pk(sp.a)}>${pk(sp.b)}|${sp.fromCard}>${sp.toCard}|${sp.via.map(pk).join(';')}`;
  const rectKey = (r: RouteCard): string => `${r.x},${r.y},${r.w},${r.h}`;

  /**
   * Routes for these wires. Small boards go around the cards on a grid; bigger ones (or `fast`, used while things
   * slide) keep the plain curves and only wires with knots get a route (a curve chain through the knots).
   * `all`: the whole board is drawn; a wire keeps its earlier route unless its ends or knots moved or a card that
   * moved since now sits on it. `some`: just these wires, routed afresh (a card is being dragged).
   */
  function routeSpecs(specs: readonly WireSpec[], mode: 'fast' | 'all' | 'some'): Map<string, WireRoute> {
    const out = new Map<string, WireRoute>();
    if (mode === 'fast' || !routingOn()) {
      routed.clear();
      drawnRects.clear();
      for (const sp of specs) if (sp.via.length > 0) out.set(sp.id, curveRoute(sp));
      return out;
    }
    const rects = cardRects();
    let todo: readonly WireSpec[] = specs;
    if (mode === 'all') {
      const changed = rects.filter((r) => drawnRects.get(r.id) !== rectKey(r));
      const fresh: WireSpec[] = [];
      const alive = new Set<string>();
      for (const sp of specs) {
        alive.add(sp.id);
        const hit = routed.get(sp.id);
        if (hit && hit.sig === sigOf(sp) && !(changed.length > 0 && hitsCard(hit.route.pts, changed))) out.set(sp.id, hit.route);
        else fresh.push(sp);
      }
      for (const id of routed.keys()) if (!alive.has(id)) routed.delete(id);
      drawnRects = new Map(rects.map((r) => [r.id, rectKey(r)]));
      todo = fresh;
    }
    if (todo.length === 0) return out;
    const made = routeWires(rects, todo, { unit: 1, fast: false, grid: ROUTE_GRID, bounds: routeBox(todo) });
    for (const sp of todo) {
      const r = made.get(sp.id);
      if (r) {
        out.set(sp.id, r);
        routed.set(sp.id, { sig: sigOf(sp), route: r });
      } else routed.delete(sp.id);
    }
    return out;
  }

  const pathOf = (route: WireRoute | undefined, a: Point, b: Point): string => route?.d ?? wirePath(a.x, a.y, b.x, b.y);

  function drawWires(fast = false): void {
    if (moveRaf) cancelAnimationFrame(moveRaf);
    moveRaf = 0;
    pendingMove = new Set();
    wireLayer.replaceChildren();
    energy.reset();
    wirePaths.clear();
    wireDraws.clear();
    badgeLayer.replaceChildren();
    badgeEls.clear();
    const playing = state.isPlaying();
    const items: { d: Omit<WireDraw, 'g'>; a: Point; b: Point }[] = [];
    for (const wire of state.getGraph().wires) {
      const outKey = portKey(wire.from.node, wire.from.port, 'out');
      const inKey = portKey(wire.to.node, wire.to.port, 'in');
      const a = portCenter(outKey);
      const b = portCenter(inKey);
      const type = wireType(wire);
      if (!a || !b || !type) continue;
      items.push({ d: { wire, type, from: portCard.get(outKey) ?? wire.from.node, to: portCard.get(inKey) ?? wire.to.node, outKey, inKey }, a, b });
    }
    const routes = routeSpecs(items.map(({ d, a, b }) => specOf(d, a, b)), fast ? 'fast' : 'all');
    const types = new Map<string, PortType>(); // by knot key
    for (const { d, a, b } of items) {
      const { wire, type } = d;
      const route = routes.get(wire.id);
      const pd = pathOf(route, a, b);
      const g = svgEl('g', 'wc-wire-g');
      const hit = svgEl('path', 'wc-wire-hit');
      hit.setAttribute('d', pd);
      hit.dataset.wire = wire.id;
      const path = svgEl('path', `wc-wire type-${type}`);
      path.setAttribute('d', pd);
      g.append(path, hit);
      wireLayer.append(g);
      wirePaths.set(wire.id, path);
      wireDraws.set(wire.id, { ...d, g });
      types.set(knotKey(state.getScope(), wire.id), type);
      if (isEnergyEnabled()) energy.addWire(wire, type, path, portEls.get(d.outKey), portEls.get(d.inKey), playing);
      if (playing) {
        const mid = route ? midPoint(route.pts) : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const badge = h('div', `wc-badge type-${type}`);
        badge.style.left = `${mid.x}px`;
        badge.style.top = `${mid.y}px`;
        badgeLayer.append(badge);
        badgeEls.set(wire.id, { el: badge, wire, type });
      }
    }
    knots.draw(types);
    applySelection();
    applyFocus();
    refreshBadges();
    syncEnergyLoop();
    minimap.redraw();
  }

  /** Draws only these wires again (null = all), in place: the other wires and the DOM stay as they are. */
  function redrawWires(only: ReadonlySet<string> | null): void {
    if (only === null || wireDraws.size === 0) {
      drawWires();
      return;
    }
    const specs: WireSpec[] = [];
    for (const id of only) {
      const d = wireDraws.get(id);
      const a = d && portCenter(d.outKey);
      const b = d && portCenter(d.inKey);
      if (d && a && b) specs.push(specOf(d, a, b));
    }
    const fresh = routeSpecs(specs, 'some');
    for (const sp of specs) {
      const route = fresh.get(sp.id);
      const pd = pathOf(route, sp.a, sp.b);
      for (const part of wireDraws.get(sp.id)?.g.children ?? []) if (part.tagName === 'path') part.setAttribute('d', pd);
    }
  }

  /** Cards are being dragged: their wires follow, once per frame. */
  function moveWires(cardIds: ReadonlySet<string>): void {
    for (const d of wireDraws.values()) if (cardIds.has(d.from) || cardIds.has(d.to)) pendingMove.add(d.wire.id);
    if (moveRaf) return;
    moveRaf = requestAnimationFrame(() => {
      moveRaf = 0;
      const ids = pendingMove;
      pendingMove = new Set();
      redrawWires(ids);
    });
  }

  function applyFocus(): void {
    if (focusId !== null && !nodeEls.has(focusId)) focusId = null;
    const on = focusId !== null && !state.isPlaying();
    el.classList.toggle('focusing', on);
    const litCards = new Set<string>();
    const litWires = new Set<string>();
    if (on && focusId !== null) {
      litCards.add(focusId);
      for (const d of wireDraws.values()) {
        if (d.from !== focusId && d.to !== focusId) continue;
        litWires.add(d.wire.id);
        litCards.add(d.from);
        litCards.add(d.to);
      }
    }
    for (const [id, d] of wireDraws) d.g.classList.toggle('lit', litWires.has(id));
    for (const [id, box] of nodeEls) box.classList.toggle('faded', on && !litCards.has(id));
    const scope = state.getScope();
    knots.fade(on ? new Set([...litWires].map((id) => knotKey(scope, id))) : null);
  }

  function setFocus(id: string | null): void {
    if (id === focusId) return;
    focusId = id;
    applyFocus();
  }

  /** Where a single dropped card ends up: where it was dropped, or the nearest free spot when it landed on another card. */
  function settleCard(id: string, pos: Point): Point {
    const size = sizeOf(id);
    if (!size) return pos;
    const taken: Box[] = [];
    for (const [other, box] of nodeEls) if (other !== id) taken.push({ x: box.offsetLeft, y: box.offsetTop, w: box.offsetWidth, h: box.offsetHeight });
    for (const spot of stubSpots) taken.push(stubBox(spot));
    return settleDrop(taken, { ...pos, ...size });
  }

  const knots = createKnotEditor({
    state,
    layer: knotLayer,
    zoom: () => view.zoom,
    toWorld: (cx, cy) => clientToWorld(cx, cy),
    routeOf(wireId) {
      const known = routed.get(wireId)?.route;
      if (known) return known;
      const d = wireDraws.get(wireId);
      const a = d && portCenter(d.outKey);
      const b = d && portCenter(d.inKey);
      return d && a && b ? curveRoute(specOf(d, a, b)) : null;
    },
    keyOf: (wireId) => knotKey(state.getScope(), wireId),
    sourceOf: (key) => {
      const id = wireIdOfKnotKey(key);
      const w = state.getGraph().wires.find((x) => x.id === id);
      return w ? `${w.from.node}|${w.from.port}` : undefined;
    },
    redraw: (keys) => redrawWires(keys === null ? null : new Set([...keys].map(wireIdOfKnotKey))),
    refreshDots: () => knots.draw(new Map([...wireDraws].map(([id, d]) => [knotKey(state.getScope(), id), d.type]))),
    notify,
  });

  /** Which ports every card shows right now, so a setting that adds or removes ports can redraw the cards. */
  function portSignature(): string {
    return state
      .getGraph()
      .nodes.map((n) => {
        const def = getNodeDef(n.kind);
        return def ? `${n.id}:${activeInputs(def, n.params).map((q) => q.id).join('.')}/${activeOutputs(def, n.params).map((q) => q.id).join('.')}` : n.id;
      })
      .join(',');
  }
  let drawnPorts = '';

  function render(): void {
    drawnPorts = portSignature();
    renderNodes();
    syncNotes(state, noteLayer, noteEls);
    noteLayer.hidden = inGroup();
    crumb.update();
    hint.hidden = state.getGraph().nodes.length > 0 || state.getNotes().length > 0;
    el.classList.toggle('readonly', state.isPlaying());
    drawWires();
  }

  function applySelection(): void {
    const sel = state.getSelection();
    const multi = state.getMulti();
    for (const [id, box] of nodeEls) box.classList.toggle('selected', multi.has(id));
    for (const [id, parts] of noteEls) parts.el.classList.toggle('selected', multi.has(id));
    for (const [id, path] of wirePaths) path.classList.toggle('selected', sel?.kind === 'wire' && sel.id === id);
  }

  function refreshBadges(): void {
    const rt = getRuntime();
    if (!rt) return;
    for (const { el: badge, wire, type } of badgeEls.values()) {
      let text: string;
      try {
        const src = state.getGraph().nodes.find((n) => n.id === wire.from.node);
        text = formatWireValue(type, rt.getWireValue(wire), (src && getNodeDef(src.kind)?.label) || TEXT_VI.none);
      } catch {
        text = TEXT_VI.none;
      }
      if (badge.textContent !== text) badge.textContent = text;
    }
  }

  /** Wire current: one animation frame at a time while playing, nothing when idle or switched off. */
  function energyFrame(now: number): void {
    energyRaf = 0;
    const rt = getRuntime();
    if (!state.isPlaying() || !isEnergyEnabled()) return;
    const dt = Math.min(50, now - energyLast);
    energyLast = now;
    if (rt) {
      try {
        energy.update(dt, now, (w) => rt.getWireValue(w), () => rt.takeRisen?.());
      } catch {
        // A bad frame must never break the board; the next frame tries again.
      }
    }
    energyRaf = requestAnimationFrame(energyFrame);
  }

  function syncEnergyLoop(): void {
    if (state.isPlaying() && isEnergyEnabled()) {
      if (!energyRaf) {
        energyLast = performance.now();
        energyRaf = requestAnimationFrame(energyFrame);
      }
      return;
    }
    if (energyRaf) cancelAnimationFrame(energyRaf);
    energyRaf = 0;
    energy.clear();
  }

  onEnergySettingChange(() => drawWires());

  // ---------- placement, arrange, pulse ----------

  function findFreeSpot(want: Point, kind?: string): Point {
    const size = kind ? estimateNodeSize({ id: '', kind, params: {}, pos: want }) : { w: 168, h: 90 };
    const scene = sceneGraph(state.getGraph(), state.getScope());
    return findFreeNodeSpot(want, size, [...occupiedBoxes(scene, notesInView(), sizeOf), ...blockedWorld()], visibleWorld());
  }

  const actions = createNodeActions({ el, state, nodeEls, sizeOf, drawWires, fit: () => fitToContent(), blocked: blockedWorld, visibleWorld });
  const { flash } = actions;
  const arrange = actions.arrange;

  // ---------- pointer interaction ----------

  function setTip(text: string | null, cx = 0, cy = 0): void {
    tip.hidden = !text;
    if (!text) return;
    const r = el.getBoundingClientRect();
    tip.textContent = text;
    tip.style.left = `${cx - r.left + 14}px`;
    tip.style.top = `${cy - r.top + 14}px`;
  }

  const wires = createWireDrag({
    root: el,
    wireLayer,
    state,
    notify,
    toWorld: clientToWorld,
    showTip: setTip,
    shake: (id) => flash(id, 'shake'),
  });

  attachPointer({
    el, state, wires, nodeEls, noteEls, noteLayer,
    getView: () => view,
    setView: (v) => { view = v; applyView(); },
    clientToWorld, render, moveWires, knots,
    onTap: (id) => setFocus(id === focusId ? null : id),
    onEmptyDown: () => setFocus(null),
    settle: settleCard,
  });

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && focusId !== null) setFocus(null);
  });

  // Fade the bottom-left cluster while a dragged node or wire passes under it (it still takes clicks).
  let pressOnItem = false;
  const touchesCorner = (e: PointerEvent): boolean => {
    const c = el.getBoundingClientRect();
    const corner = localRect(toolbar.el);
    if (!corner) return false;
    const m = CORNER_GAP;
    const inside = (x: number, y: number): boolean =>
      x > corner.x - m && x < corner.x + corner.w + m && y > corner.y - m && y < corner.y + corner.h + m;
    if (inside(e.clientX - c.left, e.clientY - c.top)) return true;
    for (const box of nodeEls.values()) {
      if (!box.classList.contains('selected')) continue;
      const r = box.getBoundingClientRect();
      if (r.right - c.left > corner.x - m && r.left - c.left < corner.x + corner.w + m && r.bottom - c.top > corner.y - m && r.top - c.top < corner.y + corner.h + m) return true;
    }
    return false;
  };
  el.addEventListener('pointerdown', (e) => {
    pressOnItem = e.target instanceof Element && !e.target.closest('.wc-ui') && !!e.target.closest('.wc-node, .wc-note');
  }, true);
  el.addEventListener('pointermove', (e) => {
    toolbar.el.classList.toggle('dim', pressOnItem && (e.buttons & 1) === 1 && touchesCorner(e));
  }, true);
  const endDrag = (): void => {
    pressOnItem = false;
    toolbar.el.classList.remove('dim');
  };
  el.addEventListener('pointerup', endDrag, true);
  el.addEventListener('pointercancel', endDrag, true);

  // ---------- state sync ----------

  state.subscribe((kind) => {
    if (kind === 'scope') {
      focusId = null;
      render();
      fitToContent();
    } else if (kind === 'board') {
      focusId = null;
      seenNodes.clear();
      for (const n of state.getGraph().nodes) seenNodes.add(n.id);
      render();
      fitToContent();
    } else if (kind === 'graph' || kind === 'playing') {
      render();
      const fresh = state.getGraph().nodes.filter((n) => !seenNodes.has(n.id));
      for (const n of fresh) seenNodes.add(n.id);
      if (fresh.length === 1 && !state.isPlaying()) actions.placeNewNode(fresh[0] as GraphNode);
    } else if (kind === 'params') {
      if (portSignature() !== drawnPorts) render();
    } else if (kind === 'notes') {
      syncNotes(state, noteLayer, noteEls);
      applySelection();
      hint.hidden = state.getGraph().nodes.length > 0 || state.getNotes().length > 0;
      minimap.redraw();
    } else if (kind === 'selection') applySelection();
  });

  applyView();
  render();

  function centerOnNode(nodeId: string): void {
    const group = findGroup(state.getGraph(), nodeId);
    const node = group ? { id: nodeId, kind: 'group', params: {}, pos: { x: group.x, y: group.y } } : state.getGraph().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    // Show the group the node lives in first (this also selects it).
    if (!group && (groupOfNode(state.getGraph(), nodeId)?.id ?? null) !== state.getScope()) state.select({ kind: 'node', id: nodeId });
    const size = sizeOf(nodeId) ?? estimateNodeSize(node);
    const r = el.getBoundingClientRect();
    view = {
      ...view,
      panX: r.width / 2 - (node.pos.x + size.w / 2) * view.zoom,
      panY: r.height / 2 - (node.pos.y + size.h / 2) * view.zoom,
    };
    applyView();
  }

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
    centerOn: centerOnNode,
    revealNode(nodeId) {
      const box = nodeEls.get(nodeId);
      const node = state.getGraph().nodes.find((n) => n.id === nodeId);
      if (!box || !node) return;
      const size = { w: box.offsetWidth, h: box.offsetHeight };
      const vis = visibleWorld();
      const inside = node.pos.x >= vis.x && node.pos.y >= vis.y && node.pos.x + size.w <= vis.x + vis.w && node.pos.y + size.h <= vis.y + vis.h;
      const covered = blockedWorld().some((b) => node.pos.x < b.x + b.w && node.pos.x + size.w > b.x && node.pos.y < b.y + b.h && node.pos.y + size.h > b.y);
      if (!inside || covered) centerOnNode(nodeId);
      box.classList.remove('wc-flash');
      void box.offsetWidth; // restart the flash
      box.classList.add('wc-flash');
    },
    refreshBadges,
    findFreeSpot,
    placementAreas: () => ({ blocked: blockedWorld(), visible: visibleWorld() }),
    arrange,
    setOverlayInsets({ right, bottom }) {
      const ok = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
      overlayBR = { w: ok(right), h: ok(bottom) };
    },
    hasOutPin: (nodeId, portId) => portEls.has(portKey(nodeId, portId, 'out')),
    setStepLight(light) {
      stepLayer ??= createStepLightLayer({ root: el, wireLayer, nodeEls, portEls, wirePaths, getView: () => view, setView: (v) => { view = v; applyView(); } });
      stepLayer.set(light);
    },
  };
}
