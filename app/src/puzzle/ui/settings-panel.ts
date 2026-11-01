import { h } from '../../editor/dom';
import { getSettings, setSettings, type PuzzleSettings } from './settings';
import { PUZZLE_UI_TEXT as T } from './puzzle-text';

export interface SettingsPanelOptions {
  /** Wipes the saved stars and the "guide seen" memory. The panel only asks; the page does the wiping. */
  onReset(): void;
  onClose?(): void;
}

function switchRow(label: string, key: keyof PuzzleSettings): { row: HTMLElement; toggle: HTMLButtonElement } {
  const row = h('div', 'pz-set-row');
  const text = h('span', 'pz-set-label', label);
  const toggle = h('button', 'pz-switch');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-label', label);
  const sync = (): void => toggle.setAttribute('aria-checked', String(getSettings()[key]));
  sync();
  toggle.addEventListener('click', () => {
    setSettings({ [key]: !getSettings()[key] });
    sync();
  });
  row.append(text, toggle);
  return { row, toggle };
}

/**
 * Opens the settings dialog on top of `host` (a screen frame, which must be positioned and a size container).
 * Returns a function that closes it. Everything happens in the page: no browser dialogs.
 */
export function openSettings(host: HTMLElement, opts: SettingsPanelOptions): () => void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const modal = h('div', 'pz-modal');
  const panel = h('div', 'pz-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', T.settingsTitle);

  const music = switchRow(T.music, 'music');
  const sfx = switchRow(T.sfx, 'sfx');

  const status = h('p', 'pz-set-status');
  status.setAttribute('role', 'status');

  // "Xoá tiến độ" first asks inside the panel; only the second button wipes.
  const resetBtn = h('button', 'pz-btn ghost pz-set-reset', T.resetProgress);
  resetBtn.type = 'button';
  const confirm = h('div', 'pz-set-confirm');
  confirm.hidden = true;
  const ask = h('p', 'pz-set-ask');
  ask.append(h('b', '', T.resetAsk), h('span', '', T.resetAskNote));
  const yes = h('button', 'pz-btn danger', T.resetYes);
  yes.type = 'button';
  const no = h('button', 'pz-btn ghost', T.resetNo);
  no.type = 'button';
  const confirmRow = h('div', 'pz-set-btns');
  confirmRow.append(yes, no);
  confirm.append(ask, confirmRow);

  function askReset(open: boolean): void {
    confirm.hidden = !open;
    resetBtn.hidden = open;
    status.textContent = '';
    (open ? no : resetBtn).focus();
  }
  resetBtn.addEventListener('click', () => askReset(true));
  no.addEventListener('click', () => askReset(false));
  yes.addEventListener('click', () => {
    opts.onReset();
    askReset(false);
    status.textContent = T.resetDone;
  });

  const editor = h('a', 'pz-link', T.toEditor);
  editor.href = 'index.html';
  const close = h('button', 'pz-btn run', T.closeSettings);
  close.type = 'button';

  const foot = h('div', 'pz-set-foot');
  foot.append(editor, close);
  panel.append(h('h3', '', T.settingsTitle), music.row, sfx.row, resetBtn, confirm, status, foot);
  modal.append(panel);
  host.append(modal);
  music.toggle.focus();

  let closed = false;
  function closeNow(): void {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    modal.remove();
    opener?.focus?.();
    opts.onClose?.();
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeNow();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep Tab inside the dialog.
    const items = [...panel.querySelectorAll<HTMLElement>('button, a[href]')].filter((el) => !el.closest('[hidden]') && !(el as HTMLButtonElement).hidden);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }
  document.addEventListener('keydown', onKey, true);
  close.addEventListener('click', closeNow);
  modal.addEventListener('pointerdown', (e) => {
    if (e.target === modal) closeNow();
  });
  return closeNow;
}
