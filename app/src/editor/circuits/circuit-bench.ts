import { benchKey, benchPlan, type BenchInput, type BenchPlan } from '../../circuits/bench';
import type { Circuit, CircuitExposed, Graph, InputSnapshot, ParamValue, PortValue, Runtime } from '../../engine/types';
import { h } from '../dom';
import type { EditorState } from '../editor-state';
import { formatPill } from '../graph/wire-energy';
import { numberStepper } from '../properties-panel';
import type { Notify } from './circuit-actions';
import { cardLabel, exposedView, findCircuit, openCircuit } from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { circuitIcon, type CircuitGlyph } from './circuit-views';
import './circuit-bench.css';

/** The bench run that is going on: which circuit, how deep the canvas was when it started, and the graph that runs. */
export interface BenchRun {
  circuitId: string;
  /** Length of the circuit path the run was started at; deeper levels are copies inside the circuit on the bench. */
  base: number;
  plan: BenchPlan;
}

export interface CircuitBench {
  /** The strip under the circuit canvas; hidden while the bench is off. */
  strip: HTMLElement;
  /** Is the bench open (only ever inside a circuit)? */
  isOn(): boolean;
  setOn(on: boolean): void;
  /** The graph to preview and to play while the bench is open; null when it is not. Throws like `expandCircuitAlone`. */
  graph(): Graph | null;
  /** The bench run in progress, or null (not playing, or the whole board is playing). */
  run(): BenchRun | null;
  /** The keys the game reads this tick: the keyboard's, plus the made-up keys of the Đúng/Sai pins switched on by hand. */
  input(base: InputSnapshot): InputSnapshot;
  /** Called after the bench opened, closed or moved to another circuit. */
  onChange(fn: () => void): void;
}

export interface BenchDeps {
  state: EditorState;
  getRuntime(): Runtime | null;
  /** Changes a setting of a card in the running game; false when it only applies on the next run. */
  applyParams(nodeId: string, params: Record<string, unknown>): boolean;
  /** Starts the run again from the first tick. */
  restart(): void;
  notify: Notify;
}

const OUT_REFRESH_MS = 100;

function actButton(glyph: CircuitGlyph, label: string, className: string, tip: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', `ck-bench-btn${className}`);
  b.type = 'button';
  b.title = tip;
  b.append(circuitIcon(glyph), h('span', '', label));
  b.addEventListener('click', onClick);
  return b;
}

function formatValue(type: 'bool' | 'number' | 'object', v: PortValue): string {
  if (type === 'bool') return v === true ? T.benchOn : T.benchOff;
  if (type === 'number') return typeof v === 'number' ? formatPill(v) : formatPill(0);
  return typeof v === 'string' && v !== '' ? v : T.benchNothing;
}

function showParam(value: ParamValue, options?: { value: string; label: string }[]): string {
  if (typeof value === 'object') return `${value.x}, ${value.y}, ${value.z}`;
  if (typeof value === 'number') return String(value);
  return options?.find((o) => o.value === value)?.label ?? (value === '' ? T.benchIdle : value);
}

/**
 * "Chạy thử máy này": while the canvas is inside a circuit, the bench runs that circuit alone. Its 'in' pins are driven by
 * hand from the strip (a switch for Đúng/Sai, a stepper for Số), its 'out' pins are read live, and the settings it opens are
 * shown with the value the circuit itself holds. The values typed here live for the session only and are never saved.
 */
