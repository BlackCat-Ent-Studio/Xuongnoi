import { HANDBOOK_TEXT } from './handbook-text-vi';

/** Lets any panel ask the shell to open the handbook at a node, without wiring a callback through every layer. */
export const HANDBOOK_OPEN_EVENT = 'handbook:open';

export function requestHandbook(kind: string): void {
  document.dispatchEvent(new CustomEvent<string>(HANDBOOK_OPEN_EVENT, { detail: kind }));
}

export interface HelpButtonOptions {
  /** Extra class for a different look. */
  className?: string;
  tip?: string;
  aria?: (label: string) => string;
  /** Replaces the default "open the handbook" action. */
  onOpen?: (button: HTMLElement) => void;
}

/** Small round "?" that opens the handbook at `kind`. Safe inside draggable items: it swallows the pointer and key events. */
export function createHandbookHelpButton(kind: string, label: string, opts: HelpButtonOptions = {}): HTMLElement {
  const b = document.createElement('span');
  b.className = opts.className ? `hb-help ${opts.className}` : 'hb-help';
  b.textContent = '?';
  b.title = opts.tip ?? HANDBOOK_TEXT.helpTip;
  b.tabIndex = 0;
  b.setAttribute('role', 'button');
  b.setAttribute('aria-label', (opts.aria ?? HANDBOOK_TEXT.helpAria)(label));
  b.dataset.hbHelp = kind;
  const open = (e: Event): void => {
    e.stopPropagation();
    e.preventDefault();
    if (opts.onOpen) opts.onOpen(b);
    else requestHandbook(kind);
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
