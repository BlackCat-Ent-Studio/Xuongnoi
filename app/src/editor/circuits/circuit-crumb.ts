import { instanceNameOf } from '../../circuits/instance';
import { h } from '../dom';
import type { EditorState } from '../editor-state';
import { uiPrefs } from '../theme/ui-prefs';
import { CIRCUIT_NAME_MAX, countInstances, findCircuit, openGraph, renameCircuit } from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { circuitIcon } from './circuit-views';

export interface CircuitCrumb {
  /** "Bảng chính › Trạm nạp › Tay máy" with the name box of the open circuit and "Quay ra". Hidden on the main board. */
  el: HTMLElement;
  /** The line under it: where you are, how many copies an edit changes, and (pupils) the "Sửa mạch" button. */
  note: HTMLElement;
  update(): void;
}

/**
 * The path bar of an entered circuit. It also owns the rule of who may edit inside: in the "Giáo viên" display mode a circuit
 * opens ready to edit; in "Học sinh" it opens view-only until "Sửa mạch" is pressed.
 */
export function createCircuitCrumb(state: EditorState): CircuitCrumb {
  const el = h('div', 'wc-crumb wc-ccrumb wc-ui');
  el.hidden = true;
  const note = h('div', 'wc-cnote wc-ui');
  note.hidden = true;
  note.setAttribute('role', 'note');

  const name = h('input', 'wc-crumb-name');
  name.type = 'text';
  name.maxLength = CIRCUIT_NAME_MAX;
  name.setAttribute('aria-label', T.nameLabel);
  const commit = (): void => {
    const step = state.getCircuitPath().at(-1);
    if (step) state.edit((b) => renameCircuit(b, step.circuit, name.value), ['graph'], `cname:${step.circuit}`);
    update();
  };
  name.addEventListener('change', commit);
  name.addEventListener('keydown', (e) => {
    e.stopPropagation(); // typing a name must not trigger board shortcuts
    if (e.key === 'Enter') name.blur();
    else if (e.key === 'Escape') {
      update();
      name.blur();
    }
  });

  function crumbButton(text: string, keep: number): HTMLButtonElement {
    const b = h('button', 'wc-crumb-root', text);
    b.type = 'button';
    b.addEventListener('click', () => state.exitCircuit(keep));
    return b;
  }

  function update(): void {
    const path = state.getCircuitPath();
    const board = state.getBoard();
    const last = path.at(-1);
    const circuit = last ? findCircuit(board, last.circuit) : undefined;
    el.hidden = !circuit;
    note.hidden = !circuit;
    if (!circuit || !last) return;
    const typing = document.activeElement === name;
    const parts: (HTMLElement | string)[] = [crumbButton(T.root, 0)];
    path.slice(0, -1).forEach((step, i) => {
      parts.push(h('span', 'wc-crumb-sep', '›'), crumbButton(findCircuit(board, step.circuit)?.name ?? step.circuit, i + 1));
    });
    const back = h('button', 'wc-crumb-back');
    back.type = 'button';
    back.title = T.backTip;
    back.append(circuitIcon('back'), h('span', '', T.back));
    back.addEventListener('click', () => state.exitCircuit());
    name.disabled = state.isReadOnly();
    if (!typing) name.value = circuit.name;
    el.replaceChildren(...parts, h('span', 'wc-crumb-sep', '›'), name, back, h('span', 'wc-ccrumb-level', T.level(path.length + 1)));
    if (typing) name.focus();

    // The copy the circuit was opened through, when there is one: "Bạn đang ở trong Xe AGV 3."
    const parent = openGraph(board, path.slice(0, -1));
    const via = last.via === undefined ? undefined : parent.nodes.find((n) => n.id === last.via);
    const viaName = via ? instanceNameOf(via) : '';
    const text = h('span', 'wc-cnote-text');
    if (viaName && viaName !== circuit.name) text.append(`${T.insideOf(viaName)} `);
    const locked = !state.isCircuitEditing();
    if (locked) text.append(h('b', '', T.viewOnly), ' ');
    text.append(T.changesAll(circuit.name, countInstances(board, circuit.id)));
    note.replaceChildren(circuitIcon(locked ? 'lock' : 'info'), text);
    note.classList.toggle('locked', locked);
    if (locked && !state.isPlaying()) {
      const edit = h('button', 'wc-cnote-edit');
      edit.type = 'button';
      edit.title = T.editCircuitTip;
      edit.append(circuitIcon('pencil'), h('span', '', T.editCircuit));
      edit.addEventListener('click', () => state.setCircuitEditing(true));
      note.append(edit);
    }
  }

  let depth = state.getCircuitPath().length;
  state.subscribe((kind) => {
    if (kind !== 'scope') return;
    const was = depth;
    depth = state.getCircuitPath().length;
    // Coming in from the main board: pupils look first and unlock on purpose.
    if (was === 0 && depth > 0 && uiPrefs().mode() === 'student') state.setCircuitEditing(false);
  });
  uiPrefs().subscribe(() => {
    if (uiPrefs().mode() === 'teacher' && !state.isCircuitEditing()) state.setCircuitEditing(true);
  });

  return { el, note, update };
}
