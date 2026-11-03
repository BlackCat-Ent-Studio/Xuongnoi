import { h } from '../editor/dom';
import { cardHelpSummary, CARD_HELP_HEADINGS } from './card-help-summary';
import { createHandbookHelpButton, requestHandbook } from './handbook-request';
import { HANDBOOK_TEXT as T } from './handbook-text-vi';
import './card-help.css';

let closeOpen: (() => void) | null = null;

/** Ports the card on screen really shows, read from its rows (the puzzle hides some on locked cards). */
function shownPorts(button: HTMLElement): Set<string> | undefined {
  const rows = button.closest('.wc-node')?.querySelectorAll<HTMLElement>('.wc-port');
  if (!rows || rows.length === 0) return undefined;
  return new Set(Array.from(rows, (r) => `${r.dataset.dir}|${r.dataset.port}`));
}

/** Short "what does this piece do" popup, centred over everything; false when the kind is unknown. */
export function openCardHelp(kind: string, from?: HTMLElement): boolean {
  const s = cardHelpSummary(kind, from ? shownPorts(from) : undefined);
  if (!s) return false;
  closeOpen?.();

  const overlay = h('div', 'ch-overlay');
  const box = h('div', 'ch-box');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', s.title);
  const head = h('div', 'ch-head');
  const name = h('h3', 'ch-title', s.title);
  if (s.titleEn) name.append(h('small', 'ch-en', s.titleEn));
  head.append(name);
  const body = h('div', 'ch-body');
  body.append(h('p', 'ch-purpose', s.purpose));
  for (const dir of ['in', 'out'] as const) {
    const lines = s.ports.filter((p) => p.dir === dir);
    if (lines.length === 0) continue;
    const ul = h('ul', 'ch-ports');
    for (const p of lines) {
      const li = h('li', '');
      const nm = h('b', '', p.label);
      if (p.labelEn) nm.title = p.labelEn;
      li.append(nm, document.createTextNode(p.text ? ` — ${p.text}` : ''));
      ul.append(li);
    }
    body.append(h('h4', 'ch-sub', dir === 'in' ? CARD_HELP_HEADINGS.inputs : CARD_HELP_HEADINGS.outputs), ul);
  }
  if (s.example) body.append(h('h4', 'ch-sub', CARD_HELP_HEADINGS.example), h('p', 'ch-example', s.example));

  const full = h('button', 'ch-full', T.cardHelpFull);
  full.type = 'button';
  const close = h('button', 'ch-close', T.cardHelpClose);
  close.type = 'button';
  const bar = h('div', 'ch-actions');
  bar.append(full, close);
  box.append(head, body, bar);
  overlay.append(box);

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    e.stopImmediatePropagation();
    e.preventDefault();
    dismiss();
  };
  function dismiss(): void {
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
    if (closeOpen === dismiss) closeOpen = null;
    if (from?.isConnected) from.focus({ preventScroll: true });
  }
  closeOpen = dismiss;
  // The overlay swallows every pointer event so nothing under it (cards, wires, the guide) reacts.
  overlay.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (e.target === overlay) dismiss();
  });
  overlay.addEventListener('click', (e) => e.stopPropagation());
  close.addEventListener('click', dismiss);
  full.addEventListener('click', () => {
    dismiss();
    requestHandbook(kind);
  });
  window.addEventListener('keydown', onKey, true);
  document.body.append(overlay);
  full.focus({ preventScroll: true });
  return true;
}

/** The small "?" for a card header or tray chip: opens the short popup. Never touches hints or stars. */
export function createCardHelpButton(kind: string, label: string): HTMLElement {
  return createHandbookHelpButton(kind, label, {
    className: 'hb-card-help',
    tip: T.cardHelpTip,
    aria: T.cardHelpAria,
    onOpen: (b) => {
      openCardHelp(kind, b);
    },
  });
}
