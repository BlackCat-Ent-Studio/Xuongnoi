import type { TargetList } from './types';

const HL_CLASS = 'tut-hl';

export interface Highlighter {
  /** Pulse the elements the targets resolve to; everything else is un-pulsed. */
  apply(targets: TargetList): void;
  clear(): void;
}

function query(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null; // malformed selector must never break the lesson
  }
}

function resolve(targets: TargetList): Element[] {
  const found: Element[] = [];
  for (const t of targets) {
    if (typeof t === 'string') {
      const el = query(t);
      if (el) found.push(el);
    } else {
      for (const s of t) {
        const el = query(s);
        if (el) {
          found.push(el);
          break;
        }
      }
    }
  }
  return found;
}

export function createHighlighter(): Highlighter {
  let current: Element[] = [];

  function clear(): void {
    for (const el of current) el.classList.remove(HL_CLASS);
    current = [];
  }

  return {
    apply(targets) {
      const next = resolve(targets);
      for (const el of current) if (!next.includes(el)) el.classList.remove(HL_CLASS);
      for (const el of next) {
        if (current.includes(el)) continue;
        el.classList.add(HL_CLASS);
        // Only the palette is a plain scroller; the canvas must never be scrolled programmatically.
        if (el.closest('.palette, .props')) el.scrollIntoView({ block: 'center' });
      }
      current = next;
    },
    clear,
  };
}
