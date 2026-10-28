import type { InputSnapshot } from '../engine/types';
import { isTypingTarget } from './dom';

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export interface KeyboardInput {
  /** Current keys held. Returns a copy so callers never see later changes. */
  snapshot(): InputSnapshot;
  /** Start listening (play mode). */
  attach(): void;
  /** Stop listening and release all keys. */
  detach(): void;
}

export function createKeyboardInput(): KeyboardInput {
  const down = new Set<string>();
  let attached = false;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (isTypingTarget(e.target)) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    down.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (GAME_KEYS.has(e.code) && !isTypingTarget(e.target)) e.preventDefault();
    down.delete(e.code);
  };
  const clear = (): void => down.clear();
  const onVisibility = (): void => {
    if (document.hidden) down.clear();
  };

  return {
    snapshot: () => ({ keysDown: new Set(down) }),
    attach() {
      if (attached) return;
      attached = true;
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clear);
      document.addEventListener('visibilitychange', onVisibility);
    },
    detach() {
      if (!attached) return;
      attached = false;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVisibility);
      down.clear();
    },
  };
}
