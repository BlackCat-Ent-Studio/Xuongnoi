import { activeInputs, activeOutputs, getNodeDef, knownInputs, knownOutputs } from '../engine/registry';
import type { GraphNode, ParamDef, ParamValue, Params, PortDef, Vec3 } from '../engine/types';
import { NODE_CATEGORY_LABELS } from '../nodes';
import { createHandbookHelpButton } from '../handbook/handbook-request';
import { SOLID_BODIES_TOPIC } from '../handbook/topic-solid-bodies';
import { h } from './dom';
import { renderGroupInspector, renderMultiSelect } from './groups/group-inspector';
import { createLookPicker, type LookPicker } from './look-picker';
import type { EditorState } from './editor-state';
import { categoryTile, panelIcon } from './panels/panel-icons';
import { PANELS_TEXT_VI as P } from './panels/panels-text-vi';
import './panels/panels.css';
import { PORT_TYPE_LABELS, TEXT_VI, keyLabel } from './text-vi';

export interface PropertiesPanelOptions {
  /**
   * Called instead of a graph edit while a game is running (the editor state refuses edits then).
   * Only number, vec3, colour and look params reach it. `params` is the node's full param set with the change applied.
   */
  onLiveParamChange?: (nodeId: string, params: Params) => void;
}

/** Two-option selects that read as an on/off switch, mapped to their "on" value. */
/** Whether the "Nâng cao" fold is open; kept across re-renders and selections. */
let advancedOpen = false;
const SWITCH_ON_VALUES: Readonly<Record<string, string>> = { 'yes,no': 'yes', 'no,yes': 'yes', 'on,off': 'on', 'off,on': 'on' };

function switchOnValue(def: ParamDef): { on: string; off: string } | null {
  const opts = def.options ?? [];
  if (def.kind !== 'select' || opts.length !== 2) return null;
  const on = SWITCH_ON_VALUES[opts.map((o) => o.value).join(',')];
  const off = opts.find((o) => o.value !== on)?.value;
  return on !== undefined && off !== undefined ? { on, off } : null;
}

function clampNum(v: number, def: ParamDef): number {
  let r = v;
  if (def.min !== undefined) r = Math.max(def.min, r);
  if (def.max !== undefined) r = Math.min(def.max, r);
  return r;
}

