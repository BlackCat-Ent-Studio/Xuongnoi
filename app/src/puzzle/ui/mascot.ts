/**
 * The tutorial guide's mascot: Mèo Mun Chibi in a round frame that talks (types the line out while its
 * mouth flaps and its head nods) and blinks now and then. The guide only uses this interface, so the
 * guide and the talking cat can be built separately.
 */
export type MascotMood = 'normal' | 'happy';

export interface Mascot {
  /** The round frame element to place inside the guide bubble row. */
  readonly el: HTMLElement;
  /** Say a line: types it into `textEl` and animates the cat while typing. Replaces any line in progress. */
  talk(text: string, mood?: MascotMood): void;
  /** Show the whole current line at once and stop talking. */
  finish(): void;
  /** Pause rendering (guide hidden) or resume it. */
  setVisible(on: boolean): void;
  dispose(): void;
}

/**
 * Placeholder until the talking 3D cat lands: a static portrait and instant text.
 * `textEl` is where the line is written.
 */
export function createMascot(textEl: HTMLElement): Mascot {
  const el = document.createElement('div');
  el.className = 'pz-mascot-frame';
  let line = '';
  return {
    el,
    talk(text) {
      line = text;
      textEl.textContent = text;
    },
    finish() {
      textEl.textContent = line;
    },
    setVisible() {},
    dispose() {
      el.remove();
    },
  };
}
