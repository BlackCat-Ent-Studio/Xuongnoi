import type { ViewMode } from '../engine/types';
import { AUTOSAVE_DELAY_MS } from '../io/autosave';
import { h } from './dom';
import type { EditorState } from './editor-state';
import { icon } from './icons';
import { LAYOUT_PRESETS, type LayoutPreset } from './layout-model';
import { createMenuBar, type MenuDef } from './menu-bar';
import { PRESET_LABELS, SHELL_TEXT } from './shell-text-vi';
import { CONSOLE_TEXT } from './console/console-text-vi';
import { MODE_LABELS, TEXT_VI } from './text-vi';
import { UI_MODES, uiPrefs, type UiMode } from './theme/ui-prefs';
import { DEFAULT_2D, MODES_2D, VIEW_KINDS, modeForKind, remember2d, viewKindOf, type Mode2d } from './view-switch';

export interface TopBarDeps {
  state: EditorState;
  /** Tệp / Sửa / Xem / Trợ giúp, built by the app so every action stays next to its handler. */
  menus: MenuDef[];
  onPlay(): void;
  onStop(): void;
  /** Toggles pause/resume; the button label follows `setPaused`. Without it the button stays disabled. */
  onPause?: () => void;
  /** The 🐢 button: starts a step run, or goes on to the next step while the run is frozen at one. */
  onStep?: () => void;
  /** While playing the Chạy button turns into Chạy lại and calls this. */
  onRestart?: () => void;
  /** Every notify() is also reported here (the console log). */
  onNotify?: (text: string, kind: 'info' | 'error') => void;
  onHelp(): void;
  /** User picked a view (2D button, 3D button or the 2D kind switch); never called while playing. */
  onModeChange(mode: ViewMode): void;
  onPresetChange(preset: LayoutPreset): void;
  initialPreset: LayoutPreset;
}

export interface TopBar {
  el: HTMLElement;
  notify(text: string, kind?: 'info' | 'error'): void;
  /** Switches the pause button between Tạm dừng and Tiếp tục and enables Từng bước. */
  setPaused(paused: boolean): void;
  /** Step run state: while stepping the 🐢 button reads "▶ Tiếp" and is live only while frozen at a step. */
  setStepState(state: { stepping: boolean; waiting: boolean }): void;
  /** Insert an extra control at the start of the right-hand cluster. */
  addControl(control: HTMLElement): void;
  /** Keeps the layout select in sync when the preset changes elsewhere. */
  setPreset(preset: LayoutPreset): void;
  /** Call on every document change; the status flips to saved once the autosave has had time to run. */
  noteDocumentChange(options: { saves: boolean }): void;
  /** Closes any open menu (e.g. when a dialog opens). */
  closeMenus(): void;
}

/** The mark sits on the navy bar in both themes, so it uses the bright port colours (circle = Đúng/Sai, square = Số). */
const LOGO_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="6" fill="#0f1a2d" stroke="#7a8aa6"/><circle cx="7" cy="8" r="2.4" fill="#f7d046"/><rect x="14.6" y="13.6" width="4.8" height="4.8" rx="1" fill="#5aa9ff"/><path d="M9.2 8c4 0 2.4 8 5.6 8" stroke="#f1f4f9" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>';

