import { h } from './dom';
import { icon, type IconName } from './icons';

/** Mount points that later features fill in. Each is an empty `div` inside its dock tab. */
export const DOCK_SCENE_ID = 'dock-scene';
export const DOCK_CONSOLE_ID = 'dock-console';
export const DOCK_LESSONS_ID = 'dock-lessons';

export interface DockTabSpec {
  id: string;
  label: string;
  icon?: IconName;
  panel: HTMLElement;
}

export interface Dock {
  el: HTMLElement;
  /** The tab strip; append extra controls (chips, tools) here. */
  bar: HTMLElement;
  select(id: string): void;
  selected(): string;
}

/** A tabbed dock: a tab strip plus one pane per tab. Only the selected pane is displayed. */
export function createDock(opts: {
  className: string;
  ariaLabel: string;
  tabs: DockTabSpec[];
  initial: string;
  /** Fires on every tab click, including a click on the already-selected tab. */
  onSelect?: (id: string) => void;
}): Dock {
  const { tabs, onSelect } = opts;
  const el = h('div', `dock ${opts.className}`);
  const bar = h('div', 'tabs');
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', opts.ariaLabel);
  const body = h('div', 'panes');
  const buttons = new Map<string, HTMLButtonElement>();
  const panes = new Map<string, HTMLElement>();
  let current = opts.initial;

  for (const spec of tabs) {
    const btn = h('button', 'tab');
    btn.type = 'button';
    btn.id = `tab-${spec.id}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-controls', `pane-${spec.id}`);
    if (spec.icon) btn.append(icon(spec.icon));
    btn.append(h('span', 'tab-label', spec.label));
    btn.title = spec.label;
    btn.addEventListener('click', () => {
      select(spec.id);
      onSelect?.(spec.id);
    });
    buttons.set(spec.id, btn);
    bar.append(btn);

    const pane = h('section', 'pane');
    pane.id = `pane-${spec.id}`;
    pane.setAttribute('role', 'tabpanel');
    pane.setAttribute('aria-labelledby', btn.id);
    pane.append(spec.panel);
    panes.set(spec.id, pane);
    body.append(pane);
  }

  bar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const ids = tabs.map((t) => t.id);
    const i = ids.findIndex((id) => buttons.get(id) === document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = ids[(i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length]!;
    buttons.get(next)?.focus();
    buttons.get(next)?.click();
  });

  function select(id: string): void {
    if (!panes.has(id)) return;
    current = id;
    for (const [tid, btn] of buttons) {
      const on = tid === id;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
      panes.get(tid)?.classList.toggle('on', on);
    }
  }
  select(opts.initial);

  el.append(bar, body);
  return { el, bar, select, selected: () => current };
}

/** An empty mount point. `placeholder` shows only while nothing has been mounted into it. */
export function createMount(id: string, placeholder: string): HTMLElement {
  const el = h('div', 'dock-mount');
  el.id = id;
  el.dataset.placeholder = placeholder;
  return el;
}
