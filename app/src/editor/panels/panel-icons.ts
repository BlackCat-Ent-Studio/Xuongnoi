import type { NodeCategory } from '../../engine/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Inner SVG markup on a 24px grid, 1.8 stroke. Same shapes as the mockup icon set. */
const PATHS: Record<string, string> = {
  input: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h1.5M11.2 10h1.5M15.5 10h1.5M8 14h8"/>',
  logic:
    '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6h2.5a3 3 0 0 1 3 3v0a3 3 0 0 0 3 3H16M8 18h2.5a3 3 0 0 0 3-3v0a3 3 0 0 1 3-3"/>',
  math: '<path d="M4.5 7.5h5M7 5v5M14.5 7.5h5M5 15l4 4M9 15l-4 4M14.5 15.5h5M14.5 18.5h5"/>',
  object: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  action: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  brain:
    '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/><path d="M10.5 12h3"/>',
  output: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  trash:
    '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>',
  wire: '<rect x="2.5" y="4" width="7" height="6" rx="1.5"/><rect x="14.5" y="14" width="7" height="6" rx="1.5"/><path d="M9.5 7c5 0 0 10 5 10"/>',
  play: '<path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.3-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7z"/>',
};

export type PanelIconName = NodeCategory | 'chev' | 'search' | 'close' | 'plus' | 'minus' | 'copy' | 'trash' | 'wire' | 'play';

export function panelIcon(name: PanelIconName): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'pn-ic');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = PATHS[name] ?? '';
  return svg;
}

/** Rounded tile holding a category icon. The colour comes from the pn-cc-* class in panels.css. */
export function categoryTile(cat: string, large = false): HTMLElement {
  const tile = document.createElement('span');
  tile.className = `pn-tile pn-cc-${cat}${large ? ' pn-tile-lg' : ''}`;
  if (cat in PATHS) tile.append(panelIcon(cat as NodeCategory));
  return tile;
}