const UI_MODE_LABEL: Record<UiMode, string> = { student: SHELL_TEXT.uiModeStudent, teacher: SHELL_TEXT.uiModeTeacher };
const UI_MODE_TIP: Record<UiMode, string> = { student: SHELL_TEXT.uiModeStudentTip, teacher: SHELL_TEXT.uiModeTeacherTip };

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
  // View segmented control: [2D] [3D]. The small select beside it picks which 2D view the 2D button uses.
  let last2d: Mode2d = remember2d(state.getMode(), DEFAULT_2D);
  const seg = h('div', 'seg');
  seg.setAttribute('role', 'radiogroup');
  seg.setAttribute('aria-label', SHELL_TEXT.modeGroupAria);
  const segOpts = VIEW_KINDS.map((kind) => {
    const b = h('button', 'seg-opt');
    b.type = 'button';
    b.dataset.mode = kind;
    b.dataset.tut = `view-${kind}`;
    b.setAttribute('role', 'radio');
    b.textContent = SHELL_TEXT.modeKind[kind];
    b.addEventListener('click', () => {
      if (state.isPlaying() || viewKindOf(state.getMode()) === kind) return;
      deps.onModeChange(modeForKind(kind, last2d));
    });
    return b;
  });
  seg.append(...segOpts);
  seg.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (dir === 0 || state.isPlaying()) return;
    e.preventDefault();
    const next = segOpts[(VIEW_KINDS.indexOf(viewKindOf(state.getMode())) + dir + segOpts.length) % segOpts.length]!;
    next.focus();
    next.click();
  });

  const sub2d = h('select', 'sel-ui sub2d');
  sub2d.setAttribute('aria-label', SHELL_TEXT.sub2dAria);
  sub2d.dataset.tut = 'view-2d-kind';
  const sub2dOpts = MODES_2D.map((m) => {
    const o = h('option', '');
    o.value = m;
    sub2d.append(o);
    return o;
  });
  // Bigger buttons leave less room, so the 2D view picker is shortened to its arrow sooner than it used to be.
  const narrow = window.matchMedia('(max-width: 1400px)');
  const labelSub2d = (): void => {
    MODES_2D.forEach((m, i) => {
      sub2dOpts[i]!.textContent = (narrow.matches ? SHELL_TEXT.sub2dShort : SHELL_TEXT.sub2dFull)[m];
    });
  };
  labelSub2d();
  narrow.addEventListener('change', labelSub2d);
  sub2d.addEventListener('change', () => {
    if (state.isPlaying()) return;
    last2d = sub2d.value as Mode2d;
    if (viewKindOf(state.getMode()) === '2d' && state.getMode() !== last2d) deps.onModeChange(last2d);
    sync();
  });

  const left = h('div', 'tb-left');
  left.append(brand, menuBar.el, nameInput, seg, sub2d);

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
  const playLabel = playBtn.querySelector('span') as HTMLSpanElement;
  playBtn.addEventListener('click', () => (state.isPlaying() ? deps.onRestart?.() : deps.onPlay()));
  const pauseBtn = pbtn(SHELL_TEXT.pause, CONSOLE_TEXT.pauseTip, 'pause');
  const pauseLabel = pauseBtn.querySelector('span') as HTMLSpanElement;
  const stepBtn = h('button', 'pbtn step-btn');
  stepBtn.type = 'button';
  stepBtn.dataset.tut = 'step';
  stepBtn.append(h('span', '', SHELL_TEXT.step));
  const stepLabel = stepBtn.querySelector('span') as HTMLSpanElement;
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
  helpBtn.classList.add('tb-help'); // folds away on tablet-width bars; the Trợ giúp menu still has it
  helpBtn.addEventListener('click', deps.onHelp);

  const layoutSel = h('select', 'sel-ui tb-layout');
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
  const syncSaveTip = (): void => {
    save.title = saveLabel.textContent ?? '';
  };

  const status = h('div', 'status');
  status.setAttribute('role', 'status');
  let statusTimer = 0;

  // Display mode (Học sinh | Giáo viên) and light / dark theme; both are remembered per device.
  const prefs = uiPrefs();
  const modeSeg = h('div', 'seg ui-mode');
  modeSeg.setAttribute('role', 'radiogroup');
  modeSeg.setAttribute('aria-label', SHELL_TEXT.uiModeAria);
  const modeOpts = UI_MODES.map((m) => {
    const b = h('button', 'seg-opt', UI_MODE_LABEL[m]);
    b.type = 'button';
    b.dataset.uiMode = m;
    b.title = UI_MODE_TIP[m];
    b.setAttribute('role', 'radio');
    b.addEventListener('click', () => prefs.setMode(m));
    return b;
  });
  modeSeg.append(...modeOpts);
  modeSeg.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (dir === 0) return;
    e.preventDefault();
    const next = modeOpts[(UI_MODES.indexOf(prefs.mode()) + dir + modeOpts.length) % modeOpts.length]!;
    next.focus();
    next.click();
  });
  const themeBtn = h('button', 'icobtn ui-theme');
  themeBtn.type = 'button';
  themeBtn.dataset.act = 'theme';
  themeBtn.addEventListener('click', () => prefs.toggleTheme());
  function syncLook(): void {
    UI_MODES.forEach((m, i) => {
      const on = prefs.mode() === m;
      modeOpts[i]!.setAttribute('aria-checked', String(on));
      modeOpts[i]!.tabIndex = on ? 0 : -1;
    });
    const dark = prefs.theme() === 'dark';
    const label = dark ? SHELL_TEXT.themeToLight : SHELL_TEXT.themeToDark;
    themeBtn.title = label;
    themeBtn.setAttribute('aria-label', label);
    themeBtn.replaceChildren(icon(dark ? 'sun' : 'moon'));
  }
  prefs.subscribe(syncLook);
  syncLook();

  const right = h('div', 'tb-right');
  right.append(undoBtn, redoBtn, layoutSel, save, helpBtn, modeSeg, themeBtn);

  el.append(left, play, right, status);

  // ---------- state sync ----------
  let paused = false;
  let stepping = false;
  let stepWaiting = false;
  function sync(): void {
    const playing = state.isPlaying();
    if (!playing) {
      paused = false;
      stepping = false;
      stepWaiting = false;
    }
    el.classList.toggle('playing', playing);
    el.classList.toggle('paused', paused);
    pstate.textContent = !playing ? SHELL_TEXT.stateEditing : paused ? CONSOLE_TEXT.statePaused : SHELL_TEXT.statePlaying;
    playLabel.textContent = playing ? CONSOLE_TEXT.restart : SHELL_TEXT.play;
    playBtn.title = playing ? CONSOLE_TEXT.restartTip : SHELL_TEXT.playTip;
    playBtn.setAttribute('aria-label', playLabel.textContent);
    playBtn.disabled = playing && !deps.onRestart;
    stopBtn.disabled = !playing;
    pauseBtn.disabled = !playing || !deps.onPause;
    pauseLabel.textContent = paused ? CONSOLE_TEXT.resume : SHELL_TEXT.pause;
    pauseBtn.title = paused ? CONSOLE_TEXT.resumeTip : CONSOLE_TEXT.pauseTip;
    pauseBtn.setAttribute('aria-label', pauseLabel.textContent);
    const stepText = stepping ? SHELL_TEXT.stepNext : SHELL_TEXT.step;
    const stepTip = stepping ? CONSOLE_TEXT.stepNextTip : CONSOLE_TEXT.stepTip;
    stepLabel.textContent = stepText;
    stepBtn.title = stepTip;
    stepBtn.setAttribute('aria-label', stepTip);
    stepBtn.disabled = !deps.onStep || (stepping && !stepWaiting);
    const mode = state.getMode();
    const locked = playing;
    last2d = remember2d(mode, last2d);
    seg.title = locked ? SHELL_TEXT.modeLockedTip : '';
    seg.classList.toggle('locked', locked);
    segOpts.forEach((b, i) => {
      const kind = VIEW_KINDS[i]!;
      const on = viewKindOf(mode) === kind;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      b.disabled = locked;
      const target = modeForKind(kind, last2d);
      b.title = locked ? SHELL_TEXT.modeLockedTip : MODE_LABELS[target];
      b.setAttribute('aria-label', MODE_LABELS[target]);
    });
    sub2d.value = last2d;
    sub2d.disabled = locked;
    sub2d.hidden = viewKindOf(mode) !== '2d';
    sub2d.title = locked ? SHELL_TEXT.modeLockedTip : SHELL_TEXT.sub2dAria;
    undoBtn.disabled = !state.canUndo();
    redoBtn.disabled = !state.canRedo();
    if (document.activeElement !== nameInput) nameInput.value = state.getBoard().name;
  }
  state.subscribe((k) => {
    if (k === 'board') last2d = DEFAULT_2D;
    if (k === 'playing' || k === 'board' || k === 'name' || k === 'history' || k === 'mode') sync();
  });
  sync();

  let saveTimer = 0;
  function showSaved(): void {
    save.classList.remove('saving');
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    saveLabel.textContent = `${SHELL_TEXT.saveStatusSaved} ${hh}:${mm}`;
    syncSaveTip();
  }
  showSaved();

  return {
    el,
    closeMenus: () => menuBar.close(),
    setPaused(next) {
      paused = next && state.isPlaying();
      sync();
    },
    setStepState(next) {
      stepping = next.stepping && state.isPlaying();
      stepWaiting = stepping && next.waiting;
      sync();
    },
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
        syncSaveTip();
        return;
      }
      save.classList.add('saving');
      saveTimer = window.setTimeout(showSaved, AUTOSAVE_DELAY_MS + 100);
    },
    notify(text, kind = 'info') {
      deps.onNotify?.(text, kind);
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
