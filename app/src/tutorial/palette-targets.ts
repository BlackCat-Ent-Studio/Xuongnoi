import type { TargetList } from './types';

const PALETTE_KIND = /\.palette-item\[data-kind="([^"]+)"\]/;

/** Node kinds a step points at in the palette, so the palette can reveal them first. */
export function paletteKinds(targets: TargetList): string[] {
  const kinds: string[] = [];
  for (const t of targets) {
    for (const sel of typeof t === 'string' ? [t] : t) {
      const m = PALETTE_KIND.exec(sel);
      if (m?.[1]) kinds.push(m[1]);
    }
  }
  return kinds;
}
