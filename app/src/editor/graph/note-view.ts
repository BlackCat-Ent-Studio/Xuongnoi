import { NOTE_COLORS, NOTE_MAX_TEXT } from '../../engine/notes';
import type { Note } from '../../engine/types';
import { h } from '../dom';
import type { EditorState } from '../editor-state';
import { TEXT_VI } from '../text-vi';

export interface NoteParts {
  el: HTMLElement;
  text: HTMLTextAreaElement;
}

function buildNote(state: EditorState, note: Note): NoteParts {
  const box = h('div', 'wc-note');
  box.dataset.id = note.id;
  const tools = h('div', 'wc-note-tools');
  tools.append(h('span', 'wc-note-grip', '📝'));
  const colors = h('span', 'wc-note-colors');
  for (const c of NOTE_COLORS) {
    const dot = h('button', `wc-note-dot dot-${c}`);
    dot.type = 'button';
    dot.title = TEXT_VI.noteColor;
    dot.addEventListener('click', () => state.updateNote(note.id, { color: c }));
    colors.append(dot);
  }
  const del = h('button', 'wc-note-del', '🗑');
  del.type = 'button';
  del.title = TEXT_VI.noteDelete;
  del.addEventListener('click', () => {
    state.select({ kind: 'note', id: note.id });
    state.deleteSelection();
  });
  tools.append(colors, del);
  const text = h('textarea', 'wc-note-text');
  text.placeholder = TEXT_VI.noteHolder;
  text.maxLength = NOTE_MAX_TEXT;
  text.spellcheck = false;
  text.addEventListener('input', () => state.updateNote(note.id, { text: text.value }));
  const grab = h('div', 'wc-note-resize');
  grab.title = TEXT_VI.noteResize;
  box.append(tools, text, grab);
  return { el: box, text };
}

/** Updates note elements in place so a note being typed in keeps its focus. */
export function syncNotes(state: EditorState, layer: HTMLElement, parts: Map<string, NoteParts>): void {
  const notes = state.getNotes();
  const alive = new Set(notes.map((n) => n.id));
  for (const [id, p] of parts) {
    if (!alive.has(id)) {
      p.el.remove();
      parts.delete(id);
    }
  }
  const readonly = state.isPlaying();
  for (const note of notes) {
    let p = parts.get(note.id);
    if (!p) {
      p = buildNote(state, note);
      parts.set(note.id, p);
      layer.append(p.el);
    }
    p.el.style.left = `${note.pos.x}px`;
    p.el.style.top = `${note.pos.y}px`;
    p.el.style.width = `${note.size.w}px`;
    p.el.style.height = `${note.size.h}px`;
    for (const c of NOTE_COLORS) p.el.classList.toggle(`color-${c}`, c === note.color);
    if (p.text.value !== note.text) p.text.value = note.text;
    p.text.readOnly = readonly;
  }
}
