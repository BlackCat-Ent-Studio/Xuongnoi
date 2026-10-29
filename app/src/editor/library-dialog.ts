import { flushAutosave, getCurrentGameId, listGames, type LibraryEntry } from '../io';
import { h } from './dom';
import { LIBRARY_TEXT as T } from './library-text-vi';
import './library-dialog.css';

/** Each action returns a Vietnamese error message, or null when it worked. */
export interface LibraryDialogDeps {
  openGame(id: string): string | null;
  renameGame(id: string, name: string): string | null;
  duplicateGame(id: string): string | null;
  deleteGame(id: string): string | null;
}

export interface LibraryDialog {
  open(): void;
  close(): void;
}

type Mode = { kind: 'idle' } | { kind: 'rename'; id: string } | { kind: 'delete'; id: string };

const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

function formatWhen(ms: number): string {
  return ms > 0 ? dateFormat.format(new Date(ms)) : '—';
}

function button(label: string, className = 'btn'): HTMLButtonElement {
  const b = h('button', className, label);
  b.type = 'button';
  return b;
}

export function createLibraryDialog(deps: LibraryDialogDeps): LibraryDialog {
  const overlay = h('div', 'modal-overlay');
  overlay.hidden = true;
  const box = h('div', 'modal lib-modal');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', T.title);
  const list = h('ul', 'lib-list');
  const error = h('p', 'lib-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const closeBtn = button(T.close);
  closeBtn.addEventListener('click', () => close());
  const foot = h('div', 'lib-foot');
  foot.append(closeBtn);
  box.append(h('h2', 'modal-title', T.title), h('p', 'modal-note', T.note), list, error, foot);
  overlay.append(box);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  document.body.append(overlay);

  let mode: Mode = { kind: 'idle' };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    if (mode.kind !== 'idle') {
      mode = { kind: 'idle' };
      render();
    } else close();
  };

  function showError(message: string | null): void {
    error.textContent = message ?? '';
    error.hidden = message === null;
  }

  /** Runs an action; on failure the message stays in the dialog, on success the list refreshes. */
  function run(action: () => string | null): void {
    const problem = action();
    showError(problem);
    mode = { kind: 'idle' };
    render();
  }

  function renameRow(entry: LibraryEntry): HTMLElement {
    const form = h('form', 'lib-rename');
    const input = h('input', 'lib-input');
    input.type = 'text';
    input.value = entry.name;
    input.maxLength = 80;
    input.setAttribute('aria-label', T.renameLabel);
    input.dataset.libRename = entry.id;
    const save = button(T.renameSave, 'btn primary');
    save.type = 'submit';
    const cancel = button(T.cancel);
    cancel.addEventListener('click', () => {
      mode = { kind: 'idle' };
      render();
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      run(() => deps.renameGame(entry.id, input.value));
    });
    form.append(input, save, cancel);
    queueMicrotask(() => {
      input.focus();
      input.select();
    });
    return form;
  }

  function deleteRow(entry: LibraryEntry, isCurrent: boolean): HTMLElement {
    const wrap = h('div', 'lib-confirm');
    wrap.setAttribute('role', 'group');
    const text = isCurrent ? T.confirmDeleteCurrent(entry.name) : T.confirmDelete(entry.name);
    const yes = button(T.confirmYes, 'btn danger-solid');
    yes.dataset.libConfirm = 'yes';
    yes.addEventListener('click', () => run(() => deps.deleteGame(entry.id)));
    const no = button(T.confirmNo);
    no.addEventListener('click', () => {
      mode = { kind: 'idle' };
      render();
    });
    wrap.append(h('span', 'lib-confirm-text', text), yes, no);
    queueMicrotask(() => no.focus());
    return wrap;
  }

  function actionsRow(entry: LibraryEntry): HTMLElement {
    const actions = h('div', 'lib-actions');
    const openBtn = button(T.open, 'btn primary');
    openBtn.dataset.libAction = 'open';
    openBtn.addEventListener('click', () => {
      const problem = deps.openGame(entry.id);
      if (problem === null) close();
      else showError(problem);
    });
    const rename = button(T.rename);
    rename.dataset.libAction = 'rename';
    rename.addEventListener('click', () => {
      showError(null);
      mode = { kind: 'rename', id: entry.id };
      render();
    });
    const dup = button(T.duplicate);
    dup.dataset.libAction = 'duplicate';
    dup.addEventListener('click', () => run(() => deps.duplicateGame(entry.id)));
    const del = button(T.remove, 'btn ghost');
    del.dataset.libAction = 'delete';
    del.addEventListener('click', () => {
      showError(null);
      mode = { kind: 'delete', id: entry.id };
      render();
    });
    actions.append(openBtn, rename, dup, del);
    return actions;
  }

  function render(): void {
    const entries = listGames();
    const currentId = getCurrentGameId();
    if (entries.length === 0) {
      list.replaceChildren(h('li', 'lib-empty', T.empty));
      return;
    }
    const rows = entries.map((entry) => {
      const isCurrent = entry.id === currentId;
      const li = h('li', isCurrent ? 'lib-row current' : 'lib-row');
      li.dataset.gameId = entry.id;
      const info = h('div', 'lib-info');
      const title = h('div', 'lib-title');
      title.append(h('b', 'lib-name', entry.name));
      if (isCurrent) title.append(h('span', 'lib-badge', T.current));
      info.append(title, h('small', 'lib-when', T.modified(formatWhen(entry.updatedAt))));
      li.append(info);
      if (mode.kind === 'rename' && mode.id === entry.id) li.append(renameRow(entry));
      else if (mode.kind === 'delete' && mode.id === entry.id) li.append(deleteRow(entry, isCurrent));
      else li.append(actionsRow(entry));
      return li;
    });
    list.replaceChildren(...rows);
  }

  function open(): void {
    // Edits waiting for the autosave timer must show up in the list.
    flushAutosave();
    mode = { kind: 'idle' };
    showError(null);
    render();
    overlay.hidden = false;
    window.addEventListener('keydown', onKey);
    (list.querySelector<HTMLElement>('[data-lib-action="open"]') ?? closeBtn).focus();
  }
  function close(): void {
    overlay.hidden = true;
    window.removeEventListener('keydown', onKey);
  }
  return { open, close };
}
