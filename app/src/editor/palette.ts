import { listNodeDefs } from '../engine/registry';
import type { NodeCategory } from '../engine/types';
import { NODE_CATEGORY_LABELS } from '../nodes';
import { nodeSearchAliases } from '../nodes/node-names';
import { createHandbookHelpButton } from '../handbook/handbook-request';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { categoryTile, panelIcon } from './panels/panel-icons';
import { searchItems } from './panels/palette-search';
import { PANELS_TEXT_VI as P } from './panels/panels-text-vi';
import './panels/panels.css';
import { TEXT_VI } from './text-vi';

const CATEGORY_ORDER: NodeCategory[] = ['input', 'logic', 'math', 'object', 'action', 'brain', 'output'];
const DRAG_THRESHOLD = 5;

export interface PaletteDeps {
  state: EditorState;
  /**
   * Add a node. Coordinates are client px when dropped, or null for "add at the center".
   * Dragging uses pointer events (not HTML5 drag-and-drop), so the host decides whether the drop landed on the graph.
   */
  onAdd(kind: string, clientX: number | null, clientY: number | null): void;
  onAddNote(): void;
  /** The "Bảng mạch" group (the board's circuits), shown above the piece categories. */
  circuits?: { el: HTMLElement; filter(query: string): void };
}

interface Entry {
  kind: string;
  title: string;
  titleEn: string;
  aliases: string[];
  description: string;
  category: NodeCategory;
}

export type PaletteElement = HTMLElement & {
  /** Make the item for `kind` visible: clear the search and expand its category. */
  reveal(kind: string): void;
};

