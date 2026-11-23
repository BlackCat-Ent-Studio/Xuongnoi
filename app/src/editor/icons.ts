/** Inline SVG icon sprite (24px grid, 1.8 stroke, round joins). Mount once, then reference with icon(). */
const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-input" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h1.5M11.2 10h1.5M15.5 10h1.5M8 14h8"/></symbol>
  <symbol id="i-logic" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M8 6h2.5a3 3 0 0 1 3 3v0a3 3 0 0 0 3 3H16M8 18h2.5a3 3 0 0 0 3-3v0a3 3 0 0 1 3-3"/></symbol>
  <symbol id="i-math" viewBox="0 0 24 24"><path d="M4.5 7.5h5M7 5v5M14.5 7.5h5M5 15l4 4M9 15l-4 4M14.5 15.5h5M14.5 18.5h5"/></symbol>
  <symbol id="i-object" viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></symbol>
  <symbol id="i-action" viewBox="0 0 24 24"><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/></symbol>
  <symbol id="i-brain" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/><path d="M10.5 12h3"/></symbol>
  <symbol id="i-output" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.3-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7z"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></symbol>
  <symbol id="i-step" viewBox="0 0 24 24"><path d="M5 5.6v12.8a.7.7 0 0 0 1.1.6l9.4-6.4a.7.7 0 0 0 0-1.2L6.1 5a.7.7 0 0 0-1.1.6z"/><rect x="17" y="5" width="2.6" height="14" rx="1"/></symbol>
  <symbol id="i-stop" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></symbol>
  <symbol id="i-restart" viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4h4"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/></symbol>
  <symbol id="i-chev" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
  <symbol id="i-fit" viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/></symbol>
  <symbol id="i-arrange" viewBox="0 0 24 24"><rect x="3" y="4" width="6" height="5" rx="1"/><rect x="3" y="15" width="6" height="5" rx="1"/><rect x="15" y="9.5" width="6" height="5" rx="1"/><path d="M9 6.5h2.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9M13 12h2"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
  <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.6M12 17v.01"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></symbol>
  <symbol id="i-warn" viewBox="0 0 24 24"><path d="M10.3 4.2L2.8 17.5A2 2 0 0 0 4.5 20.5h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17v.01"/></symbol>
  <symbol id="i-error" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.01"/></symbol>
  <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><path d="M6 10l-1-5 4 2.5h6L19 5l-1 5"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M6 14.5c0 3 2.7 5.5 6 5.5s6-2.5 6-5.5"/></symbol>
  <symbol id="i-box" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9"/></symbol>
  <symbol id="i-coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M14.5 9.5h-3.2a1.5 1.5 0 0 0 0 3h1.4a1.5 1.5 0 0 1 0 3H9.5"/></symbol>
  <symbol id="i-enemy" viewBox="0 0 24 24"><path d="M4 18c0-4.5 3.6-8.5 8-8.5s8 4 8 8.5z"/><path d="M6 10.5L5 6l3.2 2.6M18 10.5L19 6l-3.2 2.6M12 9.5V5"/><path d="M9.5 14.5h.01M14.5 14.5h.01"/></symbol>
  <symbol id="i-flag" viewBox="0 0 24 24"><path d="M5 21V4M5 4.5h12l-2.5 4 2.5 4H5"/></symbol>
  <symbol id="i-camera" viewBox="0 0 24 24"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/></symbol>
  <symbol id="i-layers" viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></symbol>
  <symbol id="i-ground" viewBox="0 0 24 24"><path d="M3 15h18M3 19h18"/><path d="M6 15v4M12 15v4M18 15v4"/><path d="M7 11l3-4 3 3 2-2 3 3"/></symbol>
  <symbol id="i-expand" viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5V5.5M8 7.5h8"/></symbol>
  <symbol id="i-term" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12.5 15H17"/></symbol>
  <symbol id="i-tree" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="10" width="7" height="5" rx="1"/><rect x="14" y="17" width="7" height="4" rx="1"/><path d="M6.5 8v11H14M6.5 12.5H14"/></symbol>
  <symbol id="i-blocks" viewBox="0 0 24 24"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><path d="M17 13.5v7M13.5 17h7"/></symbol>
  <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></symbol>
  <symbol id="i-game" viewBox="0 0 24 24"><rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3M15.5 11.5h.01M17.5 13.5h.01"/></symbol>
  <symbol id="i-graph" viewBox="0 0 24 24"><rect x="2.5" y="4" width="7" height="6" rx="1.5"/><rect x="14.5" y="14" width="7" height="6" rx="1.5"/><path d="M9.5 7c5 0 0 10 5 10"/></symbol>
  <symbol id="i-layout" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M9 14h12"/></symbol>
  <symbol id="i-undo" viewBox="0 0 24 24"><path d="M9 5L4 10l5 5"/><path d="M4 10h10.5a5 5 0 0 1 0 10H11"/></symbol>
  <symbol id="i-redo" viewBox="0 0 24 24"><path d="M15 5l5 5-5 5"/><path d="M20 10H9.5a5 5 0 0 0 0 10H13"/></symbol>
  <symbol id="i-folder" viewBox="0 0 24 24"><path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2.5h8.5A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/></symbol>
  <symbol id="i-save" viewBox="0 0 24 24"><path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9L3.5 9.7l5.9-.8z"/></symbol>
  <symbol id="i-keyboard" viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M7 14h10"/></symbol>
  <symbol id="i-note" viewBox="0 0 24 24"><path d="M5 4h14v10l-5 6H5z"/><path d="M14 20v-5a1 1 0 0 1 1-1h4M8.5 8.5h7M8.5 12h4"/></symbol>
</svg>`;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Ids of the symbols in the sprite above (without the "i-" prefix). */
export type IconName =
  | 'input' | 'logic' | 'math' | 'object' | 'action' | 'brain' | 'output'
  | 'play' | 'pause' | 'step' | 'stop' | 'restart' | 'search' | 'chev' | 'plus' | 'minus'
  | 'fit' | 'arrange' | 'check' | 'help' | 'trash' | 'copy' | 'warn' | 'error' | 'info'
  | 'eye' | 'close' | 'user' | 'box' | 'coin' | 'enemy' | 'flag' | 'camera' | 'layers'
  | 'ground' | 'expand' | 'book' | 'term' | 'tree' | 'blocks' | 'sliders' | 'game'
  | 'graph' | 'layout' | 'undo' | 'redo' | 'folder' | 'save' | 'download' | 'star' | 'keyboard' | 'note';

let mounted = false;

/** Injects the sprite into the page once; safe to call repeatedly. */
export function mountIconSprite(doc: Document = document): void {
  if (mounted && doc.getElementById('i-play')) return;
  const tpl = doc.createElement('template');
  tpl.innerHTML = SPRITE;
  doc.body.prepend(tpl.content);
  mounted = true;
}

/** Creates an icon element. `filled` uses solid shapes (play/pause/stop) instead of outlines. */
export function icon(name: IconName, filled = false): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', filled ? 'ic f' : 'ic');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}
