import { AUTOSAVE_DELAY_MS } from '../io/autosave';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { icon } from './icons';
import { LAYOUT_PRESETS, type LayoutPreset } from './layout-model';
import { createMenuBar, type MenuDef } from './menu-bar';
import { PRESET_LABELS, SHELL_TEXT } from './shell-text-vi';
import { TEXT_VI } from './text-vi';

export interface TopBarDeps {
  state: EditorState;
  /** Tệp / Sửa / Xem / Trợ giúp, built by the app so every action stays next to its handler. */
  menus: MenuDef[];
  onPlay(): void;
  onStop(): void;
  /** Wired by the play-state feature; until then the button stays disabled with a tooltip. */
  onPause?: () => void;
  onStep?: () => void;
  onHelp(): void;
  onPresetChange(preset: LayoutPreset): void;
  initialPreset: LayoutPreset;
}

export interface TopBar {
  el: HTMLElement;
  notify(text: string, kind?: 'info' | 'error'): void;
  /** Insert an extra control at the start of the right-hand cluster. */
  addControl(control: HTMLElement): void;
  /** Keeps the layout select in sync when the preset changes elsewhere. */
  setPreset(preset: LayoutPreset): void;
  /** Call on every document change; the status flips to saved once the autosave has had time to run. */
  noteDocumentChange(options: { saves: boolean }): void;
  /** Closes any open menu (e.g. when a dialog opens). */
  closeMenus(): void;
}

const LOGO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#23272e" stroke="#3a404a"/><circle cx="7" cy="8" r="2.2" fill="#3ecf8e"/><rect x="14.8" y="13.8" width="4.4" height="4.4" rx="1" fill="#e7e9ec"/><path d="M9 8c4 0 2.5 8 5.8 8" stroke="#3ecf8e" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';

