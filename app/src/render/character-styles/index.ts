import { catStyle } from './cat';
import { chickStyle } from './chick';
import { dinoStyle } from './dino';
import { humanStyle } from './human';
import { jellyStyle } from './jelly';
import type { StyleDef } from './kit';
import { robotStyle } from './robot';

export { PartKit, localYRange, type StyleDef, type StyleRig } from './kit';

export const DEFAULT_LOOK = 'human';

/** Every character look, keyed by the value stored in the character node's `look` param. */
export const CHARACTER_STYLES: Readonly<Record<string, StyleDef>> = {
  human: humanStyle,
  robot: robotStyle,
  cat: catStyle,
  chick: chickStyle,
  jelly: jellyStyle,
  dino: dinoStyle,
};

/** Unknown or missing looks (old boards, hand-edited files) fall back to the default human. */
export function resolveLook(look: string | undefined): string {
  return look !== undefined && Object.prototype.hasOwnProperty.call(CHARACTER_STYLES, look) ? look : DEFAULT_LOOK;
}

export function styleFor(look: string | undefined): StyleDef {
  return CHARACTER_STYLES[resolveLook(look)] ?? humanStyle;
}
