import { HANDBOOK_TEXT } from './handbook-text-vi';

/** Lets any panel ask the shell to open the handbook at a node, without wiring a callback through every layer. */
export const HANDBOOK_OPEN_EVENT = 'handbook:open';

export function requestHandbook(kind: string): void {
  document.dispatchEvent(new CustomEvent<string>(HANDBOOK_OPEN_EVENT, { detail: kind }));
}

/** Small round "?" that opens the handbook at `kind`. Safe inside draggable items: it swallows the pointer and key events. */
export function createHandbookHelpButton(kind: string, label: string): HTMLElement {
  const b = document.createElement('span');
  b.className = 'hb-help';
  b.textContent = '?';
  b.title = HANDBOOK_TEXT.helpTip;
  b.tabIndex = 0;
  b.setAttribute('role', 'button');
  b.setAttribute('aria-label', HANDBOOK_TEXT.helpAria(label));
  b.dataset.hbHelp = kind;
  const open = (e: Event): void => {
    e.stopPropagation();
    e.preventDefault();
    requestHandbook(kind);
  };
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', open);
  b.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' || e.key === ' ') open(e);
  });
  b.addEventListener('keyup', (e) => e.stopPropagation());
  return b;
}