export function createCircuitBench({ state, getRuntime, applyParams, restart, notify }: BenchDeps): CircuitBench {
  const strip = h('section', 'ck-bench');
  strip.hidden = true;
  strip.setAttribute('aria-label', T.benchOpen);
  let on = false;
  let run: BenchRun | null = null;
  let shownFor: string | null = null;
  const listeners: (() => void)[] = [];
  /** Hand values, kept per circuit and pin for the session. */
  const numbers = new Map<string, Map<string, number>>();
  const switched = new Set<string>();
  const pressed = new Set<string>();
  let outCells: { el: HTMLElement; read: (rt: Runtime) => string; live: (rt: Runtime) => boolean }[] = [];
  let outTimer = 0;
  /** A setting was typed in the strip and its rows were left as they were until the box is left. */
  let stale = false;
  // The floating game window is told how tall the strip is, so it never sits on it.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => strip.closest<HTMLElement>('.dock')?.style.setProperty('--ck-bench-h', `${strip.offsetHeight}px`)).observe(strip);
  }

  const target = (): Circuit | undefined => {
    if (run) return findCircuit(state.getBoard(), run.circuitId);
    return on ? openCircuit(state.getBoard(), state.getCircuitPath()) : undefined;
  };
  const numbersOf = (circuitId: string): Map<string, number> => {
    let m = numbers.get(circuitId);
    if (!m) numbers.set(circuitId, (m = new Map()));
    return m;
  };
  const keyOf = (circuitId: string, pinId: string): string => `${circuitId}|${pinId}`;
  const planFor = (circuit: Circuit): BenchPlan => benchPlan(state.getBoard(), circuit.id, numbersOf(circuit.id));
  /** At the level the bench circuit itself is drawn (not inside one of its copies)? Only there do card ids mean the running cards. */
  const atBase = (): boolean => !run || state.getCircuitPath().length === run.base;

  function currentRun(): BenchRun | null {
    if (!state.isPlaying()) return (run = null);
    if (run) return run;
    const circuit = on ? openCircuit(state.getBoard(), state.getCircuitPath()) : undefined;
    if (!circuit) return null;
    run = { circuitId: circuit.id, base: state.getCircuitPath().length, plan: planFor(circuit) };
    return run;
  }

  // ---------- rows ----------

  function column(className: string, title: string, sub: string): { col: HTMLElement; list: HTMLElement } {
    const col = h('div', `ck-bench-col ${className}`);
    const head = h('div', 'ck-bench-colh');
    head.append(h('b', '', title), h('span', '', `· ${sub}`));
    const list = h('div', 'ck-bench-rows');
    col.append(head, list);
    return { col, list };
  }

  function rowOf(type: string, label: string, pinId: string): HTMLElement {
    const row = h('div', 'ck-bench-row');
    row.dataset.pin = pinId;
    row.append(h('i', `pn-shape ${type === 'none' ? 'ck-none' : `t-${type}`}`), h('span', 'ck-bench-name', label));
    return row;
  }

  function inputRow(circuit: Circuit, input: BenchInput): HTMLElement {
    const { pin, drive } = input;
    const row = rowOf(drive.by === 'nothing' && drive.why === 'unwired' ? 'none' : pin.type, pin.label, pin.id);
    if (drive.by === 'switch') {
      const key = keyOf(circuit.id, pin.id);
      const sw = h('button', 'pn-switch');
      sw.type = 'button';
      sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-label', T.benchSwitch(pin.label));
      const word = h('span', 'ck-bench-word');
      const paint = (): void => {
        const isOn = switched.has(key);
        sw.setAttribute('aria-checked', String(isOn));
        word.textContent = isOn ? T.benchOn : T.benchOff;
      };
      sw.addEventListener('click', () => {
        if (switched.has(key)) switched.delete(key);
        else switched.add(key);
        paint();
      });
      paint();
      const press = h('button', 'ck-bench-press', T.benchPress);
      press.type = 'button';
      press.title = T.benchPressTip(pin.label);
      const hold = (down: boolean): void => {
        if (down) pressed.add(key);
        else pressed.delete(key);
        press.classList.toggle('down', down);
      };
      press.addEventListener('pointerdown', (e) => {
        press.setPointerCapture(e.pointerId);
        hold(true);
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'] as const) press.addEventListener(ev, () => hold(false));
      press.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') hold(true);
      });
      press.addEventListener('keyup', () => hold(false));
      row.append(sw, word, press);
    } else if (drive.by === 'number') {
      const values = numbersOf(circuit.id);
      const stepper = numberStepper({ id: pin.id, label: pin.label, kind: 'number', default: drive.value, step: 1 }, values.get(pin.id) ?? drive.value, (v) => {
        values.set(pin.id, v);
        if (run) applyParams(drive.node, { value: v });
      });
      stepper.input.step = 'any';
      stepper.el.classList.add('ck-bench-num');
      stepper.input.addEventListener('keydown', (e) => e.stopPropagation());
      row.append(stepper.el);
    } else if (drive.by === 'card') {
      const board = state.getBoard();
      const card = circuit.graph.nodes.find((n) => n.id === drive.from.node);
      row.append(h('span', 'ck-bench-say', T.benchByCard(card ? cardLabel(board, card) : drive.from.node)));
    } else {
      const say = h('span', 'ck-bench-say warn', drive.why === 'unwired' ? T.benchUnwired : T.benchObject);
      if (drive.why === 'object') say.title = T.benchObjectTip;
      row.append(say);
      if (drive.why === 'object') row.title = T.benchObjectTip;
    }
    return row;
  }

  function exposedRow(circuit: Circuit, e: CircuitExposed): HTMLElement | null {
    const board = state.getBoard();
    const view = exposedView(board, circuit, e);
    if (!view) return null;
    const row = h('div', 'ck-bench-row');
    row.dataset.exposed = e.id;
    row.append(h('i', 'pn-shape ck-param'), h('span', 'ck-bench-name', e.label));
    const playing = state.isPlaying();
    const here = atBase();
    const value = view.def.default;
    if (view.def.kind === 'number' && typeof value === 'number') {
      const stepper = numberStepper({ ...view.def, label: e.label }, value, (v) => {
        state.setParam(e.inner.node, e.inner.param, v);
        if (state.isPlaying() && !applyParams(e.inner.node, { [e.inner.param]: v })) notify(T.benchNextRun);
      });
      stepper.el.classList.add('ck-bench-num');
      stepper.input.addEventListener('keydown', (ev) => ev.stopPropagation());
      const locked = !here || (state.isReadOnly() && !playing);
      for (const c of stepper.el.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input,button')) c.disabled = locked;
      if (!here) stepper.el.title = T.benchDeeper;
      else if (locked) stepper.el.title = T.lockedNote;
      row.append(stepper.el);
      return row;
    }
    const text = h('span', 'ck-bench-val', showParam(value, view.def.options));
    if (view.def.kind === 'color' && typeof value === 'string') {
      const dot = h('i', 'ck-bench-swatch');
      dot.style.background = value;
      text.prepend(dot);
    }
    row.append(text);
    if (here) {
      const edit = h('button', 'ck-bench-press', T.benchEdit);
      edit.type = 'button';
      edit.title = T.benchEditTip(view.nodeLabel);
      edit.addEventListener('click', () => state.select({ kind: 'node', id: e.inner.node }));
      row.append(edit);
    }
    return row;
  }

  function outputRow(pin: BenchPlan['outputs'][number]): HTMLElement {
    const row = rowOf(pin.port ? pin.pin.type : 'none', pin.pin.label, pin.pin.id);
    const port = pin.port;
    if (!port) {
      row.append(h('span', 'ck-bench-say warn', T.benchUnwired));
      return row;
    }
    const cell = h('span', `ck-bench-out type-${pin.pin.type}`, T.benchIdle);
    cell.title = T.benchIdleTip;
    const type = pin.pin.type;
    outCells.push({
      el: cell,
      read: (rt) => formatValue(type, rt.getOutput(port.node, port.port)),
      live: (rt) => {
        const v = rt.getOutput(port.node, port.port);
        return type === 'bool' ? v === true : type === 'number' ? typeof v === 'number' && v !== 0 : typeof v === 'string' && v !== '';
      },
    });
    row.append(cell);
    return row;
  }

  function refreshOutputs(): void {
    const rt = run ? getRuntime() : null;
    for (const cell of outCells) {
      let text: string = T.benchIdle;
      let lit = false;
      if (rt) {
        try {
          text = cell.read(rt);
          lit = cell.live(rt);
        } catch {
          text = T.benchIdle;
        }
      }
      if (cell.el.textContent !== text) cell.el.textContent = text;
      cell.el.classList.toggle('on', lit);
      cell.el.title = rt ? '' : T.benchIdleTip;
    }
  }

  // ---------- the strip ----------

  function render(): void {
    stale = false;
    // The buttons are drawn afresh, so none of them is held down any more.
    pressed.clear();
    currentRun();
    const circuit = target();
    strip.hidden = !circuit;
    const dock = strip.closest('.dock');
    dock?.classList.toggle('ck-benching', !!circuit);
    outCells = [];
    if (!circuit) {
      strip.replaceChildren();
      return;
    }
    const playing = state.isPlaying();
    const head = h('header', 'ck-bench-head');
    const title = h('div', 'ck-bench-title');
    title.append(circuitIcon('bench'), h('b', '', T.benchTitle(circuit.name)), h('span', '', T.benchHint));
    const acts = h('div', 'ck-bench-acts');
    const go = playing
      ? actButton('stop', T.benchStop, ' stop', T.benchStop, () => state.setPlaying(false))
      : actButton('play', T.benchRun, ' go', T.benchRunTip, () => state.setPlaying(true));
    go.dataset.act = 'run';
    const reset = actButton('reset', T.benchReset, '', T.benchResetTip, () => {
      numbers.delete(circuit.id);
      for (const set of [switched, pressed]) for (const k of [...set]) if (k.startsWith(`${circuit.id}|`)) set.delete(k);
      // Running: the run starts again and reads the inputs afresh; the rows are drawn from that new start.
      if (state.isPlaying()) restart();
      render();
    });
    reset.dataset.act = 'reset';
    const exit = actButton('close', T.benchExit, '', playing ? T.benchExitLocked : T.benchExit, () => setOn(false));
    exit.dataset.act = 'exit';
    exit.disabled = playing;
    acts.append(go, reset, exit);
    head.append(title, acts);

    let plan: BenchPlan | null = null;
    try {
      plan = run?.plan ?? planFor(circuit);
    } catch {
      plan = null;
    }
    if (!plan) {
      go.disabled = !playing;
      strip.replaceChildren(head, h('p', 'ck-bench-broken', T.benchBroken));
      return;
    }
    const ins = column('in', T.benchIn, T.benchInSub);
    for (const input of plan.inputs) ins.list.append(inputRow(circuit, input));
    if (plan.inputs.length === 0) ins.list.append(h('p', 'ck-bench-empty', T.benchNoIn));
    const params = column('param', T.benchParams, T.benchParamsSub);
    for (const e of circuit.exposed) {
      const row = exposedRow(circuit, e);
      if (row) params.list.append(row);
    }
    if (params.list.childElementCount === 0) params.list.append(h('p', 'ck-bench-empty', T.benchNoParams));
    const outs = column('out', T.benchOut, T.benchOutSub);
    for (const out of plan.outputs) outs.list.append(outputRow(out));
    if (plan.outputs.length === 0) outs.list.append(h('p', 'ck-bench-empty', T.benchNoOut));
    const cols = h('div', 'ck-bench-cols');
    cols.append(ins.col, params.col, outs.col);
    strip.replaceChildren(head, cols);
    refreshOutputs();
  }

  function setOn(next: boolean): void {
    const want = next && state.getCircuitPath().length > 0;
    if (want === on || state.isPlaying()) return;
    on = want;
    changed();
  }

  function changed(): void {
    shownFor = target()?.id ?? null;
    render();
    for (const fn of listeners) fn();
  }

  state.subscribe((kind) => {
    if (kind === 'board') {
      on = false;
      run = null;
      numbers.clear();
      switched.clear();
      pressed.clear();
      changed();
      return;
    }
    if (kind === 'playing') {
      window.clearInterval(outTimer);
      currentRun();
      if (run) {
        outTimer = window.setInterval(refreshOutputs, OUT_REFRESH_MS);
        notify(T.benchStarted(findCircuit(state.getBoard(), run.circuitId)?.name ?? ''));
      }
      render();
      return;
    }
    if (kind === 'scope') {
      const depth = state.getCircuitPath().length;
      // Leaving the circuit that is on the bench ends its run; back on the main board the bench closes.
      if (run && depth < run.base) state.setPlaying(false);
      if (on && depth === 0) on = false;
      if ((target()?.id ?? null) !== shownFor) changed();
      else render();
      return;
    }
    if (!on && !run) return;
    // A setting typed into the strip redraws nothing under the cursor; the rows catch up when the box is left.
    if (kind === 'params' && strip.contains(document.activeElement) && document.activeElement instanceof HTMLInputElement) {
      stale = true;
      return;
    }
    if (kind === 'graph' || kind === 'params' || kind === 'history') render();
  });
  strip.addEventListener('focusout', (e) => {
    if (!stale || (e.relatedTarget instanceof Node && strip.contains(e.relatedTarget))) return;
    render();
  });

  return {
    strip,
    isOn: () => on && state.getCircuitPath().length > 0,
    setOn,
    graph() {
      const live = currentRun();
      if (live) {
        // Every (re)start reads the numbers typed so far; the cards and their ids stay the same for the whole run.
        const circuit = findCircuit(state.getBoard(), live.circuitId);
        if (circuit) live.plan = planFor(circuit);
        return live.plan.graph;
      }
      const circuit = on ? openCircuit(state.getBoard(), state.getCircuitPath()) : undefined;
      return circuit ? planFor(circuit).graph : null;
    },
    run: currentRun,
    input(base) {
      if (!run) return base;
      const down = new Set(base.keysDown);
      const prefix = `${run.circuitId}|`;
      for (const set of [switched, pressed]) for (const k of set) if (k.startsWith(prefix)) down.add(benchKey(k.slice(prefix.length)));
      return { ...base, keysDown: down };
    },
    onChange(fn) {
      listeners.push(fn);
    },
  };
}
