import type { PortType } from '../../engine/types';
import { h } from '../dom';
import { icon, type IconName } from '../icons';
import { GRAPH_TEXT } from './graph-text-vi';

export interface GraphToolbar {
  /** Bottom-left cluster: coach hint, zoom rail and the minimap card with the legend. */
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

export const COACH_KEY = 'xuongnoi.graph.coachDismissed';

type CoachStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): CoachStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // privacy modes can throw on access
  }
}

export function isCoachDismissed(store: CoachStore | null = defaultStore()): boolean {
  try {
    return store?.getItem(COACH_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissCoach(store: CoachStore | null = defaultStore()): void {
  try {
    store?.setItem(COACH_KEY, '1');
  } catch {
    /* storage full or blocked: the hint just comes back next visit */
  }
}

function button(className: string, label: string, onClick: () => void, content: Node | string): HTMLButtonElement {
  const b = h('button', className);
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(content);
  b.addEventListener('click', onClick);
  return b;
}

const iconButton = (name: IconName, label: string, onClick: () => void): HTMLButtonElement =>
  button('wc-tbtn', label, onClick, icon(name));

/**
 * Bottom-left cluster: a slim vertical rail (+, zoom %, -, fit, arrange) beside the minimap card,
 * the type legend under the map, and a dismissible coach hint above both.
 * `minimapEl` is the clickable map; the legend stays visible when the map is hidden on short canvases.
 */
export function createGraphToolbar(actions: Actions, minimapEl: HTMLElement): GraphToolbar {
  const el = h('div', 'wc-corner wc-ui');

  const coach = h('div', 'wc-coach');
  coach.setAttribute('role', 'note');
  const coachClose = button(
    'wc-coach-x',
    GRAPH_TEXT.coachClose,
    () => {
      dismissCoach();
      coach.hidden = true;
    },
    icon('close'),
  );
  coach.append(h('span', '', GRAPH_TEXT.coach), coachClose);
  coach.hidden = isCoachDismissed();

  const pct = button('wc-pct', GRAPH_TEXT.zoomReset, actions.reset, '100%');
  const rail = h('div', 'wc-rail');
  rail.setAttribute('role', 'toolbar');
  rail.setAttribute('aria-label', GRAPH_TEXT.zoomLabel);
  rail.append(
    iconButton('plus', GRAPH_TEXT.zoomIn, actions.zoomIn),
    pct,
    iconButton('minus', GRAPH_TEXT.zoomOut, actions.zoomOut),
    h('hr', 'wc-sep'),
    iconButton('fit', GRAPH_TEXT.fit, actions.fit),
    iconButton('arrange', GRAPH_TEXT.arrange, actions.arrange),
  );

  const legend = h('div', 'wc-legend');
  legend.setAttribute('aria-label', GRAPH_TEXT.legendLabel);
  for (const type of ['bool', 'number', 'object'] as PortType[]) {
    const item = h('span', 'wc-legend-item');
    item.append(h('i', `wc-shape type-${type}`), GRAPH_TEXT.typeName[type]);
    legend.append(item);
  }
  const card = h('div', 'wc-mini');
  card.append(minimapEl, legend);

  const row = h('div', 'wc-corner-row');
  row.append(rail, card);
  el.append(coach, row);
  return {
    el,
    setZoom(zoom) {
      pct.textContent = `${Math.round(zoom * 100)}%`;
    },
  };
}
