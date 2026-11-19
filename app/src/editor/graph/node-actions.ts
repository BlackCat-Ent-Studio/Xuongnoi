import type { GraphNode } from '../../engine/types';
import type { EditorState } from '../editor-state';
import { stackScene } from '../circuits/circuit-model';
import { sceneGraph } from '../groups/group-model';
import { computeLayout } from './auto-layout';
import type { Box, Size } from './graph-geometry';
import { findFreeNodeSpot, occupiedBoxes } from './node-placement';

interface Ctx {
  el: HTMLElement;
  state: EditorState;
  nodeEls: Map<string, HTMLElement>;
  sizeOf: (id: string) => Size | undefined;
  /** `fast`: plain curves, used while cards slide. */
  drawWires: (fast?: boolean) => void;
  fit: () => void;
  /** World-space regions covered by overlays; new nodes are kept off them. */
  blocked?: () => Box[];
  /** World-space area currently on screen; new nodes are placed inside it. */
  visibleWorld?: () => Box;
}

const ARRANGE_MS = 300;

/** Node-level actions on the canvas: pulse/shake feedback, free-spot placement, animated auto-layout. */
export function createNodeActions({ el, state, nodeEls, sizeOf, drawWires, fit, blocked, visibleWorld }: Ctx) {
  let animating = false;

  function flash(id: string, cls: 'new' | 'shake'): void {
    const box = nodeEls.get(id);
    if (!box) return;
    box.classList.remove(cls);
    void box.offsetWidth; // restart the animation
    box.classList.add(cls);
    setTimeout(() => box.classList.remove(cls), 1200);
  }

  /** A node just added through the palette lands on a free spot near where it was dropped, then pulses. */
  function placeNewNode(node: GraphNode): void {
    const box = nodeEls.get(node.id);
    if (!box) return;
    const scope = state.getScope();
    const taken = [...occupiedBoxes(stackScene(sceneGraph(state.getGraph(), scope)), scope === null && state.getCircuitPath().length === 0 ? state.getNotes() : [], sizeOf, node.id), ...(blocked?.() ?? [])];
    const spot = findFreeNodeSpot(node.pos, { w: box.offsetWidth, h: box.offsetHeight }, taken, visibleWorld?.());
    if (spot.x !== node.pos.x || spot.y !== node.pos.y) {
      state.moveItems([{ id: node.id, pos: spot }], { amend: true });
      box.style.left = `${spot.x}px`;
      box.style.top = `${spot.y}px`;
      drawWires();
    }
    flash(node.id, 'new');
  }

  function arrange(): void {
    const graph = stackScene(sceneGraph(state.getGraph(), state.getScope()));
    if (state.isReadOnly() || graph.nodes.length === 0 || animating) return;
    const origin = { x: Math.min(...graph.nodes.map((n) => n.pos.x)), y: Math.min(...graph.nodes.map((n) => n.pos.y)) };
    const layout = computeLayout(graph, sizeOf, origin);
    animating = true;
    el.classList.add('arranging');
    for (const [id, p] of layout) {
      const box = nodeEls.get(id);
      if (box) {
        box.style.left = `${p.x}px`;
        box.style.top = `${p.y}px`;
      }
    }
    state.moveItems([...layout].map(([id, pos]) => ({ id, pos })));
    const t0 = performance.now();
    const tick = (): void => {
      const last = performance.now() - t0 >= ARRANGE_MS;
      drawWires(!last);
      if (!last) requestAnimationFrame(tick);
      else {
        el.classList.remove('arranging');
        animating = false;
        fit();
      }
    };
    requestAnimationFrame(tick);
  }

  return { flash, placeNewNode, arrange };
}
