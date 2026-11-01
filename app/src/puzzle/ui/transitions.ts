import { h } from '../../editor/dom';
import { playSfx } from './sound';

/**
 * Swaps whole screens with a soft fade and a small slide (opacity and transform only, no filters).
 * The old screen fades out, is torn down, then the new one is built and fades in. With reduced motion
 * the swap is immediate. A newer request replaces one that is still waiting.
 */
export interface ScreenHost {
  /** `mount` fills the fresh container and returns its teardown. `dir`: 1 slides forward, -1 back, 0 only fades. */
  show(mount: (el: HTMLElement) => (() => void) | void, dir: -1 | 0 | 1): void;
}

const OUT_MS = 150;

const reduced = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createScreenHost(root: HTMLElement): ScreenHost {
  let current: { el: HTMLElement; teardown: (() => void) | void } | null = null;
  let token = 0;

  function build(mount: (el: HTMLElement) => (() => void) | void, dir: -1 | 0 | 1, animate: boolean): void {
    if (current) {
      current.teardown?.();
      current.el.remove();
      current = null;
    }
    const el = h('div', 'pz-view');
    el.dataset.dir = String(dir);
    root.append(el);
    current = { el, teardown: undefined };
    current.teardown = mount(el);
    if (animate) {
      el.classList.add('is-in');
      el.addEventListener('animationend', () => el.classList.remove('is-in'), { once: true });
    }
  }

  return {
    show(mount, dir) {
      const mine = ++token;
      if (!current || reduced()) {
        build(mount, dir, false);
        return;
      }
      current.el.dataset.dir = String(dir);
      current.el.classList.add('is-out');
      playSfx('page');
      window.setTimeout(() => {
        if (mine === token) build(mount, dir, true);
      }, OUT_MS);
    },
  };
}
