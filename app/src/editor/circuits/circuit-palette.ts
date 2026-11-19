import { h } from '../dom';
import type { EditorState } from '../editor-state';
import { circuitFromSelection, newEmptyCircuit, type Notify } from './circuit-actions';
import { CIRCUIT_NAME_MAX, circuitsOf, countInstances, deleteCircuit, duplicateCircuit, findCircuit, renameCircuit } from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { circuitIcon, circuitTile, iconButton } from './circuit-views';

const DRAG_THRESHOLD = 5;

export interface CircuitPaletteDeps {
  state: EditorState;
  notify: Notify;
  /** Place one copy. Coordinates are client px when dropped, or null for "at the centre of the board". */
  onPlace(circuitId: string, clientX: number | null, clientY: number | null): void;
}

export interface CircuitPalette {
  /** The "Bảng mạch" group; the palette puts it in its list on every render. */
  el: HTMLElement;
  /** Show only circuits whose name holds this text ('' = all). */
  filter(query: string): void;
}

/** Lower case without tone marks, so "xe" finds "Xe" and "mach" finds "Mạch". */
const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/**
 * The palette group "Bảng mạch": the board's circuits. Drag one to the board (or press it) to place a copy; the small
 * buttons open, rename, duplicate and delete it. Deleting a circuit that still has copies asks first, in the row itself.
 */
