/** One wire as the board draws it. */
export interface StepWire {
  id: string;
  from: string;
  fromPort: string;
  to: string;
}

export interface StepLight {
  /** Cards that stay bright: the fired ones, who they work with, what they act on. */
  cards: Set<string>;
  wires: Set<string>;
  /** Fired output pins as `${node}|${port}` (the dot that glows). */
  pins: ReadonlySet<string>;
  /** Characters / objects involved: they glow on the stage. */
  objects: Set<string>;
}

/**
 * What lights up at a paused step. `fired` = output pins (`node|port`) that just rose.
 * - the fired cards and the wires leaving the fired pins, with the cards those reach (the "what");
 * - any other wire from a fired card straight to a character / object card (an action such as "Đi ngang" to the bot);
 * - object cards wired into a fired card, with those wires (the "who").
 */
export function stepLight(fired: ReadonlySet<string>, wires: readonly StepWire[], isObject: (nodeId: string) => boolean): StepLight {
  const firedCards = new Set([...fired].map((k) => k.slice(0, k.indexOf('|'))));
  const out: StepLight = { cards: new Set(firedCards), wires: new Set(), pins: fired, objects: new Set() };
  const add = (wireId: string, card: string): void => {
    out.wires.add(wireId);
    out.cards.add(card);
    if (isObject(card)) out.objects.add(card);
  };
  for (const w of wires) {
    if (fired.has(`${w.from}|${w.fromPort}`)) add(w.id, w.to);
    else if (firedCards.has(w.from) && isObject(w.to)) add(w.id, w.to);
    if (firedCards.has(w.to) && isObject(w.from)) add(w.id, w.from);
  }
  for (const c of firedCards) if (isObject(c)) out.objects.add(c);
  return out;
}

export interface FrameView {
  k: number;
  x: number;
  y: number;
}
interface FrameBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The view that brings the lit cards (`box`, screen px) fully into `area`: panned the least when they fit, else zoomed out
 * about the box's top-left (never below `minK`) and then panned. A view that already shows them is returned as it is.
 */
export function frameLit(view: FrameView, box: FrameBox, area: { w: number; h: number }, margin: number, minK: number): FrameView {
  const fits = (b: FrameBox): boolean => b.x >= margin && b.y >= margin && b.x + b.w <= area.w - margin && b.y + b.h <= area.h - margin;
  if (fits(box)) return view;
  const room = { w: area.w - 2 * margin, h: area.h - 2 * margin };
  const want = Math.min(1, room.w / box.w, room.h / box.h);
  const k = Math.max(minK, view.k * want);
  const s = k / view.k;
  const next: FrameView = { k, x: box.x + (view.x - box.x) * s, y: box.y + (view.y - box.y) * s };
  const b: FrameBox = { x: box.x, y: box.y, w: box.w * s, h: box.h * s };
  const shift = (lo: number, size: number, avail: number): number => (lo < margin ? margin - lo : lo + size > avail - margin ? avail - margin - (lo + size) : 0);
  return { k, x: next.x + shift(b.x, b.w, area.w), y: next.y + shift(b.y, b.h, area.h) };
}
