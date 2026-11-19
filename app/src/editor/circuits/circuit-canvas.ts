import { expandBoard, type CircuitIdMap } from '../../circuits/expand';
import { instancePorts, isInstance, isPinWired } from '../../circuits/instance';
import type { GraphNode, Wire } from '../../engine/types';
import { h } from '../dom';
import type { EditorState } from '../editor-state';
import type { Box } from '../graph/graph-geometry';
import type { NodeViewResult } from '../graph/node-view';
import type { PortDir } from '../graph/port-compat';
import { uiPrefs } from '../theme/ui-prefs';
import { addPinTo, openInstance, removePin, stackCopies, type Notify } from './circuit-actions';
import { createCircuitCrumb } from './circuit-crumb';
import { missingByCard } from './circuit-issues';
import {
  cardLabel,
  circuitIdOf,
  circuitOfStackCard,
  circuitsOf,
  exposedView,
  findCircuit,
  lookupOf,
  movePin,
  openCircuit,
  removeExposed,
  renameExposed,
  renamePin,
  stackAnchor,
  stackCardId,
  stacksOf,
} from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { buildAddPinButton, buildExposedCard, buildInstanceView, buildPinCard, instanceTitle } from './circuit-views';
import { PIN_PORT, pinCardDir, pinCardId } from './circuit-wiring';
import './circuits.css';

/** Room between the pin columns and the cards of the circuit (px, board units). */
const PIN_MARGIN = 90;
/** Height the path bar and the note under it take at the top of the board (px at 100% zoom, with some air). */
const HEADROOM = 104;
const PIN_WIDTH = { student: 236, teacher: 208 } as const;
/** Where the pin columns stand when the circuit has no cards yet. */
const EMPTY_INSIDE: Box = { x: 0, y: 0, w: 420, h: 220 };

/** How the canvas registers what this layer draws. */
export interface CardSink {
  /** A card in the node layer (a stacked block). */
  addCard(id: string, box: HTMLElement): void;
  /** The dot a wire end on `node`/`port` is drawn to, and the card it sits on. */
  addPort(node: string, port: string, dir: PortDir, dot: HTMLElement, cardId: string): void;
}

export interface CircuitCanvas {
  /** The crumb bar and the note under it; the canvas mounts them as overlays. */
  overlays: HTMLElement[];
  /** True for a copy that is drawn as part of a stacked block. */
  hides(nodeId: string): boolean;
  /** The block of a copy of a circuit (`missing`: its required pins without a wire); null for any other card. */
  card(node: GraphNode, missing?: ReadonlySet<string>): NodeViewResult | null;
  /** Required inputs without a wire, per card of the open graph (copies of circuits included). */
  missing(): Map<string, Set<string>>;
  /** Draws the stacked blocks and, inside a circuit, its pin cards (into `layer`). Call once per render, after the cards. */
  renderExtras(sink: CardSink, inner: readonly Box[]): void;
  /** Boxes of the pin cards, for fitting the view and routing wires around them. */
  pinBoxes(): { id: string; box: Box }[];
  /** Inside a circuit: a point above its cards that "fit to screen" also keeps in view, so the path bar and its note cover none of them. */
  headroom(): Box | null;
  /** Double-click on a card: opens a copy, spreads a stack. True when it was one of those. */
  openCard(id: string): boolean;
  /** Part of the "what the cards show" signature for a card without a node definition. */
  signature(node: GraphNode): string;
  /** The wire the running game knows for a drawn wire, or null when its value cannot be read (inside a circuit). */
  liveWire(wire: Wire): Wire | null;
  /** Re-read the path: crumb, note, lock. */
  update(): void;
}

