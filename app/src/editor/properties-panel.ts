import { getNodeDef } from '../engine/registry';
import type { GraphNode, ParamDef, ParamValue, Vec3 } from '../engine/types';
import { h } from './dom';
import { createLookPicker, type LookPicker } from './look-picker';
import type { EditorState } from './editor-state';
import { TEXT_VI, keyLabel } from './text-vi';

function clampNum(v: number, def: ParamDef): number {
  let r = v;
  if (def.min !== undefined) r = Math.max(def.min, r);
  if (def.max !== undefined) r = Math.min(def.max, r);
  return r;
}

function numberInput(def: ParamDef, value: number, onValue: (v: number) => void): HTMLInputElement {
  const input = h('input', 'prop-input');
  input.type = 'number';
  input.value = String(value);
  if (def.min !== undefined) input.min = String(def.min);
  if (def.max !== undefined) input.max = String(def.max);
  input.step = String(def.step ?? 1);
  input.addEventListener('input', () => {
    const v = input.valueAsNumber;
    if (Number.isFinite(v)) onValue(clampNum(v, def));
  });
  input.addEventListener('change', () => {
    const v = input.valueAsNumber;
    input.value = String(Number.isFinite(v) ? clampNum(v, def) : value);
  });
  return input;
}

export function createPropertiesPanel(state: EditorState): HTMLElement {
  const el = h('section', 'props');
  let stopKeyCapture: (() => void) | null = null;
  let lookPicker: LookPicker | null = null;

  function vec3Editor(def: ParamDef, node: GraphNode, value: Vec3): HTMLElement {
    const row = h('div', 'prop-vec3');
    let current = { ...value };
    for (const axis of ['x', 'y', 'z'] as const) {
      const cell = h('label', 'prop-axis');
      cell.append(h('span', '', axis.toUpperCase()));
      cell.append(
        numberInput({ ...def, step: def.step ?? 0.5 }, current[axis], (v) => {
          current = { ...current, [axis]: v };
          state.setParam(node.id, def.id, current);
        }),
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
        if (e.code !== 'Escape') state.setParam(node.id, def.id, e.code);
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
      onPick: (v) => state.setParam(node.id, def.id, v),
    });
    return lookPicker.el;
  }

  function editorFor(def: ParamDef, node: GraphNode): HTMLElement {
    const raw: ParamValue = node.params[def.id] ?? def.default;
    switch (def.kind) {
      case 'number':
        return numberInput(def, typeof raw === 'number' ? raw : 0, (v) => state.setParam(node.id, def.id, v));
      case 'select': {
        // The character's look is chosen from pictures rather than a plain drop-down.
        if (node.kind === 'character' && def.id === 'look') return lookEditor(def, node, String(raw));
        const sel = h('select', 'prop-input');
        for (const o of def.options ?? []) {
          const opt = h('option', '', o.label);
          opt.value = o.value;
          sel.append(opt);
        }
        sel.value = String(raw);
        sel.addEventListener('change', () => state.setParam(node.id, def.id, sel.value));
        return sel;
      }
      case 'key':
        return keyEditor(def, node, typeof raw === 'string' ? raw : '');
      case 'color': {
        const input = h('input', 'prop-color');
        input.type = 'color';
        input.value = typeof raw === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : '#888888';
        input.addEventListener('input', () => state.setParam(node.id, def.id, input.value));
        return input;
      }
      case 'vec3':
        return vec3Editor(
          def,
          node,
          typeof raw === 'object' ? raw : { x: 0, y: 0, z: 0 },
        );
      case 'text': {
        const input = h('input', 'prop-input');
        input.type = 'text';
        input.value = typeof raw === 'string' ? raw : '';
        input.addEventListener('input', () => state.setParam(node.id, def.id, input.value));
        return input;
      }
    }
  }

  function render(): void {
    stopKeyCapture?.();
    lookPicker?.dispose();
    lookPicker = null;
    el.replaceChildren();
    el.append(h('div', 'panel-title', TEXT_VI.propsTitle));
    const sel = state.getSelection();
    const graph = state.getGraph();
    const playing = state.isPlaying();

    if (sel?.kind === 'node') {
      const node = graph.nodes.find((n) => n.id === sel.id);
      const def = node ? getNodeDef(node.kind) : undefined;
      if (node && def) {
        el.append(h('div', `prop-node-name cat-${def.category}`, def.label), h('div', 'panel-hint', def.description));
        if (playing) el.append(h('div', 'prop-locked', TEXT_VI.playLocked));
        const form = h('fieldset', 'prop-form');
        form.disabled = playing;
        for (const p of def.params) {
          const row = h('div', 'prop-row');
          row.dataset.param = p.id;
          row.append(h('div', 'prop-label', p.label), editorFor(p, node));
          form.append(row);
        }
        el.append(form);
        const del = h('button', 'btn danger', TEXT_VI.deleteNode);
        del.type = 'button';
        del.disabled = playing;
        del.addEventListener('click', () => state.deleteSelection());
        el.append(del);
        return;
      }
    }
    if (sel?.kind === 'wire') {
      const wire = graph.wires.find((w) => w.id === sel.id);
      if (wire) {
        const name = (id: string): string => {
          const n = graph.nodes.find((x) => x.id === id);
          return (n && getNodeDef(n.kind)?.label) || id;
        };
        el.append(h('div', 'prop-node-name', TEXT_VI.wireSelected));
        el.append(h('div', 'panel-hint', `${name(wire.from.node)} → ${name(wire.to.node)}`));
        const del = h('button', 'btn danger', TEXT_VI.deleteWire);
        del.type = 'button';
        del.disabled = playing;
        del.addEventListener('click', () => state.deleteSelection());
        el.append(del);
        return;
      }
    }
    el.append(h('div', 'panel-hint', TEXT_VI.propsEmpty));
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
