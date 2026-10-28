import { VIEW_MODES, type ViewMode } from '../engine/types';
import { h } from './dom';
import { MODE_HINTS, MODE_LABELS, TEXT_VI } from './text-vi';

export interface NewGameDialog {
  open(): void;
  close(): void;
}

export function createNewGameDialog(onPick: (mode: ViewMode) => void): NewGameDialog {
  const overlay = h('div', 'modal-overlay');
  overlay.hidden = true;
  const box = h('div', 'modal');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.append(h('h2', 'modal-title', TEXT_VI.newGameTitle), h('p', 'modal-note', TEXT_VI.newGameWarning));

  const choices = h('div', 'modal-choices');
  for (const mode of VIEW_MODES) {
    const btn = h('button', 'mode-choice');
    btn.type = 'button';
    btn.dataset.mode = mode;
    btn.append(h('strong', '', MODE_LABELS[mode]), h('span', '', MODE_HINTS[mode]));
    btn.addEventListener('click', () => {
      close();
      onPick(mode);
    });
    choices.append(btn);
  }
  const cancel = h('button', 'btn', TEXT_VI.cancel);
  cancel.type = 'button';
  cancel.addEventListener('click', () => close());
  box.append(choices, cancel);
  overlay.append(box);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close();
  });
  document.body.append(overlay);

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };

  function open(): void {
    overlay.hidden = false;
    window.addEventListener('keydown', onKey);
    overlay.querySelector<HTMLElement>('.mode-choice')?.focus();
  }
  function close(): void {
    overlay.hidden = true;
    window.removeEventListener('keydown', onKey);
  }
  return { open, close };
}
