import type { PortType } from '../../engine/types';
import { h } from '../dom';
import { GRAPH_TEXT } from './graph-text-vi';

export interface GraphToolbar {
  el: HTMLElement;
  setZoom(zoom: number): void;
}

interface Actions {
  zoomOut(): void;
  zoomIn(): void;
  reset(): void;
  fit(): void;
  arrange(): void;
}

function button(className: string, text: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', className, text);
  b.type = 'button';
  b.title = title;
  b.addEventListener('click', onClick);
  return b;
}

/** Bottom-left bar: zoom controls, fit, arrange, and the permanent port type legend. */
export function createGraphToolbar(actions: Actions): GraphToolbar {
  const el = h('div', 'wc-bar wc-ui');
  const tool = h('div', 'wc-tool');
  const pct = button('wc-pct', '100%', GRAPH_TEXT.zoomReset, actions.reset);
  tool.append(
    button('wc-tbtn', '−', GRAPH_TEXT.zoomOut, actions.zoomOut),
    pct,
    button('wc-tbtn', '+', GRAPH_TEXT.zoomIn, actions.zoomIn),
    h('span', 'wc-sep'),
    button('wc-lbl', GRAPH_TEXT.fit, GRAPH_TEXT.fit, actions.fit),
    button('wc-lbl', GRAPH_TEXT.arrange, GRAPH_TEXT.arrangeTitle, actions.arrange),
  );
  const legend = h('div', 'wc-legend');
  legend.setAttribute('aria-label', GRAPH_TEXT.legendLabel);
  for (const type of ['bool', 'number', 'object'] as PortType[]) {
    const item = h('span', 'wc-legend-item');
    item.append(h('i', `wc-shape type-${type}`), GRAPH_TEXT.typeName[type]);
    legend.append(item);
  }
  el.append(tool, legend);
  return {
    el,
    setZoom(zoom) {
      pct.textContent = `${Math.round(zoom * 100)}%`;
    },
  };
}
