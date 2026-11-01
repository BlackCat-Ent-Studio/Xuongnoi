import { backdropRoot, repeat, rng, type BackdropKind } from './backdrop-kit';

/** Theme A "Xưởng gỗ ấm áp": wooden wall with shelves, a swinging lamp with a flickering glow, drifting dust motes. */

// Shelves, pegboard and hanging plant drawn in code (ported from the approved preview).
const SHELVES = `<svg viewBox="0 0 844 390" preserveAspectRatio="xMidYMid slice" aria-hidden="true" stroke-linejoin="round" stroke-linecap="round">
  <g stroke="#2b1a10" stroke-width="3">
  <!-- left shelf -->
  <rect x="30" y="150" width="300" height="12" rx="4" fill="#9a6a3c"/><path d="M60 162v22l22-22M280 162v22l-22-22" fill="#7a4f2e"/>
  <path d="M70 150l-6-22 14 0 4 22z" fill="#c8714a"/><ellipse cx="71" cy="128" rx="9" ry="3" fill="#a85a38"/>
  <path d="M71 124c-10-16-26-18-30-30 14 0 26 8 30 30zM71 124c8-22 24-28 30-36-4 16-14 28-30 36zM71 124c-1-18 2-30 8-40 3 16 0 30-8 40z" fill="#93b58c"/>
  <rect x="118" y="108" width="38" height="42" rx="9" fill="#e8dcc0" fill-opacity=".55"/><rect x="118" y="126" width="38" height="24" rx="8" fill="#ffb938" fill-opacity=".85"/><rect x="123" y="100" width="28" height="10" rx="4" fill="#a06b3c"/>
  <rect x="172" y="128" width="64" height="22" rx="3" fill="#5f8461"/><rect x="176" y="108" width="58" height="20" rx="3" fill="#c8714a"/><rect x="180" y="90" width="50" height="18" rx="3" fill="#e8c46a"/>
  <circle cx="288" cy="128" r="14" fill="none" stroke="#c8955a" stroke-width="12" stroke-dasharray="7 7"/><circle cx="288" cy="128" r="9" fill="#c8955a" stroke-width="3"/><circle cx="288" cy="128" r="3.5" fill="#3a2417" stroke="none"/>
  <!-- pegboard + tools -->
  <rect x="360" y="40" width="190" height="130" rx="10" fill="#66442a"/>
  <g fill="#3a2417" stroke="none" opacity=".5"><circle cx="380" cy="60" r="2"/><circle cx="420" cy="60" r="2"/><circle cx="460" cy="60" r="2"/><circle cx="500" cy="60" r="2"/><circle cx="530" cy="60" r="2"/><circle cx="380" cy="150" r="2"/><circle cx="420" cy="150" r="2"/><circle cx="460" cy="150" r="2"/><circle cx="500" cy="150" r="2"/><circle cx="530" cy="150" r="2"/></g>
  <rect x="384" y="72" width="12" height="62" rx="5" fill="#c8955a"/><rect x="372" y="64" width="38" height="18" rx="5" fill="#9aa4ad"/>
  <path d="M440 70h16v46q0 10 8 10h-8q-16 0-16-14z" fill="#d9a441" /><circle cx="448" cy="78" r="12" fill="none" stroke="#d9a441" stroke-width="8"/>
  <path d="M492 68h58v26h-58z" fill="#c9d1d6"/><path d="M492 94l5 8 5-8 5 8 5-8 5 8 5-8 5 8 5-8 5 8 4-8z" fill="#c9d1d6"/><rect x="492" y="58" width="24" height="12" rx="4" fill="#a06b3c"/>
  <!-- right shelf -->
  <rect x="580" y="118" width="240" height="12" rx="4" fill="#9a6a3c"/><path d="M610 130v22l22-22M770 130v22l-22-22" fill="#7a4f2e"/>
  <rect x="604" y="84" width="40" height="34" rx="9" fill="#c9d1d6"/><circle cx="616" cy="98" r="3.5" fill="#2b1a10" stroke="none"/><circle cx="632" cy="98" r="3.5" fill="#2b1a10" stroke="none"/><path d="M624 84V72" /><circle cx="624" cy="69" r="4" fill="#ffb938"/>
  <path d="M682 118l-6-26h30l-6 26z" fill="#e8dcc0"/><path d="M694 92c-14-8-18-24-18-34 12 8 18 20 18 34zM694 92c10-10 18-12 22-24-2 16-10 24-22 24z" fill="#93b58c"/>
  <rect x="740" y="92" width="46" height="26" rx="4" fill="#5f8461"/><rect x="746" y="72" width="40" height="20" rx="4" fill="#c8714a"/>
  <!-- hanging plant -->
  <path d="M800 0v36" stroke-width="3"/><path d="M780 36h40l-6 24h-28z" fill="#c8714a"/>
  <path d="M786 60c-4 20 0 40-6 60M812 60c4 24 0 44 6 70M799 60c0 18-2 32 2 48" fill="none" stroke="#93b58c" stroke-width="7"/>
  </g></svg>`;

const LAMP = `<div class="a-lamp"><div class="a-glow"></div>
  <svg viewBox="0 0 120 150" aria-hidden="true"><line x1="60" y1="0" x2="60" y2="62" stroke="#2d1a0e" stroke-width="4"/>
  <path d="M20 112 Q24 66 60 62 Q96 66 100 112 Z" fill="#e8891a" stroke="#4a2d1a" stroke-width="5" stroke-linejoin="round"/>
  <path d="M34 104 Q38 78 56 72" fill="none" stroke="#ffd47a" stroke-width="6" stroke-linecap="round" opacity=".7"/>
  <rect x="14" y="108" width="92" height="12" rx="6" fill="#a85c0c" stroke="#4a2d1a" stroke-width="5"/>
  <ellipse cx="60" cy="128" rx="17" ry="14" fill="#fff2b8" stroke="#ffcf5a" stroke-width="4"/></svg></div>`;

export function buildBackdropA(kind: BackdropKind): HTMLElement {
  const r = rng(kind === 'page' ? 7 : 5);
  const motes = repeat(kind === 'page' ? 24 : 14, 'i', 'a-mote', () => {
    const s = (0.25 + r() * 0.55).toFixed(2);
    return `--x:${(r() * 100).toFixed(1)}%;--y:${(8 + r() * 85).toFixed(1)}%;--s:${s};--d:${(9 + r() * 9).toFixed(1)}s;--t:-${(r() * 14).toFixed(1)}s;--dx:${((r() - 0.4) * 7).toFixed(1)};--dy:${(-3 - r() * 7).toFixed(1)}`;
  });
  const lamp = LAMP.replace('class="a-lamp"', `class="a-lamp" style="left:${kind === 'page' ? 84 : 62}%"`);
  return backdropRoot('a', kind, `<div class="a-wall"></div><div class="a-far">${SHELVES}</div><div class="a-shade"></div>${lamp}${motes}<div class="a-vig"></div>`);
}
