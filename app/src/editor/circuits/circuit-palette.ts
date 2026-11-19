import type { Circuit } from '../../engine/types';
import { downloadCircuit, importCircuitFile, importClash, pickCircuitFile, type CircuitFile } from '../../io';
import { listStarterCircuits } from '../../io/starter-circuits';
import { h } from '../dom';
import type { EditorState } from '../editor-state';
import { GROUP_COLORS } from '../groups/group-model';
import { circuitFromSelection, newEmptyCircuit, type Notify } from './circuit-actions';
import { CIRCUIT_NAME_MAX, circuitsOf, countInstances, deleteCircuit, duplicateCircuit, findCircuit, renameCircuit, setCircuitColor } from './circuit-model';
import { CIRCUIT_VI as T } from './circuit-text-vi';
import { circuitIcon, circuitTile, iconButton, type CircuitGlyph } from './circuit-views';
import './circuit-library.css';

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

/** The colour swatches of a circuit: the default first, then the palette the groups use. */
export function circuitSwatches(current: string | undefined, disabled: boolean, pick: (color: string | null) => void): HTMLElement {
  const box = h('span', 'pn-swatches ck-swatches');
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', T.colour);
  for (const c of [null, ...GROUP_COLORS]) {
    const on = (current ?? null) === c;
    const sw = h('button', `pn-swatch${on ? ' on' : ''}${c === null ? ' none' : ''}`);
    sw.type = 'button';
    sw.disabled = disabled;
    sw.title = c === null ? T.colourDefault : c;
    sw.setAttribute('aria-label', c === null ? T.colourDefault : T.colourOf(c));
    sw.setAttribute('aria-pressed', String(on));
    sw.dataset.colour = c ?? '';
    if (c) sw.style.background = c;
    sw.addEventListener('click', () => pick(c));
    box.append(sw);
  }
  return box;
}

/**
 * The palette group "Bảng mạch": the board's circuits. Drag one to the board (or press it) to place a copy; the small
 * buttons open, rename, colour, duplicate, save to a file and delete it. Under the list: new circuits, a circuit from a file
 * (a name that is taken is asked about right here) and the ready-made starter circuits.
 */