export function createCircuitCanvas(deps: { state: EditorState; layer: HTMLElement; notify: Notify }): CircuitCanvas {
  const { state, layer, notify } = deps;
  const crumb = createCircuitCrumb(state);
  let pinCards: { id: string; el: HTMLElement }[] = [];
  let columns: HTMLElement[] = [];
  /** Pin ports of the running game, kept for one play. */
  let live: { idMap: CircuitIdMap } | null = null;

  const board = () => state.getBoard();
  const path = () => state.getCircuitPath();
  const hasCircuits = (): boolean => circuitsOf(board()).length > 0;

  state.subscribe((kind) => {
    if (kind !== 'playing' && kind !== 'board') return;
    live = null;
    if (!state.isPlaying() || !hasCircuits()) return;
    try {
      live = { idMap: expandBoard(board()).idMap };
    } catch {
      // The board does not expand (the game view reports why); the wires just show no values.
      live = null;
    }
  });

  function instanceCard(node: GraphNode, missing: ReadonlySet<string> | undefined): NodeViewResult {
    const circuit = findCircuit(board(), circuitIdOf(node));
    return buildInstanceView({
      id: node.id,
      pos: node.pos,
      circuit,
      ports: circuit ? instancePorts(circuit, lookupOf(board())) : { inputs: [], outputs: [] },
      name: instanceTitle(node, circuit),
      playing: state.isPlaying(),
      wireNode: node.id,
      ...(missing ? { missing } : {}),
      onOpen: () => openInstance(state, node.id),
    });
  }

  function renderStacks(sink: CardSink): void {
    for (const [circuitId, members] of stacksOf(state.getGraph())) {
      const circuit = findCircuit(board(), circuitId);
      if (!circuit) continue;
      const id = stackCardId(circuitId);
      const { box, dots } = buildInstanceView({
        id,
        pos: stackAnchor(members),
        circuit,
        ports: instancePorts(circuit, lookupOf(board())),
        name: circuit.name,
        playing: state.isPlaying(),
        stack: { count: members.length, onSpread: () => stackCopies(state, circuitId, false) },
        onOpen: () => state.enterCircuit({ circuit: circuitId }),
      });
      sink.addCard(id, box);
      // Every wire on any copy of the stack ends on the one block.
      for (const [key, dot] of dots) {
        const [dir, port] = key.split('|') as [PortDir, string];
        for (const m of members) sink.addPort(m.id, port, dir, dot, id);
      }
    }
  }

  function renderPins(sink: CardSink, inner: readonly Box[]): void {
    const circuit = openCircuit(board(), path());
    if (!circuit) return;
    const readOnly = state.isReadOnly();
    const width = PIN_WIDTH[uiPrefs().mode()];
    const boxes = inner.length > 0 ? inner : [EMPTY_INSIDE];
    const minX = Math.min(...boxes.map((b) => b.x));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const top = Math.min(...boxes.map((b) => b.y));
    const edit = (change: Parameters<EditorState['edit']>[0]): void => void state.edit(change);

    for (const dir of ['in', 'out'] as const) {
      const col = h('div', `wc-pin-col ${dir}`);
      col.style.left = `${dir === 'in' ? minX - PIN_MARGIN - width : maxX + PIN_MARGIN}px`;
      col.style.top = `${top}px`;
      col.style.width = `${width}px`;
      const side = circuit.pins.filter((p) => p.dir === dir);
      side.forEach((pin, i) => {
        const { el, dot } = buildPinCard(pin, i, side.length, readOnly, {
          rename: (id, label) => edit((b) => renamePin(b, circuit.id, id, label)),
          move: (id, delta) => edit((b) => movePin(b, circuit.id, id, delta)),
          remove: (id) => removePin(state, circuit.id, id, notify),
        });
        col.append(el);
        pinCards.push({ id: pinCardId(pin.id), el });
        sink.addPort(pinCardId(pin.id), PIN_PORT, pinCardDir(pin), dot, pinCardId(pin.id));
      });
      if (!readOnly) col.append(buildAddPinButton(dir, () => addPinTo(state, circuit.id, dir)));
      if (dir === 'in') {
        for (const e of circuit.exposed) {
          const view = exposedView(board(), circuit, e);
          const node = circuit.graph.nodes.find((n) => n.id === e.inner.node);
          const of = view ? T.exposedOf(view.nodeLabel, view.def.label) : node ? cardLabel(board(), node) : e.inner.node;
          col.append(
            buildExposedCard(e, of, readOnly, {
              rename: (id, label) => edit((b) => renameExposed(b, circuit.id, id, label)),
              remove: (id) => edit((b) => removeExposed(b, circuit.id, id)),
              jump: (nodeId) => state.select({ kind: 'node', id: nodeId }),
            }),
          );
        }
      }
      layer.append(col);
      columns.push(col);
    }
  }

  return {
    overlays: [crumb.el, crumb.note],
    hides(nodeId) {
      const graph = state.getGraph();
      if (!graph.stacks) return false;
      const node = graph.nodes.find((n) => n.id === nodeId);
      return node !== undefined && isInstance(node) && stacksOf(graph).has(circuitIdOf(node));
    },
    card(node, missing) {
      return isInstance(node) ? instanceCard(node, missing) : null;
    },
    missing: () => missingByCard(board(), path()),
    renderExtras(sink, inner) {
      pinCards = [];
      columns = [];
      renderStacks(sink);
      renderPins(sink, inner);
    },
    pinBoxes() {
      return pinCards.map(({ id, el }) => {
        const col = el.parentElement;
        return { id, box: { x: (col?.offsetLeft ?? 0) + el.offsetLeft, y: (col?.offsetTop ?? 0) + el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } };
      });
    },
    headroom() {
      const first = columns[0];
      return first ? { x: first.offsetLeft, y: first.offsetTop - HEADROOM, w: 1, h: 1 } : null;
    },
    openCard(id) {
      const stacked = circuitOfStackCard(id);
      if (stacked !== null) {
        stackCopies(state, stacked, false);
        return true;
      }
      return openInstance(state, id);
    },
    signature(node) {
      if (!isInstance(node)) return node.id;
      const circuit = findCircuit(board(), circuitIdOf(node));
      return `${node.id}:${instanceTitle(node, circuit)}:${circuit?.pins.map((p) => `${p.id}${p.type}${p.label}${isPinWired(p) ? '' : '?'}`).join('.') ?? ''}`;
    },
    liveWire(wire) {
      if (path().length > 0) return null;
      if (!live) return wire;
      const from = state.getGraph().nodes.find((n) => n.id === wire.from.node);
      if (!from || !isInstance(from)) return wire;
      const port = live.idMap.pinPort([from.id], wire.from.port);
      return port ? { ...wire, from: port } : null;
    },
    update: () => crumb.update(),
  };
}
