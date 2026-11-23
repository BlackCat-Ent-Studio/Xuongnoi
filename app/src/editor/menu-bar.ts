import { h } from './dom';
import { icon } from './icons';

export type MenuEntry =
  | {
      type: 'item';
      label: string;
      /** Right-aligned note such as a shortcut. */
      hint?: string;
      /** When defined the item is a radio/check entry and shows a tick if true. */
      checked?: boolean;
      disabled?: boolean;
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

/** Keyboard-accessible menu bar: Enter/Space/ArrowDown open, arrows move, Escape closes. */
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

  function items(): HTMLButtonElement[] {
    return Array.from(popup.querySelectorAll<HTMLButtonElement>('.mb-item:not(:disabled)'));
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
    for (const entry of def.entries()) {
      if (entry.type === 'separator') {
        const sep = h('div', 'mb-sep');
        sep.setAttribute('role', 'separator');
        popup.append(sep);
      } else if (entry.type === 'heading') {
        const head = h('div', 'mb-head', entry.label);
        head.setAttribute('role', 'presentation');
        popup.append(head);
      } else {
        const item = h('button', 'mb-item');
        item.type = 'button';
        item.disabled = entry.disabled === true;
        const isToggle = entry.checked !== undefined;
        item.setAttribute('role', isToggle ? 'menuitemcheckbox' : 'menuitem');
        if (isToggle) item.setAttribute('aria-checked', String(entry.checked));
        const tick = h('span', 'mb-tick');
        if (entry.checked) tick.append(icon('check'));
        item.append(tick, h('span', 'mb-label', entry.label));
        if (entry.hint) item.append(h('span', 'mb-hint', entry.hint));
        item.addEventListener('click', () => {
          close(true);
          entry.onSelect();
        });
        popup.append(item);
      }
    }
    const r = btn.getBoundingClientRect();
    popup.style.left = `${Math.round(r.left)}px`;
    popup.style.top = `${Math.round(r.bottom + 4)}px`;
    popup.hidden = false;
    if (focusFirst) items()[0]?.focus();
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
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (openIndex + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      open(next, true);
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