export function createCircuitPalette({ state, notify, onPlace }: CircuitPaletteDeps): CircuitPalette {
  const el = h('section', 'pn-cat ck-pal');
  let open = true;
  let query = '';
  let renaming: string | null = null;
  let asking: string | null = null;

  function attachDrag(row: HTMLElement, circuitId: string, title: string): void {
    row.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state.isPlaying() || (e.target instanceof Element && e.target.closest('button, input'))) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost: HTMLElement | null = null;
      const move = (ev: PointerEvent): void => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
        if (!ghost) {
          ghost = h('div', 'drag-ghost', title);
          document.body.append(ghost);
        }
        ghost.style.left = `${ev.clientX + 8}px`;
        ghost.style.top = `${ev.clientY + 8}px`;
      };
      const finish = (ev: PointerEvent, commit: boolean): void => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        const dragged = ghost !== null;
        ghost?.remove();
        ghost = null;
        if (!commit) return;
        if (dragged) onPlace(circuitId, ev.clientX, ev.clientY);
        else onPlace(circuitId, null, null);
      };
      const up = (ev: PointerEvent): void => finish(ev, true);
      const cancel = (ev: PointerEvent): void => finish(ev, false);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    });
    row.addEventListener('keydown', (e) => {
      if (e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (!state.isPlaying()) onPlace(circuitId, null, null);
    });
  }

  function remove(circuitId: string, withCopies: boolean): void {
    const board = state.getBoard();
    const circuit = findCircuit(board, circuitId);
    if (!circuit) return;
    const copies = countInstances(board, circuitId);
    // The circuit may be the one on screen: leave it first, the edit is then never refused by its lock.
    if (state.getCircuitPath().some((s) => s.circuit === circuitId)) state.exitCircuit(state.getCircuitPath().findIndex((s) => s.circuit === circuitId));
    if (state.edit((b) => deleteCircuit(b, circuitId, { withCopies }))) notify(copies > 0 ? T.deletedWith(circuit.name, copies) : T.deleted(circuit.name));
    else notify(T.locked, 'error');
  }

  function item(circuitId: string): HTMLElement {
    const board = state.getBoard();
    const circuit = findCircuit(board, circuitId)!;
    const copies = countInstances(board, circuitId);
    const playing = state.isPlaying();
    const row = h('div', 'ck-pal-item');
    row.dataset.circuit = circuitId;
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.title = `${circuit.name}. ${T.paletteHint}`;

    const text = h('span', 'pn-item-text');
    if (renaming === circuitId) {
      const input = h('input', 'ck-pal-name');
      input.type = 'text';
      input.value = circuit.name;
      input.maxLength = CIRCUIT_NAME_MAX;
      input.setAttribute('aria-label', T.nameLabel);
      const done = (save: boolean): void => {
        if (renaming !== circuitId) return;
        renaming = null;
        if (save && !state.edit((b) => renameCircuit(b, circuitId, input.value), ['graph'])) render();
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') done(true);
        else if (e.key === 'Escape') {
          done(false);
          render();
        }
      });
      input.addEventListener('blur', () => done(true));
      text.append(input);
      queueMicrotask(() => {
        input.focus();
        input.select();
      });
    } else {
      text.append(h('b', '', circuit.name));
    }
    text.append(h('small', '', T.summary(circuit.pins.length, circuit.exposed.length)));
    const count = h('span', 'ck-pal-count', T.usedCount(copies));
    count.title = T.usedTip(copies);
    row.append(circuitTile(circuit, 'ck-pal-ic'), text, count);

    const tools = h('div', 'ck-pal-tools');
    if (asking === circuitId) {
      const yes = h('button', 'ck-pal-btn danger', T.deleteYes);
      yes.type = 'button';
      yes.addEventListener('click', () => {
        asking = null;
        remove(circuitId, true);
      });
      const no = h('button', 'ck-pal-btn', T.deleteNo);
      no.type = 'button';
      no.addEventListener('click', () => {
        asking = null;
        render();
      });
      tools.classList.add('ask');
      tools.setAttribute('role', 'alert');
      tools.append(h('span', 'ck-pal-ask', T.deleteAsk(copies)), yes, no);
      queueMicrotask(() => no.focus());
    } else {
      const openBtn = iconButton('enter', T.actOpen, 'ck-pal-tool', () => {
        state.exitCircuit(0);
        state.enterCircuit({ circuit: circuitId });
      });
      const renameBtn = iconButton('pencil', T.actRename, 'ck-pal-tool', () => {
        renaming = circuitId;
        render();
      });
      const dupBtn = iconButton('copy', T.actDuplicate, 'ck-pal-tool', () => {
        let made = '';
        const ok = state.edit((b) => {
          const res = duplicateCircuit(b, circuitId);
          made = res ? (findCircuit(res.board, res.circuitId)?.name ?? '') : '';
          return res?.board ?? null;
        });
        notify(ok ? T.duplicated(made) : T.locked, ok ? 'info' : 'error');
      });
      const delBtn = iconButton('trash', T.actDelete, 'ck-pal-tool danger', () => {
        if (copies > 0) {
          asking = circuitId;
          render();
        } else remove(circuitId, false);
      });
      for (const b of [renameBtn, dupBtn, delBtn]) b.disabled = playing;
      tools.append(openBtn, renameBtn, dupBtn, delBtn);
    }
    row.append(tools);
    attachDrag(row, circuitId, circuit.name);
    return row;
  }

  function footButton(glyph: 'plus' | 'circuit', label: string, tip: string, onClick: () => void): HTMLButtonElement {
    const b = h('button', 'ck-pal-new');
    b.type = 'button';
    b.title = tip;
    b.append(circuitIcon(glyph), h('span', '', label));
    b.disabled = state.isPlaying();
    b.addEventListener('click', onClick);
    return b;
  }

  function render(): void {
    const all = circuitsOf(state.getBoard());
    if (renaming !== null && !all.some((c) => c.id === renaming)) renaming = null;
    if (asking !== null && !all.some((c) => c.id === asking)) asking = null;
    const wanted = fold(query.trim());
    const shown = wanted === '' ? all : all.filter((c) => fold(c.name).includes(wanted));
    el.hidden = wanted !== '' && shown.length === 0;
    el.replaceChildren();

    const header = h('button', 'pn-cat-head ck-pal-head');
    header.type = 'button';
    header.setAttribute('aria-expanded', String(open || wanted !== ''));
    const chev = circuitIcon('chev');
    chev.classList.add('pn-chev', 'pn-ic');
    header.append(chev, circuitTile(undefined, 'ck-pal-ic small'), h('span', 'pn-cat-name', T.word), h('span', 'pn-cat-count', String(all.length)));
    header.addEventListener('click', () => {
      open = !open;
      render();
      el.querySelector<HTMLElement>('.ck-pal-head')?.focus();
    });
    el.append(header);
    if (!open && wanted === '') return;

    const wrap = h('div', 'pn-items ck-pal-items');
    if (all.length === 0) wrap.append(h('p', 'ck-pal-empty', T.paletteEmpty));
    for (const c of shown) wrap.append(item(c.id));
    if (wanted === '') {
      const foot = h('div', 'ck-pal-foot');
      foot.append(
        footButton('plus', T.newEmpty, T.newEmptyTip, () => void newEmptyCircuit(state, notify)),
        footButton('circuit', T.fromSelection, T.fromSelectionTip, () => void circuitFromSelection(state, notify)),
      );
      wrap.append(foot);
    }
    el.append(wrap);
  }

  state.subscribe((kind) => {
    if (kind === 'graph' || kind === 'board' || kind === 'playing') render();
  });
  render();
  return {
    el,
    filter(next) {
      if (next === query) return;
      query = next;
      render();
    },
  };
}