function decimalsOf(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

/** Stepper: minus button, number input, plus button. Returns the wrapper and the input. */
function numberStepper(
  def: ParamDef,
  value: number,
  onValue: (v: number) => void,
): { el: HTMLElement; input: HTMLInputElement } {
  const step = def.step ?? 1;
  const wrap = h('span', 'pn-num');
  const input = h('input', 'prop-input pn-num-input');
  input.type = 'number';
  input.value = String(value);
  if (def.min !== undefined) input.min = String(def.min);
  if (def.max !== undefined) input.max = String(def.max);
  input.step = String(step);
  input.setAttribute('aria-label', def.label);

  const nudge = (dir: 1 | -1): void => {
    const cur = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : value;
    const next = clampNum(Number((cur + dir * step).toFixed(Math.max(decimalsOf(step), 2))), def);
    input.value = String(next);
    onValue(next);
  };
  const mk = (dir: 1 | -1): HTMLButtonElement => {
    const b = h('button', 'pn-num-btn');
    b.type = 'button';
    b.setAttribute('aria-label', dir < 0 ? P.stepDown(def.label) : P.stepUp(def.label));
    b.append(panelIcon(dir < 0 ? 'minus' : 'plus'));
    b.addEventListener('click', () => nudge(dir));
    return b;
  };
  input.addEventListener('input', () => {
    const v = input.valueAsNumber;
    if (Number.isFinite(v)) onValue(clampNum(v, def));
  });
  input.addEventListener('change', () => {
    const v = input.valueAsNumber;
    input.value = String(Number.isFinite(v) ? clampNum(v, def) : value);
  });
  wrap.append(mk(-1), input, mk(1));
  return { el: wrap, input };
}

export function createPropertiesPanel(state: EditorState, options: PropertiesPanelOptions = {}): HTMLElement {
  const el = h('section', 'props pn-props');
  let stopKeyCapture: (() => void) | null = null;
  let lookPicker: LookPicker | null = null;

  /** Normal edit when stopped; live callback (plus the state call, which refuses edits) while playing. */
  function commitParam(node: GraphNode, id: string, value: ParamValue): void {
    state.setParam(node.id, id, value);
    if (!state.isPlaying()) return;
    const current = state.getGraph().nodes.find((n) => n.id === node.id)?.params ?? node.params;
    options.onLiveParamChange?.(node.id, { ...current, [id]: value });
  }

  function vec3Editor(def: ParamDef, node: GraphNode, value: Vec3): HTMLElement {
    const row = h('div', 'prop-vec3 pn-vec3');
    let current = { ...value };
    for (const axis of ['x', 'y', 'z'] as const) {
      const cell = h('div', 'prop-axis pn-axis');
      cell.append(h('span', '', axis.toUpperCase()));
      const axisDef = { ...def, step: def.step ?? 0.5, label: `${def.label} ${axis.toUpperCase()}` };
      cell.append(
        numberStepper(axisDef, current[axis], (v) => {
          current = { ...current, [axis]: v };
          commitParam(node, def.id, current);
        }).el,
      );
      row.append(cell);
    }
    return row;
  }

  function keyEditor(def: ParamDef, node: GraphNode, code: string): HTMLElement {
    const btn = h('button', 'prop-key', keyLabel(code));
    btn.type = 'button';
    btn.addEventListener('click', () => {
      stopKeyCapture?.();
      btn.textContent = TEXT_VI.pressKey;
      btn.classList.add('capturing');
      const onKey = (e: KeyboardEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        stop();
        if (e.code !== 'Escape') commitParam(node, def.id, e.code);
        btn.textContent = keyLabel(e.code === 'Escape' ? code : e.code);
      };
      const stop = (): void => {
        window.removeEventListener('keydown', onKey, true);
        btn.classList.remove('capturing');
        stopKeyCapture = null;
      };
      window.addEventListener('keydown', onKey, true);
      stopKeyCapture = () => {
        stop();
        btn.textContent = keyLabel(code);
      };
    });
    return btn;
  }

  function lookEditor(def: ParamDef, node: GraphNode, value: string): HTMLElement {
    const colorOf = (): string => {
      const c = state.getGraph().nodes.find((n) => n.id === node.id)?.params.color;
      return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#3b82f6';
    };
    lookPicker = createLookPicker({
      options: def.options ?? [],
      value,
      getColor: colorOf,
      onPick: (v) => commitParam(node, def.id, v),
    });
    return lookPicker.el;
  }

  function switchEditor(def: ParamDef, node: GraphNode, raw: string, map: { on: string; off: string }): HTMLElement {
    const btn = h('button', 'pn-switch');
    btn.type = 'button';
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-label', def.label);
    let on = raw === map.on;
    btn.setAttribute('aria-checked', String(on));
    btn.addEventListener('click', () => {
      on = !on;
      btn.setAttribute('aria-checked', String(on));
      commitParam(node, def.id, on ? map.on : map.off);
    });
    return btn;
  }

  /** Editor control and whether the row lays out label and control on one line. */
  function editorFor(def: ParamDef, node: GraphNode): { control: HTMLElement; inline: boolean; live: boolean } {
    const raw: ParamValue = node.params[def.id] ?? def.legacyDefault ?? def.default;
    switch (def.kind) {
      case 'number': {
        const num = numberStepper(def, typeof raw === 'number' ? raw : 0, (v) => commitParam(node, def.id, v));
        return { control: num.el, inline: true, live: true };
      }
      case 'select': {
        // The character's look is chosen from pictures rather than a plain drop-down.
        if (node.kind === 'character' && def.id === 'look') {
          return { control: lookEditor(def, node, String(raw)), inline: false, live: true };
        }
        const sw = switchOnValue(def);
        if (sw) return { control: switchEditor(def, node, String(raw), sw), inline: true, live: false };
        const sel = h('select', 'prop-input pn-select');
        sel.setAttribute('aria-label', def.label);
        for (const o of def.options ?? []) {
          const opt = h('option', '', o.label);
          opt.value = o.value;
          sel.append(opt);
        }
        sel.value = String(raw);
        sel.addEventListener('change', () => commitParam(node, def.id, sel.value));
        return { control: sel, inline: false, live: false };
      }
      case 'key':
        return { control: keyEditor(def, node, typeof raw === 'string' ? raw : ''), inline: true, live: false };
      case 'color': {
        const input = h('input', 'prop-color pn-color');
        input.type = 'color';
        input.setAttribute('aria-label', def.label);
        input.value = typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#888888';
        input.addEventListener('input', () => commitParam(node, def.id, input.value));
        return { control: input, inline: true, live: true };
      }
      case 'vec3':
        return {
          control: vec3Editor(def, node, typeof raw === 'object' ? raw : { x: 0, y: 0, z: 0 }),
          inline: false,
          live: true,
        };
      case 'text': {
        if (def.multiline) {
          const area = h('textarea', 'prop-input pn-text');
          area.rows = 4;
          area.style.height = 'auto';
          area.style.padding = '6px 9px';
          area.setAttribute('aria-label', def.label);
          area.value = typeof raw === 'string' ? raw : '';
          area.addEventListener('input', () => commitParam(node, def.id, area.value));
          return { control: area, inline: false, live: false };
        }
        const input = h('input', 'prop-input pn-text');
        input.type = 'text';
        input.setAttribute('aria-label', def.label);
        input.value = typeof raw === 'string' ? raw : '';
        input.addEventListener('input', () => commitParam(node, def.id, input.value));
        return { control: input, inline: false, live: false };
      }
    }
  }

  function paramRow(def: ParamDef, node: GraphNode, playing: boolean): HTMLElement {
    const { control, inline, live } = editorFor(def, node);
    const row = h('div', `prop-row pn-field${inline ? '' : ' pn-col'}`);
    row.dataset.param = def.id;
    row.append(h('div', 'prop-label pn-label', def.label), control);
    if (playing && !live) {
      for (const c of row.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input,button,select')) {
        c.disabled = true;
      }
    }
    return row;
  }

  // ---------- ports ----------

  function nodeLabel(id: string): string {
    const n = state.getGraph().nodes.find((x) => x.id === id);
    return (n && getNodeDef(n.kind)?.label) || id;
  }

  function portLabelOf(nodeId: string, portId: string, dir: 'in' | 'out'): string {
    const n = state.getGraph().nodes.find((x) => x.id === nodeId);
    const d = n && getNodeDef(n.kind);
    const p = (dir === 'in' ? (d ? knownInputs(d) : undefined) : d ? knownOutputs(d) : undefined)?.find((x) => x.id === portId);
    return p?.label ?? portId;
  }

  function jumpButton(nodeId: string, text: string): HTMLButtonElement {
    const b = h('button', 'pn-jump', text);
    b.type = 'button';
    b.title = P.jumpTip;
    b.addEventListener('click', () => state.select({ kind: 'node', id: nodeId }));
    return b;
  }

  function portBlock(node: GraphNode, port: PortDef, dir: 'in' | 'out'): HTMLElement {
    const wires = state.getGraph().wires;
    const box = h('div', 'pn-port');
    box.dataset.port = port.id;
    box.append(h('i', `pn-shape t-${port.type}`));
    const title = h('b', '', port.label);
    title.append(h('em', '', `${dir === 'in' ? P.portIn : P.portOut}, ${PORT_TYPE_LABELS[port.type]}`));
    const conn = h('div', 'pn-conn');
    if (dir === 'in') {
      const w = wires.find((x) => x.to.node === node.id && x.to.port === port.id);
      if (w) {
        conn.append(`${P.portFrom} `, jumpButton(w.from.node, `${nodeLabel(w.from.node)}: ${portLabelOf(w.from.node, w.from.port, 'out')}`));
      } else conn.append(P.portNone);
    } else {
      const out = wires.filter((x) => x.from.node === node.id && x.from.port === port.id);
      if (out.length > 0) {
        conn.append(`${P.portTo} `);
        for (const w of out) conn.append(jumpButton(w.to.node, `${nodeLabel(w.to.node)}: ${portLabelOf(w.to.node, w.to.port, 'in')}`));
      } else conn.append(P.portNone);
    }
    box.append(title, conn);
    return box;
  }

  function portsSection(node: GraphNode, inputs: PortDef[], outputs: PortDef[]): HTMLElement | null {
    const total = inputs.length + outputs.length;
    if (total === 0) return null;
    const sec = h('div', 'pn-sec pn-ports');
    const head = h('div', 'pn-sec-h', P.sectionPorts);
    head.append(h('span', 'pn-sec-n', String(total)));
    sec.append(head);
    for (const p of inputs) sec.append(portBlock(node, p, 'in'));
    for (const p of outputs) sec.append(portBlock(node, p, 'out'));
    return sec;
  }

  // ---------- render ----------

  function actionButton(label: string, className: string, icon: 'copy' | 'trash', playing: boolean, onClick: () => void): HTMLButtonElement {
    const b = h('button', className);
    b.type = 'button';
    b.append(panelIcon(icon), h('span', '', label));
    b.disabled = playing;
    b.addEventListener('click', onClick);
    return b;
  }

  /** The "Va chạm thật" switch of this game (also in the Tệp menu). Applies on the next Chạy. */
  function solidBodiesToggle(): HTMLElement {
    const playing = state.isPlaying();
    const row = h('div', 'pn-setting');
    row.dataset.setting = 'solid-bodies';
    const label = h('label', 'pn-setting-label');
    const box = h('input');
    box.type = 'checkbox';
    box.checked = state.getSolidBodies();
    box.disabled = playing;
    box.addEventListener('change', () => state.setSolidBodies(box.checked));
    label.append(box, h('span', '', P.solidBodiesLabel));
    label.title = playing ? P.solidBodiesLocked : P.solidBodiesTip;
    row.append(h('h3', '', P.gameSettingsTitle), label, createHandbookHelpButton(SOLID_BODIES_TOPIC, P.solidBodiesLabel), h('p', 'pn-setting-tip', P.solidBodiesTip));
    return row;
  }

  function renderEmpty(): void {
    const box = h('div', 'pn-empty-state');
    box.append(h('h3', '', P.emptyTitle), h('p', '', P.emptyBody), solidBodiesToggle());
    const dl = h('dl', 'pn-keys');
    for (const s of P.shortcuts) {
      const dt = h('dt');
      s.keys.forEach((k, i) => {
        if (i > 0) dt.append(' ');
        dt.append(h('kbd', '', k));
      });
      dl.append(dt, h('dd', '', s.text));
    }
    box.append(dl);
    el.append(box);
  }

  function render(): void {
    stopKeyCapture?.();
    lookPicker?.dispose();
    lookPicker = null;
    el.replaceChildren();
    el.append(h('div', 'panel-title pn-title', TEXT_VI.propsTitle));
    const sel = state.getSelection();
    const graph = state.getGraph();
    const playing = state.isPlaying();

    if (sel?.kind === 'group' && renderGroupInspector(el, state, sel.id)) return;
    if (!sel) {
      const loose = [...state.getMulti()].filter((id) => graph.nodes.some((n) => n.id === id));
      if (loose.length >= 2) {
        renderMultiSelect(el, state, loose.length);
        return;
      }
    }
    if (sel?.kind === 'node') {
      const node = graph.nodes.find((n) => n.id === sel.id);
      const def = node ? getNodeDef(node.kind) : undefined;
      if (node && def) {
        const head = h('div', `pn-ihead cat-${def.category}`);
        const names = h('div', 'pn-inames');
        names.append(h('div', 'prop-node-name pn-iname', def.label), h('div', 'pn-icat', def.labelEn ? `${def.labelEn} · ${P.categoryOf(NODE_CATEGORY_LABELS[def.category])}` : P.categoryOf(NODE_CATEGORY_LABELS[def.category])));
        head.append(categoryTile(def.category, true), names, createHandbookHelpButton(def.kind, def.label));
        el.append(head);
        if (playing) el.append(h('div', 'prop-locked pn-live-note', P.liveNote));
        el.append(h('p', 'pn-desc', def.description));

        if (def.params.length > 0) {
          const sec = h('div', 'pn-sec');
          sec.append(h('div', 'pn-sec-h', P.sectionProps));
          const form = h('div', 'prop-form pn-form');
          for (const p of def.params) if (!p.advanced) form.append(paramRow(p, node, playing));
          sec.append(form);
          const extra = def.params.filter((p) => p.advanced);
          if (extra.length > 0) {
            // Fine-tuning numbers stay folded so beginners see only the main settings.
            const adv = document.createElement('details');
            adv.className = 'pn-adv';
            adv.open = advancedOpen;
            adv.addEventListener('toggle', () => (advancedOpen = adv.open));
            const sum = document.createElement('summary');
            sum.className = 'pn-adv-h';
            sum.textContent = P.sectionAdvanced;
            const advForm = h('div', 'prop-form pn-form');
            for (const p of extra) advForm.append(paramRow(p, node, playing));
            adv.append(sum, advForm);
            sec.append(adv);
          }
          el.append(sec);
        }
        const ports = portsSection(node, activeInputs(def, node.params), activeOutputs(def, node.params));
        if (ports) el.append(ports);

        const actions = h('div', 'pn-actions');
        const dup = actionButton(P.duplicate, 'btn pn-btn', 'copy', playing, () => state.duplicate());
        dup.title = P.duplicateTip;
        actions.append(dup);
        const danger = h('div', 'pn-danger');
        danger.append(actionButton(P.deleteBlock, 'btn danger pn-btn', 'trash', playing, () => state.deleteSelection()));
        el.append(actions, danger);
        if (playing) el.append(h('div', 'pn-lock-note', P.structureLocked));
        return;
      }
    }
    if (sel?.kind === 'wire') {
      const wire = graph.wires.find((w) => w.id === sel.id);
      if (wire) {
        el.append(h('div', 'prop-node-name pn-iname pn-wire-name', TEXT_VI.wireSelected));
        el.append(h('p', 'pn-desc', `${nodeLabel(wire.from.node)} → ${nodeLabel(wire.to.node)}`));
        el.append(h('p', 'pn-desc pn-dim', P.wireNote));
        const danger = h('div', 'pn-danger');
        danger.append(actionButton(TEXT_VI.deleteWire, 'btn danger pn-btn', 'trash', playing, () => state.deleteSelection()));
        el.append(danger);
        if (playing) el.append(h('div', 'pn-lock-note', P.structureLocked));
        return;
      }
    }
    renderEmpty();
  }

  state.subscribe((kind) => {
    if (kind === 'params') {
      // Do not rebuild while the user is typing in this panel (would drop focus).
      if (el.contains(document.activeElement) && document.activeElement !== document.body) {
        lookPicker?.refreshColor();
        return;
      }
      render();
      return;
    }
    if (kind === 'graph' || kind === 'selection' || kind === 'board' || kind === 'playing') render();
  });
  render();
  return el;
}
