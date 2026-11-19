import { expandBoard, type CircuitIdMap } from '../../circuits/expand';
import { instanceNameOf, isInstance } from '../../circuits/instance';
import type { Board, Graph, NodeDef } from '../../engine/types';
import type { EditorState } from '../editor-state';
import { buildSceneModel, type SceneRoot } from '../scene/scene-model';
import { cardLabel, circuitIdOf, circuitsOf, findCircuit, openGraph, type CircuitPath, type CircuitStep } from './circuit-model';

/**
 * What the game view, the scene tree and a click on the stage know about cards that sit inside copies of circuits.
 * The game runs the flat graph, where such a card is called `<copy>/<card>`; the canvas shows one board at a time, where the
 * same card has its plain id. These helpers go from one to the other.
 */

const SEP = ' › ';

/** The flat graph of the whole board with where each card comes from; null when the board has no circuits or does not expand. */
function flatOf(board: Board): { graph: Graph; idMap: CircuitIdMap } | null {
  if (circuitsOf(board).length === 0) return null;
  try {
    return expandBoard(board);
  } catch {
    return null;
  }
}

/** Where a running card is drawn: the copies to go through from the main board (outermost first) and its id on that canvas. Null for an unknown id. */
export function locateFlatNode(board: Board, flatId: string): { steps: CircuitStep[]; inner: string } | null {
  if (board.graph.nodes.some((n) => n.id === flatId)) return { steps: [], inner: flatId };
  const origin = flatOf(board)?.idMap.origins.get(flatId);
  if (!origin) return null;
  const steps: CircuitStep[] = [];
  let graph = board.graph;
  for (const via of origin.path) {
    const copy = graph.nodes.find((n) => n.id === via);
    const circuit = copy && isInstance(copy) ? findCircuit(board, circuitIdOf(copy)) : undefined;
    if (!circuit) return null;
    steps.push({ circuit: circuit.id, via });
    graph = circuit.graph;
  }
  return { steps, inner: origin.inner };
}

/** A name a person can read for a running card: "Xe AGV 3 › Động cơ" for a card inside a copy, the card's own name on the main board. */
export function flatNodeLabel(board: Board, flatId: string): string {
  const at = locateFlatNode(board, flatId);
  if (!at) return flatId;
  const parts: string[] = [];
  let graph = board.graph;
  for (const step of at.steps) {
    const copy = graph.nodes.find((n) => n.id === step.via);
    parts.push((copy && instanceNameOf(copy)) || findCircuit(board, step.circuit)?.name || step.circuit);
    graph = findCircuit(board, step.circuit)?.graph ?? graph;
  }
  const card = graph.nodes.find((n) => n.id === at.inner);
  parts.push(card ? cardLabel(board, card) : at.inner);
  return parts.join(SEP);
}

/**
 * The scene tree of what the game view shows: the whole board with every object inside every copy (named
 * "Xe AGV 3 › Khối"), or just the cards on the canvas while the bench runs that circuit alone (`benchOn`).
 */
export function sceneRoots(board: Board, path: CircuitPath, benchOn: boolean, lookup: (kind: string) => NodeDef | undefined): SceneRoot[] {
  if (benchOn) return buildSceneModel(openGraph(board, path), lookup);
  const flat = flatOf(board);
  if (!flat) return buildSceneModel(board.graph, lookup);
  const roots = buildSceneModel(flat.graph, lookup);
  for (const root of roots) {
    for (const group of root.groups) {
      for (const item of group.items) {
        const origin = flat.idMap.origins.get(item.nodeId);
        if (!origin || origin.path.length === 0) continue;
        const whole = flatNodeLabel(board, item.nodeId);
        // Keep the tree's own name for the object ("Khối #3"), with the copies it sits in in front.
        item.label = `${whole.slice(0, whole.lastIndexOf(SEP))}${SEP}${item.label}`;
      }
    }
  }
  return roots;
}

/** Goes to a running card wherever it is drawn (into the copies it sits in) and selects it. False for an unknown id. */
export function revealFlatNode(state: EditorState, flatId: string): boolean {
  const at = locateFlatNode(state.getBoard(), flatId);
  if (!at) return false;
  const now = state.getCircuitPath();
  const same = now.length === at.steps.length && at.steps.every((s, i) => s.circuit === now[i]?.circuit && s.via === now[i]?.via);
  if (!same) {
    state.exitCircuit(0);
    for (const step of at.steps) if (!state.enterCircuit(step)) return false;
  }
  state.select({ kind: 'node', id: at.inner });
  return true;
}

/**
 * A click on an object of the stage: the card to select and drag on the canvas as it is. An object that belongs to a card
 * the canvas is not showing (inside a copy, or on the main board while a circuit is open) cannot be dragged from here: its
 * outermost copy (or the card itself) is selected on the main board instead, and null is returned.
 */
export function pickOnCanvas(state: EditorState, ownerId: string): string | null {
  if (state.getGraph().nodes.some((n) => n.id === ownerId)) return ownerId;
  const at = locateFlatNode(state.getBoard(), ownerId);
  if (!at) return null;
  state.exitCircuit(0);
  state.select({ kind: 'node', id: at.steps[0]?.via ?? at.inner });
  return null;
}

/**
 * The running cards that stand for what is selected on the canvas, for the frames and the glow on the stage: a selected copy
 * stands for every card inside it, a card inside an entered copy for that copy's own card. `benchOn`: the canvas shows the
 * very cards that run.
 */
export function stageOwners(board: Board, path: CircuitPath, benchOn: boolean, selected: ReadonlySet<string>): ReadonlySet<string> {
  if (selected.size === 0 || benchOn) return selected;
  const flat = flatOf(board);
  if (!flat) return selected;
  const copies: string[] = [];
  for (const step of path) {
    // Opened from the list: no copy was chosen, so nothing on the stage is "this card".
    if (step.via === undefined) return new Set();
    copies.push(step.via);
  }
  const open = openGraph(board, path);
  const out = new Set<string>();
  for (const id of selected) {
    const node = open.nodes.find((n) => n.id === id);
    if (!node) continue;
    if (!isInstance(node)) {
      const flatId = flat.idMap.expandedId(copies, id);
      if (flatId !== undefined) out.add(flatId);
      continue;
    }
    const prefix = [...copies, id];
    for (const [flatId, origin] of flat.idMap.origins) if (prefix.every((p, i) => origin.path[i] === p)) out.add(flatId);
  }
  return out;
}