export function createPalette({ state, onAdd, onAddNote, circuits }: PaletteDeps): PaletteElement {
  const el = h('aside', 'palette pn-palette') as PaletteElement;
  const title = h('div', 'panel-title pn-title', TEXT_VI.paletteTitle);

  const box = h('label', 'pn-search');
  const input = h('input', 'pn-search-input');
  input.type = 'search';
  input.placeholder = P.searchPlaceholder;
  input.setAttribute('aria-label', P.searchLabel);
  input.autocomplete = 'off';
  input.spellcheck = false;
  const clear = h('button', 'pn-search-clear');
  clear.type = 'button';
  clear.title = P.searchClear;
  clear.setAttribute('aria-label', P.searchClear);
  clear.append(panelIcon('close'));
  box.append(panelIcon('search'), input, clear);

  const meta = h('div', 'pn-meta');
  meta.setAttribute('aria-live', 'polite');
  const head = h('div', 'pn-head');
  head.append(title, box, meta);
  const list = h('div', 'palette-list pn-list');
  el.append(head, list);

  const collapsed = new Set<NodeCategory>();
  let entries: Entry[] = [];

  function loadEntries(): void {
    entries = listNodeDefs(state.getMode()).map((d) => ({
      kind: d.kind,
      title: d.label,
      titleEn: d.labelEn ?? '',
      aliases: nodeSearchAliases(d.kind),
      description: d.description,
      category: d.category,
    }));
  }

  function makeItem(entry: Entry): HTMLButtonElement {
    const item = h('button', `palette-item pn-item cat-${entry.category}`);
    item.type = 'button';
    item.dataset.kind = entry.kind;
    item.title = `${entry.description} ${P.addTip}`;
    const txt = h('span', 'pn-item-text');
    const name = h('b', '', entry.title);
    if (entry.titleEn) name.append(h('span', 'pn-en', entry.titleEn));
    txt.append(name, h('small', '', entry.description));
    item.append(categoryTile(entry.category), txt, createHandbookHelpButton(entry.kind, entry.title));
    attachDrag(item, entry);
    return item;
  }

  function makeNoteItem(): HTMLButtonElement {
    const noteItem = h('button', 'palette-item palette-note pn-item pn-note', TEXT_VI.addNote);
    noteItem.type = 'button';
    noteItem.title = TEXT_VI.addNoteTip;
    noteItem.dataset.kind = 'note';
    noteItem.addEventListener('click', () => {
      if (!state.isPlaying()) onAddNote();
    });
    return noteItem;
  }

  function render(): void {
    const query = input.value;
    const searching = query.trim() !== '';
    box.classList.toggle('has', searching);
    list.replaceChildren();
    list.append(makeNoteItem());
    if (circuits) {
      circuits.filter(searching ? query : '');
      list.append(circuits.el);
    }

    if (searching) {
      const found = searchItems(entries, query);
      if (found.length === 0 && circuits && !circuits.el.hidden) {
        // Only circuits match: they are listed above, nothing else to say.
      } else if (found.length === 0) {
        const empty = h('div', 'pn-empty');
        empty.append(h('b', '', P.noResultTitle(query.trim())), document.createElement('br'), P.noResultHint);
        list.append(empty);
      } else {
        const wrap = h('div', 'pn-items');
        for (const e of found) wrap.append(makeItem(e));
        list.append(wrap);
      }
      meta.textContent = P.countFound(found.length);
      return;
    }

    let groups = 0;
    for (const cat of CATEGORY_ORDER) {
      const inCat = entries.filter((e) => e.category === cat);
      if (inCat.length === 0) continue;
      groups += 1;
      const open = !collapsed.has(cat);
      const section = h('section', 'pn-cat');
      const header = h('button', `pn-cat-head pn-cc-${cat}`);
      header.type = 'button';
      header.setAttribute('aria-expanded', String(open));
      const chev = panelIcon('chev');
      chev.classList.add('pn-chev');
      header.append(
        chev,
        categoryTile(cat),
        h('span', 'pn-cat-name', NODE_CATEGORY_LABELS[cat]),
        h('span', 'pn-cat-count', String(inCat.length)),
      );
      header.addEventListener('click', () => {
        if (collapsed.has(cat)) collapsed.delete(cat);
        else collapsed.add(cat);
        render();
        list.querySelector<HTMLElement>(`.pn-cat-head.pn-cc-${cat}`)?.focus();
      });
      section.append(header);
      if (open) {
        const wrap = h('div', 'pn-items');
        for (const e of inCat) wrap.append(makeItem(e));
        section.append(wrap);
      }
      list.append(section);
    }
    meta.textContent = P.countAll(entries.length, groups);
  }

  function attachDrag(item: HTMLElement, entry: Entry): void {
    item.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || state.isPlaying()) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let ghost: HTMLElement | null = null;

      const move = (ev: PointerEvent): void => {
        if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
        if (!ghost) {
          ghost = h('div', 'drag-ghost', entry.title);
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
        if (dragged) onAdd(entry.kind, ev.clientX, ev.clientY);
        else onAdd(entry.kind, null, null);
      };
      const up = (ev: PointerEvent): void => finish(ev, true);
      const cancel = (ev: PointerEvent): void => finish(ev, false);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    });
    // Keyboard activation (Enter/Space on the focused button) has detail 0.
    item.addEventListener('click', (e) => {
      if (e.detail === 0 && !state.isPlaying()) onAdd(entry.kind, null, null);
    });
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (state.isPlaying() || input.value.trim() === '') return;
      const top = searchItems(entries, input.value)[0];
      if (top) onAdd(top.kind, null, null);
    } else if (e.key === 'Escape' && input.value !== '') {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      render();
    }
  });
  clear.addEventListener('click', () => {
    input.value = '';
    render();
    input.focus();
  });

  function syncPlaying(): void {
    const playing = state.isPlaying();
    el.classList.toggle('disabled', playing);
    input.title = playing ? P.lockedAdd : '';
  }

  state.subscribe((kind) => {
    if (kind === 'mode' || kind === 'board') {
      loadEntries();
      render();
    }
    if (kind === 'playing') syncPlaying();
  });
  el.reveal = (kind) => {
    const entry = entries.find((e) => e.kind === kind);
    if (!entry && kind !== 'note') return;
    const wasSearching = input.value !== '';
    const wasCollapsed = entry ? collapsed.delete(entry.category) : false;
    input.value = '';
    if (wasSearching || wasCollapsed) render();
  };

  loadEntries();
  render();
  syncPlaying();
  return el;
}