export function createTopBar(deps: TopBarDeps): TopBar {
  const { state } = deps;
  const el = h('header', 'topbar');

  // ---------- left: logo, menus, game name ----------
  const brand = h('div', 'brand');
  brand.setAttribute('aria-label', TEXT_VI.appName);
  const logo = h('span', 'brand-logo');
  logo.innerHTML = LOGO_SVG; // constant markup, no user data
  brand.append(logo, h('span', 'brand-name', TEXT_VI.appName));
  const menuBar = createMenuBar(deps.menus, SHELL_TEXT.menuAria);

  const nameInput = h('input', 'name-input');
  nameInput.type = 'text';
  nameInput.maxLength = 60;
  nameInput.setAttribute('aria-label', SHELL_TEXT.gameNameLabel);
  nameInput.title = SHELL_TEXT.gameNameLabel;
  nameInput.addEventListener('input', () => state.setName(nameInput.value));
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });
  nameInput.addEventListener('blur', () => {
    if (nameInput.value.trim() === '') {
      nameInput.value = TEXT_VI.defaultBoardName;
      state.setName(TEXT_VI.defaultBoardName);
    }
  });
  const left = h('div', 'tb-left');
  left.append(brand, menuBar.el, nameInput);

  // ---------- centre: play cluster ----------
  const pstate = h('span', 'pstate');
  pstate.setAttribute('aria-live', 'polite');
  const pbtn = (label: string, tip: string, ic: 'play' | 'pause' | 'step' | 'stop', extra = ''): HTMLButtonElement => {
    const b = h('button', `pbtn ${extra}`.trim());
    b.type = 'button';
    b.title = tip;
    b.setAttribute('aria-label', label);
    b.append(icon(ic, true), h('span', '', label));
    return b;
  };
  const playBtn = pbtn(SHELL_TEXT.play, SHELL_TEXT.playTip, 'play', 'primary');
  playBtn.id = 'btn-play';
  playBtn.dataset.tut = 'play';
  playBtn.addEventListener('click', deps.onPlay);
  const pauseBtn = pbtn(SHELL_TEXT.pause, SHELL_TEXT.pauseTip, 'pause');
  const stepBtn = pbtn(SHELL_TEXT.step, SHELL_TEXT.stepTip, 'step');
  const stopBtn = pbtn(SHELL_TEXT.stop, SHELL_TEXT.stopTip, 'stop', 'stop');
  stopBtn.addEventListener('click', deps.onStop);
  if (deps.onPause) pauseBtn.addEventListener('click', deps.onPause);
  if (deps.onStep) stepBtn.addEventListener('click', deps.onStep);
  const play = h('div', 'play');
  play.setAttribute('role', 'toolbar');
  play.setAttribute('aria-label', SHELL_TEXT.playGroupAria);
  play.append(pstate, playBtn, pauseBtn, stepBtn, stopBtn);

  // ---------- right: undo/redo, layout, save status, help ----------
  const iconBtn = (ic: 'undo' | 'redo' | 'help', label: string, act?: string): HTMLButtonElement => {
    const b = h('button', 'icobtn');
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    if (act) b.dataset.act = act;
    b.append(icon(ic));
    return b;
  };
  const undoBtn = iconBtn('undo', SHELL_TEXT.undo, 'undo');
  undoBtn.addEventListener('click', () => state.undo());
  const redoBtn = iconBtn('redo', SHELL_TEXT.redo, 'redo');
  redoBtn.addEventListener('click', () => state.redo());
  const helpBtn = iconBtn('help', SHELL_TEXT.helpButton);
  helpBtn.addEventListener('click', deps.onHelp);

  const layoutSel = h('select', 'sel-ui');
  layoutSel.setAttribute('aria-label', SHELL_TEXT.layoutLabel);
  layoutSel.title = SHELL_TEXT.layoutLabel;
  for (const p of LAYOUT_PRESETS) {
    const o = h('option', '', `${SHELL_TEXT.layoutPrefix}${PRESET_LABELS[p]}`);
    o.value = p;
    layoutSel.append(o);
  }
  layoutSel.value = deps.initialPreset;
  layoutSel.addEventListener('change', () => deps.onPresetChange(layoutSel.value as LayoutPreset));

  const save = h('span', 'save');
  save.setAttribute('aria-live', 'polite');
  const saveLabel = h('span', 'save-label');
  save.append(h('i'), saveLabel);

  const status = h('div', 'status');
  status.setAttribute('role', 'status');
  let statusTimer = 0;

  const right = h('div', 'tb-right');
  right.append(undoBtn, redoBtn, layoutSel, save, helpBtn);

  el.append(left, play, right, status);

  // ---------- state sync ----------
  function sync(): void {
    const playing = state.isPlaying();
    el.classList.toggle('playing', playing);
    pstate.textContent = playing ? SHELL_TEXT.statePlaying : SHELL_TEXT.stateEditing;
    playBtn.disabled = playing;
    stopBtn.disabled = !playing;
    pauseBtn.disabled = !playing || !deps.onPause;
    stepBtn.disabled = !playing || !deps.onStep;
    undoBtn.disabled = !state.canUndo();
    redoBtn.disabled = !state.canRedo();
    if (document.activeElement !== nameInput) nameInput.value = state.getBoard().name;
  }
  state.subscribe((k) => {
    if (k === 'playing' || k === 'board' || k === 'name' || k === 'history') sync();
  });
  sync();

  let saveTimer = 0;
  function showSaved(): void {
    save.classList.remove('saving');
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    saveLabel.textContent = `${SHELL_TEXT.saveStatusSaved} ${hh}:${mm}`;
  }
  showSaved();

  return {
    el,
    closeMenus: () => menuBar.close(),
    addControl(control) {
      right.prepend(control);
    },
    setPreset(preset) {
      layoutSel.value = preset;
    },
    noteDocumentChange({ saves }) {
      window.clearTimeout(saveTimer);
      if (!saves) {
        save.classList.add('saving');
        saveLabel.textContent = SHELL_TEXT.saveStatusLesson;
        return;
      }
      save.classList.add('saving');
      saveTimer = window.setTimeout(showSaved, AUTOSAVE_DELAY_MS + 100);
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
