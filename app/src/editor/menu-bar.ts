import { h } from './dom';
import { icon, type IconName } from './icons';
import './menu/menu.css';

export type MenuEntry =
  | {
      type: 'item';
      label: string;
      /** Leading icon; a tick replaces it when `checked` is true. */
      icon?: IconName;
      /** Right-aligned shortcut chip. */
      hint?: string;
      /** When defined the item is a radio/check entry and shows a tick if true. */
      checked?: boolean;
      disabled?: boolean;
      /** Items of a flyout opened with hover or the Right arrow; `onSelect` is then ignored. */
      submenu?: MenuEntry[];
      onSelect(): void;
    }
  | { type: 'heading'; label: string }
  | { type: 'separator' };

export interface MenuDef {
  id: string;
  label: string;
  /** Called every time the menu opens, so labels and enabled states are always fresh. */
  entries(): MenuEntry[];
}

export interface MenuBar {
  el: HTMLElement;
  close(): void;
}

const ITEM_SELECTOR = ':scope > .mb-item:not(:disabled), :scope > .mb-sub-wrap > .mb-item:not(:disabled)';

/** Keyboard-accessible menu bar: Enter/Space/ArrowDown open, arrows move, Right opens a flyout, Escape closes. */
export function createMenuBar(defs: MenuDef[], ariaLabel: string): MenuBar {
  const el = h('nav', 'menubar');
  el.setAttribute('aria-label', ariaLabel);
  const popup = h('div', 'mb-menu');
  popup.setAttribute('role', 'menu');
  popup.hidden = true;

  const buttons = defs.map((def) => {
    const b = h('button', 'mb-btn', def.label);
    b.type = 'button';
    b.dataset.menu = def.id;
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    return b;
  });
  el.append(...buttons, popup);

  let openIndex = -1;

  function itemsOf(level: HTMLElement): HTMLButtonElement[] {
    return Array.from(level.querySelectorAll<HTMLButtonElement>(ITEM_SELECTOR));
  }

  function closeFlyouts(level: HTMLElement, except?: HTMLElement): void {
    for (const sub of level.querySelectorAll<HTMLElement>(':scope > .mb-sub-wrap > .mb-sub')) {
      if (sub === except) continue;
      sub.hidden = true;
      sub.parentElement?.querySelector('.mb-item')?.setAttribute('aria-expanded', 'false');
    }
  }

  function placeFlyout(trigger: HTMLElement, sub: HTMLElement): void {
    const r = trigger.getBoundingClientRect();
    sub.hidden = false;
    const w = sub.offsetWidth;
    const hgt = sub.offsetHeight;
    const flip = r.right + w + 4 > window.innerWidth && r.left - w - 4 >= 0;
    sub.style.left = `${Math.round(flip ? r.left - w - 4 : r.right + 4)}px`;
    sub.style.top = `${Math.round(Math.max(4, Math.min(r.top - 5, window.innerHeight - hgt - 4)))}px`;
  }

  function openFlyout(trigger: HTMLButtonElement, focusFirst: boolean): void {
    const wrap = trigger.parentElement as HTMLElement;
    const sub = wrap.querySelector<HTMLElement>(':scope > .mb-sub');
    if (!sub) return;
    closeFlyouts(wrap.parentElement as HTMLElement, sub);
    placeFlyout(trigger, sub);
    trigger.setAttribute('aria-expanded', 'true');
    if (focusFirst) itemsOf(sub)[0]?.focus();
  }

  function render(container: HTMLElement, entries: MenuEntry[]): void {
    for (const entry of entries) {
      if (entry.type === 'separator') {
        const sep = h('div', 'mb-sep');
        sep.setAttribute('role', 'separator');
        container.append(sep);
        continue;
      }
      if (entry.type === 'heading') {
        const head = h('div', 'mb-head', entry.label);
        head.setAttribute('role', 'presentation');
        container.append(head);
        continue;
      }
      const item = h('button', 'mb-item');
      item.type = 'button';
      item.disabled = entry.disabled === true;
      const isToggle = entry.checked !== undefined;
      item.setAttribute('role', isToggle ? 'menuitemcheckbox' : 'menuitem');
      if (isToggle) item.setAttribute('aria-checked', String(entry.checked));
      const lead = h('span', 'mb-ic');
      if (entry.checked) {
        lead.classList.add('on');
        lead.append(icon('check'));
      } else if (entry.icon) {
        lead.append(icon(entry.icon));
      }
      item.append(lead, h('span', 'mb-label', entry.label));
      if (entry.hint) item.append(h('kbd', 'mb-hint', entry.hint));

      if (entry.submenu) {
        const wrap = h('div', 'mb-sub-wrap');
        const sub = h('div', 'mb-menu mb-sub');
        sub.setAttribute('role', 'menu');
        sub.hidden = true;
        render(sub, entry.submenu);
        item.setAttribute('aria-haspopup', 'menu');
        item.setAttribute('aria-expanded', 'false');
        item.append(h('span', 'mb-chev'));
        (item.lastElementChild as HTMLElement).append(icon('chev'));
        item.addEventListener('click', () => openFlyout(item, false));
        item.addEventListener('pointerenter', () => {
          if (!item.disabled) openFlyout(item, false);
        });
        wrap.append(item, sub);
        container.append(wrap);
      } else {
        item.addEventListener('click', () => {
          close(true);
          entry.onSelect();
        });
        item.addEventListener('pointerenter', () => closeFlyouts(container));
        container.append(item);
      }
    }
  }

  function close(returnFocus = false): void {
    if (openIndex < 0) return;
    const btn = buttons[openIndex]!;
    btn.setAttribute('aria-expanded', 'false');
    popup.hidden = true;
    popup.replaceChildren();
    openIndex = -1;
    if (returnFocus) btn.focus();
  }

  function open(index: number, focusFirst: boolean): void {
    const def = defs[index]!;
    close();
    openIndex = index;
    const btn = buttons[index]!;
    btn.setAttribute('aria-expanded', 'true');
    popup.replaceChildren();
    render(popup, def.entries());
    const r = btn.getBoundingClientRect();
    popup.style.left = `${Math.round(r.left)}px`;
    popup.style.top = `${Math.round(r.bottom + 6)}px`;
    popup.hidden = false;
    if (focusFirst) itemsOf(popup)[0]?.focus();
  }

  buttons.forEach((btn, i) => {
    btn.addEventListener('click', () => (openIndex === i ? close() : open(i, false)));
    btn.addEventListener('pointerenter', () => {
      if (openIndex >= 0 && openIndex !== i) open(i, false);
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(i, true);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]!.focus();
        if (openIndex >= 0) open(next, false);
      } else if (e.key === 'Escape') {
        close();
      }
    });
  });

  popup.addEventListener('keydown', (e) => {
    const active = document.activeElement as HTMLButtonElement | null;
    const level = (active?.closest('.mb-menu') as HTMLElement | null) ?? popup;
    const list = itemsOf(level);
    const i = active ? list.indexOf(active) : -1;
    const hasFlyout = active?.getAttribute('aria-haspopup') === 'menu';
    const step = (to: number): void => {
      e.preventDefault();
      list[(to + list.length) % list.length]?.focus();
    };
    if (e.key === 'ArrowDown') step(i + 1);
    else if (e.key === 'ArrowUp') step(i < 0 ? -1 : i - 1);
    else if (e.key === 'Home') step(0);
    else if (e.key === 'End') step(-1);
    else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (hasFlyout && active) openFlyout(active, true);
      else open((openIndex + 1) % buttons.length, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      e.preventDefault();
      if (level !== popup) {
        const trigger = level.parentElement?.querySelector<HTMLButtonElement>(':scope > .mb-item');
        closeFlyouts(level.parentElement?.parentElement as HTMLElement);
        trigger?.focus();
      } else if (e.key === 'Escape') {
        close(true);
      } else {
        open((openIndex - 1 + buttons.length) % buttons.length, true);
      }
    } else if (e.key === 'Tab') {
      close();
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (openIndex >= 0 && e.target instanceof Node && !el.contains(e.target)) close();
  });
  window.addEventListener('blur', () => close());

  return { el, close: () => close() };
}