export function createCircuitPalette({ state, notify, onPlace }: CircuitPaletteDeps): CircuitPalette {
  const el = h('section', 'pn-cat ck-pal');
  let open = true;
  let startersOpen = true;
  let query = '';
  let renaming: string | null = null;
  let asking: string | null = null;
  let colouring: string | null = null;
  /** A picked file whose circuit has the name of one the board already has: waiting for the choice. */
  let incoming: { file: CircuitFile; clash: string } | null = null;

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

  /** The list of circuits belongs to the whole board: a circuit that is open view-only is left first, so the edit is not refused by its lock. */
  function editLibrary(change: Parameters<EditorState['edit']>[0]): boolean {
    if (state.isPlaying()) return false;
    if (state.isReadOnly()) state.exitCircuit(0);
    return state.edit(change);
  }

  /** Adds the circuits of a file (or of a starter) to the board; `replace` puts the root in the place of an existing circuit. */
  function bringIn(file: CircuitFile, replace: string | undefined, said: (name: string, contained: number, dropped: number) => string): void {
    const res = importCircuitFile(state.getBoard(), file, replace === undefined ? {} : { replace });
    if (!res.ok) {
      notify(T.importFail[res.reason], 'error');
      return;
    }
    if (editLibrary(() => res.board)) notify(said(res.name, res.contained, res.dropped));
    else notify(T.locked, 'error');
  }

  function importFromFile(): void {
    pickCircuitFile().then(
      (file) => {
        if (!file) return;
        const clash = importClash(state.getBoard(), file);
        if (!clash) return bringIn(file, undefined, T.imported);
        incoming = { file, clash: clash.id };
        open = true;
        render();
      },
      (e: unknown) => notify(e instanceof Error ? e.message : T.importFail.broken, 'error'),
    );
  }

  function textButton(label: string, className: string, tip: string, onClick: () => void): HTMLButtonElement {
    const b = h('button', `ck-pal-btn${className}`, label);
    b.type = 'button';
    if (tip) b.title = tip;
    b.addEventListener('click', onClick);
    return b;
  }

  function item(circuit: Circuit): HTMLElement {
    const board = state.getBoard();
    const circuitId = circuit.id;
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
      const no = textButton(T.deleteNo, '', '', () => {
        asking = null;
        render();
      });
      tools.classList.add('ask');
      tools.setAttribute('role', 'alert');
      tools.append(
        h('span', 'ck-pal-ask', T.deleteAsk(copies)),
        textButton(T.deleteYes, ' danger', '', () => {
          asking = null;
          remove(circuitId, true);
        }),
        no,
      );
      queueMicrotask(() => no.focus());
    } else if (colouring === circuitId) {
      tools.classList.add('colour');
      tools.append(
        circuitSwatches(circuit.color, playing, (c) => void state.edit((b) => setCircuitColor(b, circuitId, c))),
        textButton(T.colourDone, '', '', () => {
          colouring = null;
          render();
        }),
      );
    } else {
      const tool = (glyph: CircuitGlyph, label: string, onClick: () => void, extra = ''): HTMLButtonElement => iconButton(glyph, label, `ck-pal-tool${extra}`, onClick);
      const openBtn = tool('enter', T.actOpen, () => {
        state.exitCircuit(0);
        state.enterCircuit({ circuit: circuitId });
      });
      const renameBtn = tool('pencil', T.actRename, () => {
        renaming = circuitId;
        render();
      });
      const colourBtn = tool('drop', T.actColour, () => {
        colouring = circuitId;
        render();
      });
      const dupBtn = tool('copy', T.actDuplicate, () => {
        let made = '';
        const ok = state.edit((b) => {
          const res = duplicateCircuit(b, circuitId);
          made = res ? (findCircuit(res.board, res.circuitId)?.name ?? '') : '';
          return res?.board ?? null;
        });
        notify(ok ? T.duplicated(made) : T.locked, ok ? 'info' : 'error');
      });
      const exportBtn = tool('download', T.actExport, () => {
        try {
          if (downloadCircuit(state.getBoard(), circuitId)) notify(T.exported(circuit.name));
        } catch (e) {
          notify(e instanceof Error ? e.message : T.importFail.broken, 'error');
        }
      });
      const delBtn = tool(
        'trash',
        T.actDelete,
        () => {
          if (copies > 0) {
            asking = circuitId;
            render();
          } else remove(circuitId, false);
        },
        ' danger',
      );
      for (const b of [renameBtn, colourBtn, dupBtn, delBtn]) b.disabled = playing;
      tools.append(openBtn, renameBtn, colourBtn, dupBtn, exportBtn, delBtn);
    }
    row.append(tools);
    attachDrag(row, circuitId, circuit.name);
    return row;
  }

  function footButton(glyph: CircuitGlyph, label: string, tip: string, onClick: () => void): HTMLButtonElement {
    const b = h('button', 'ck-pal-new');
    b.type = 'button';
    b.title = tip;
    b.append(circuitIcon(glyph), h('span', '', label));
    b.disabled = state.isPlaying();
    b.addEventListener('click', onClick);
    return b;
  }

  /** "Đã có bảng mạch tên X": keep both, put the file's circuit in the old one's place, or drop the file. */
  function incomingAsk(pending: { file: CircuitFile; clash: string }): HTMLElement | null {
    const clash = findCircuit(state.getBoard(), pending.clash);
    if (!clash) return null;
    const copies = countInstances(state.getBoard(), clash.id);
    const box = h('div', 'ck-pal-tools ask ck-pal-incoming');
    box.setAttribute('role', 'alert');
    const cancel = textButton(T.importCancel, '', '', () => {
      incoming = null;
      render();
    });
    const settle = (replace: string | undefined): void => {
      incoming = null;
      bringIn(pending.file, replace, replace === undefined ? T.imported : T.importReplaced);
      render();
    };
    const keep = textButton(T.importKeep, '', T.importKeepTip, () => settle(undefined));
    keep.dataset.act = 'keep';
    const swap = textButton(T.importReplace, ' danger', T.importReplaceTip(copies), () => settle(clash.id));
    swap.dataset.act = 'replace';
    box.append(h('span', 'ck-pal-ask', T.importAsk(clash.name, copies)), keep, swap, cancel);
    queueMicrotask(() => keep.focus());
    return box;
  }

  function starters(): HTMLElement {
    const box = h('div', 'ck-pal-starters');
    const head = h('button', 'ck-pal-starthead');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(startersOpen));
    const chev = circuitIcon('chev');
    chev.classList.add('pn-chev', 'pn-ic');
    head.append(chev, circuitIcon('star'), h('span', '', T.starters));
    head.addEventListener('click', () => {
      startersOpen = !startersOpen;
      render();
      el.querySelector<HTMLElement>('.ck-pal-starthead')?.focus();
    });
    box.append(head);
    if (!startersOpen) return box;
    box.append(h('p', 'ck-pal-empty', T.startersHint));
    for (const s of listStarterCircuits()) {
      const circuit = s.file.circuits.find((c) => c.id === s.file.root);
      if (!circuit) continue;
      const row = h('div', 'ck-pal-starter');
      row.dataset.starter = s.id;
      const text = h('span', 'pn-item-text');
      text.append(h('b', '', circuit.name), h('small', '', s.about));
      const add = textButton(T.starterAdd, '', T.starterAddTip(circuit.name), () => bringIn(s.file, undefined, T.starterAdded));
      add.disabled = state.isPlaying();
      row.append(circuitTile(circuit, 'ck-pal-ic'), text, add);
      box.append(row);
    }
    return box;
  }

  function render(): void {
    const all = circuitsOf(state.getBoard());
    if (renaming !== null && !all.some((c) => c.id === renaming)) renaming = null;
    if (asking !== null && !all.some((c) => c.id === asking)) asking = null;
    if (colouring !== null && !all.some((c) => c.id === colouring)) colouring = null;
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
    for (const c of shown) wrap.append(item(c));
    if (wanted === '') {
      const foot = h('div', 'ck-pal-foot');
      const importBtn = footButton('upload', T.importBtn, T.importTip, importFromFile);
      importBtn.dataset.act = 'import';
      foot.append(
        footButton('plus', T.newEmpty, T.newEmptyTip, () => void newEmptyCircuit(state, notify)),
        footButton('circuit', T.fromSelection, T.fromSelectionTip, () => void circuitFromSelection(state, notify)),
        importBtn,
      );
      wrap.append(foot);
      const ask = incoming ? incomingAsk(incoming) : null;
      if (ask) wrap.append(ask);
      else incoming = null;
      wrap.append(starters());
    }
    el.append(wrap);
  }

  state.subscribe((kind) => {
    if (kind === 'board') incoming = null;
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
