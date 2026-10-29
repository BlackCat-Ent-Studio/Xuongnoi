import { VIEW_MODES, type Board, type ViewMode } from '../engine/types';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { MODE_LABELS, TEXT_VI } from './text-vi';

export interface TopBarDeps {
  state: EditorState;
  samples: () => { id: string; label: string; board: Board }[];
  onNew(): void;
  onTogglePlay(): void;
  onSave(): void;
  onOpenFile(): void;
  onOpenSample(board: Board): void;
  onChangeMode(mode: ViewMode): void;
  onAddNote(): void;
}

export interface TopBar {
  el: HTMLElement;
  notify(text: string, kind?: 'info' | 'error'): void;
  /** Insert an extra control right after the "Mở" menu. */
  addControl(control: HTMLElement): void;
}

export function createTopBar(deps: TopBarDeps): TopBar {
  const { state } = deps;
  const el = h('header', 'topbar');
  const brand = h('div', 'brand', TEXT_VI.appName);

  const btn = (label: string, cls: string, onClick: () => void): HTMLButtonElement => {
    const b = h('button', `btn ${cls}`, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };

  const newBtn = btn(TEXT_VI.newGame, '', deps.onNew);
  const playBtn = btn(TEXT_VI.play, 'primary', deps.onTogglePlay);
  playBtn.id = 'btn-play';
  playBtn.dataset.tut = 'play';
  const saveBtn = btn(TEXT_VI.save, '', deps.onSave);
  const undoBtn = btn(TEXT_VI.undo, '', () => state.undo());
  undoBtn.title = TEXT_VI.undoTip;
  undoBtn.dataset.act = 'undo';
  const redoBtn = btn(TEXT_VI.redo, '', () => state.redo());
  redoBtn.title = TEXT_VI.redoTip;
  redoBtn.dataset.act = 'redo';
  const noteBtn = btn(TEXT_VI.addNote, '', deps.onAddNote);
  noteBtn.title = TEXT_VI.addNoteTip;
  noteBtn.dataset.act = 'add-note';

  // Open menu
  const openWrap = h('div', 'menu-wrap');
  const openBtn = btn(`${TEXT_VI.open} ▾`, '', () => toggleMenu());
  const menu = h('div', 'menu');
  menu.hidden = true;
  openWrap.append(openBtn, menu);

  function closeMenu(): void {
    menu.hidden = true;
  }
  function toggleMenu(): void {
    if (!menu.hidden) return closeMenu();
    menu.replaceChildren();
    const fileItem = h('button', 'menu-item', TEXT_VI.openFile);
    fileItem.type = 'button';
    fileItem.addEventListener('click', () => {
      closeMenu();
      deps.onOpenFile();
    });
    menu.append(fileItem, h('div', 'menu-sep', TEXT_VI.samples));
    const samples = deps.samples();
    if (samples.length === 0) menu.append(h('div', 'menu-empty', TEXT_VI.noSamples));
    for (const s of samples) {
      const item = h('button', 'menu-item', s.label);
      item.type = 'button';
      item.dataset.sample = s.id;
      item.addEventListener('click', () => {
        closeMenu();
        deps.onOpenSample(s.board);
      });
      menu.append(item);
    }
    menu.hidden = false;
  }
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && e.target instanceof Node && !openWrap.contains(e.target)) closeMenu();
  });

  // View mode
  const modeWrap = h('label', 'field');
  modeWrap.append(h('span', '', TEXT_VI.viewAngle));
  const modeSel = h('select', 'mode-select');
  for (const m of VIEW_MODES) {
    const o = h('option', '', MODE_LABELS[m]);
    o.value = m;
    modeSel.append(o);
  }
  modeSel.addEventListener('change', () => deps.onChangeMode(modeSel.value as ViewMode));
  modeWrap.append(modeSel);

  // Name
  const nameWrap = h('label', 'field grow');
  nameWrap.append(h('span', '', TEXT_VI.boardName));
  const nameInput = h('input', 'name-input');
  nameInput.type = 'text';
  nameInput.maxLength = 60;
  nameInput.addEventListener('input', () => state.setName(nameInput.value));
  nameInput.addEventListener('blur', () => {
    if (nameInput.value.trim() === '') {
      nameInput.value = TEXT_VI.defaultBoardName;
      state.setName(TEXT_VI.defaultBoardName);
    }
  });
  nameWrap.append(nameInput);

  const status = h('div', 'status');
  status.setAttribute('role', 'status');
  let statusTimer = 0;

  el.append(brand, newBtn, playBtn, saveBtn, openWrap, undoBtn, redoBtn, noteBtn, modeWrap, nameWrap, status);

  function sync(): void {
    const playing = state.isPlaying();
    playBtn.textContent = playing ? TEXT_VI.edit : TEXT_VI.play;
    playBtn.classList.toggle('playing', playing);
    modeSel.disabled = playing;
    undoBtn.disabled = !state.canUndo();
    redoBtn.disabled = !state.canRedo();
    noteBtn.disabled = playing;
    modeSel.value = state.getMode();
    if (document.activeElement !== nameInput) nameInput.value = state.getBoard().name;
  }
  state.subscribe((k) => {
    if (k === 'playing' || k === 'mode' || k === 'board' || k === 'name' || k === 'history') sync();
  });
  sync();

  return {
    el,
    addControl(control) {
      openWrap.after(control);
    },
    notify(text, kind = 'info') {
      status.textContent = text;
      status.className = `status ${kind}`;
      window.clearTimeout(statusTimer);
      statusTimer = window.setTimeout(() => {
        status.textContent = '';
        status.className = 'status';
      }, 4000);
    },
  };
}
