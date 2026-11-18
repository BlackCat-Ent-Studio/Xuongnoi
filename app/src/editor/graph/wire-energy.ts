import type { PortType, PortValue, Wire } from '../../engine/types';

/**
 * "Current" on the wiring board. The first half is pure decision logic (value -> look, edge -> spark);
 * the second half owns the SVG/DOM bits and is driven once per frame by the canvas.
 */

// ---------- settings ----------

const STORAGE_KEY = 'xuongnoi.wireEnergy';

let enabled = readSetting();
const listeners = new Set<() => void>();

function readSetting(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export const isEnergyEnabled = (): boolean => enabled;

export function setEnergyEnabled(on: boolean): void {
  if (on === enabled) return;
  enabled = on;
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // Storage can be blocked (private mode); the choice then only lasts for this session.
  }
  for (const fn of listeners) fn();
}

export function onEnergySettingChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Sparks and flowing dots are motion; steady glow is allowed even when the user asks for less motion. */
export function motionAllowed(): boolean {
  try {
    return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch {
    return true;
  }
}

// ---------- pure logic ----------

export const MAX_SPARKS = 60;
/** A one-tick pulse stays lit this long so the eye can catch it. */
export const PULSE_HOLD_MS = 220;
const NUMBER_CHANGE_EPS = 0.02;
const NUMBER_SPARK_GAP_MS = 140;

export interface SparkSpec {
  radius: number;
  durMs: number;
}

export interface WireMemory {
  prev: PortValue | undefined;
  litUntil: number;
  lastSparkAt: number;
}

export const newWireMemory = (): WireMemory => ({ prev: undefined, litUntil: -Infinity, lastSparkAt: -Infinity });

/** Does the value on a wire carry something right now? */
export function isActive(type: PortType, value: PortValue | undefined): boolean {
  if (type === 'bool') return value === true;
  if (type === 'number') return typeof value === 'number' && value !== 0;
  return value !== null && value !== undefined;
}

export interface WireStep {
  /** Bright (with glow) when true, dimmed when false. */
  lit: boolean;
  spark: SparkSpec | null;
}

/**
 * Advance one wire by one frame. `risen` is true when the engine saw the value go false -> true since the
 * last frame, even if it fell back again within the same frame (a one-tick pulse).
 */
export function stepWire(mem: WireMemory, type: PortType, value: PortValue | undefined, risen: boolean, now: number): WireStep {
  const prev = mem.prev;
  mem.prev = value;
  let spark: SparkSpec | null = null;
  const active = isActive(type, value);
  if (type === 'bool') {
    if (risen || (prev !== undefined && prev !== true && value === true)) {
      spark = { radius: 5, durMs: 520 };
      mem.litUntil = now + PULSE_HOLD_MS;
    }
  } else if (type === 'number') {
    if (typeof value === 'number' && typeof prev === 'number' && Math.abs(value - prev) > NUMBER_CHANGE_EPS && now - mem.lastSparkAt >= NUMBER_SPARK_GAP_MS) {
      spark = { radius: 3, durMs: 900 };
    }
  }
  if (spark) mem.lastSparkAt = now;
  return { lit: active || now < mem.litUntil, spark };
}

export const canSpawnSpark = (activeCount: number, cap: number = MAX_SPARKS): boolean => activeCount < cap;

export interface SparkFrame {
  /** 0 at the output end, 1 at the input end. */
  t: number;
  opacity: number;
  done: boolean;
}

export function sparkFrame(ageMs: number, durMs: number): SparkFrame {
  const t = durMs <= 0 ? 1 : Math.min(1, Math.max(0, ageMs / durMs));
  return { t, opacity: t > 0.85 ? (1 - t) / 0.15 : 1, done: t >= 1 };
}

// ---------- DOM driver ----------

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Entry {
  wire: Wire;
  type: PortType;
  path: SVGPathElement;
  glow: SVGPathElement | null;
  /** Running dashes on a live wire (editor skin only). */
  flow: SVGPathElement | null;
  mem: WireMemory;
  /** Output/input port rows (or group stubs) the live flag goes on. */
  outEl: Element | null;
  inEl: Element | null;
  nodeEl: Element | null;
  key: string;
  len: number;
  lit: boolean;
  sparks: number;
}

interface Spark {
  el: SVGCircleElement;
  entry: Entry;
  age: number;
  dur: number;
}

export interface WireEnergy {
  /** Forget everything drawn so far; call before the wire layer is rebuilt. */
  reset(): void;
  /** Register a wire that was just appended to the layer; adds the edit-mode dots next to it. */
  addWire(wire: Wire, type: PortType, path: SVGPathElement, outDot: Element | undefined, inDot: Element | undefined, playing: boolean): void;
  /** One animation frame while playing. `dtMs` since the previous frame. */
  update(dtMs: number, now: number, readValue: (wire: Wire) => PortValue, takeRisen: () => ReadonlySet<string> | undefined): void;
  /** Remove every live look (leaving play, or the effect was switched off). */
  clear(): void;
}

const portOf = (dot: Element | undefined): Element | null => dot?.closest('.wc-port, .wc-stub') ?? null;

export interface WireEnergyOptions {
  /**
   * The editor's richer current: white dashes run along a live wire and number ports show their value in a pill while
   * playing. Off by default, so the puzzle board keeps drawing what it always drew.
   */
  rich?: boolean;
}

/** A number as it reads in a value pill: two decimals, one from 100 up. */
export function formatPill(v: number): string {
  return Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(2);
}

export function createWireEnergy(layer: SVGElement, options: WireEnergyOptions = {}): WireEnergy {
  const rich = options.rich === true;
  const pills = new Map<Element, HTMLElement>();
  /** Shows `text` in the value pill of a port row (made on first use); null removes it. */
  const setPill = (row: Element | null, text: string | null): void => {
    if (!row) return;
    let pill = pills.get(row);
    if (text === null) {
      pill?.remove();
      pills.delete(row);
      return;
    }
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'wc-port-val';
      row.append(pill);
      pills.set(row, pill);
    }
    if (pill.textContent !== text) pill.textContent = text;
  };
  let entries: Entry[] = [];
  let sparks: Spark[] = [];
  const pool: SVGCircleElement[] = [];
  let liveEls = new Set<Element>();
  let hotEls = new Set<Element>();

  const releaseSpark = (s: Spark): void => {
    s.el.remove();
    s.entry.sparks--;
    pool.push(s.el);
  };

  function spawn(entry: Entry, spec: SparkSpec): void {
    if (!canSpawnSpark(sparks.length) || !entry.path.isConnected) return;
    if (entry.len === 0) entry.len = entry.path.getTotalLength();
    if (entry.len <= 0) return;
    const el = pool.pop() ?? document.createElementNS(SVG_NS, 'circle');
    el.setAttribute('class', `wc-spark type-${entry.type}`);
    el.setAttribute('r', String(spec.radius));
    el.style.opacity = '0';
    layer.append(el);
    entry.sparks++;
    sparks.push({ el, entry, age: 0, dur: spec.durMs });
  }

  function setLit(entry: Entry, lit: boolean): void {
    entry.lit = lit;
    entry.path.classList.toggle('is-live', lit);
    entry.path.classList.toggle('is-dim', !lit);
    if (lit && !entry.glow) {
      const glow = document.createElementNS(SVG_NS, 'path');
      glow.setAttribute('class', `wc-wire-glow type-${entry.type}`);
      glow.setAttribute('d', entry.path.getAttribute('d') ?? '');
      entry.path.before(glow);
      entry.glow = glow;
    }
    entry.glow?.classList.toggle('is-live', lit);
    if (rich) {
      if (lit && !entry.flow) {
        const flow = document.createElementNS(SVG_NS, 'path');
        flow.setAttribute('class', `wc-wire-flow type-${entry.type}`);
        flow.setAttribute('d', entry.path.getAttribute('d') ?? '');
        entry.path.after(flow);
        entry.flow = flow;
      } else if (!lit && entry.flow) {
        entry.flow.remove();
        entry.flow = null;
      }
    }
  }

  function syncFlags(next: Set<Element>, prev: Set<Element>, apply: (el: Element, on: boolean) => void): void {
    for (const el of prev) if (!next.has(el)) apply(el, false);
    for (const el of next) if (!prev.has(el)) apply(el, true);
  }

  const setLive = (el: Element, on: boolean): void => {
    if (on) el.setAttribute('data-live', 'on');
    else el.removeAttribute('data-live');
  };
  const setHot = (el: Element, on: boolean): void => {
    el.classList.toggle('is-hot', on);
  };

  function clear(): void {
    for (const s of sparks) releaseSpark(s);
    sparks = [];
    for (const e of entries) {
      e.path.classList.remove('is-live', 'is-dim');
      e.glow?.classList.remove('is-live');
      e.flow?.remove();
      e.flow = null;
      e.mem = newWireMemory();
      e.lit = false;
    }
    for (const row of [...pills.keys()]) setPill(row, null);
    syncFlags(new Set(), liveEls, setLive);
    syncFlags(new Set(), hotEls, setHot);
    liveEls = new Set();
    hotEls = new Set();
  }

  return {
    reset() {
      // The layer is emptied by the caller; drop every handle to its old elements.
      sparks = [];
      entries = [];
      pool.length = 0;
      liveEls = new Set();
      hotEls = new Set();
      pills.clear();
    },
    addWire(wire, type, path, outDot, inDot, playing) {
      const outEl = portOf(outDot);
      entries.push({
        wire,
        type,
        path,
        glow: null,
        flow: null,
        mem: newWireMemory(),
        outEl,
        inEl: portOf(inDot),
        nodeEl: outEl?.closest('.wc-node') ?? null,
        key: `${wire.from.node}|${wire.from.port}`,
        len: 0,
        lit: false,
        sparks: 0,
      });
      if (playing) return;
      // Edit mode: faint dots drift from the output to the input. Pure CSS, no per-frame work.
      const flow = document.createElementNS(SVG_NS, 'path');
      flow.setAttribute('class', `wc-wire-flow type-${type}`);
      flow.setAttribute('d', path.getAttribute('d') ?? '');
      path.after(flow);
    },
    update(dtMs, now, readValue, takeRisen) {
      const risen = takeRisen();
      const nextLive = new Set<Element>();
      const nextHot = new Set<Element>();
      const motion = motionAllowed();
      for (const e of entries) {
        let value: PortValue | undefined;
        try {
          value = readValue(e.wire);
        } catch {
          value = undefined;
        }
        const step = stepWire(e.mem, e.type, value, risen?.has(e.key) === true && e.type === 'bool', now);
        if (step.lit !== e.lit || !e.path.classList.contains(step.lit ? 'is-live' : 'is-dim')) setLit(e, step.lit);
        if (step.lit) {
          if (e.outEl) nextLive.add(e.outEl);
          if (e.inEl) nextLive.add(e.inEl);
          if (e.nodeEl) nextHot.add(e.nodeEl);
        }
        if (step.spark && motion) spawn(e, step.spark);
        if (rich && e.type === 'number' && typeof value === 'number') {
          const text = formatPill(value);
          setPill(e.outEl, text);
          setPill(e.inEl, text);
        }
      }
      syncFlags(nextLive, liveEls, setLive);
      syncFlags(nextHot, hotEls, setHot);
      liveEls = nextLive;
      hotEls = nextHot;

      if (sparks.length === 0) return;
      const keep: Spark[] = [];
      for (const s of sparks) {
        s.age += dtMs;
        const f = sparkFrame(s.age, s.dur);
        if (f.done || !s.entry.path.isConnected) {
          releaseSpark(s);
          continue;
        }
        const p = s.entry.path.getPointAtLength(f.t * s.entry.len);
        s.el.setAttribute('cx', p.x.toFixed(1));
        s.el.setAttribute('cy', p.y.toFixed(1));
        s.el.style.opacity = String(f.opacity);
        keep.push(s);
      }
      sparks = keep;
    },
    clear,
  };
}
