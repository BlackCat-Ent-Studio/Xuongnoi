# HUD contrast fix report

Branch fix/hud-contrast (worktree D:\workspace\GameBuilder-hud). Not merged.

- Corner texts/numbers and bar captions: white text on rgba(10,12,16,0.6) rounded (6px) pill. Contrast white-on-backdrop over pure white scene = ~5.3:1 (>=4.5); unit test checks it.
- Explicit colour (text node colour) still honoured; very dark colours get a light backdrop (rgba(255,255,255,0.8)) so they stay readable.
- Floating labels: dark pill + white default (bar captions white; default bar fill red #e11d48, was near-black).
- Layout positions unchanged; end card untouched.
- Files: app/src/render/hud.ts, hud-widgets.ts (CRLF kept), floating-labels.ts, tests/render/hud-contrast.test.ts.
- Gates: vitest 63 files green, tsc clean, npm run build ok.
- Browser (port 5192, stopped): city, Nhặt sao (2D ngang), Nhảy cóc 3D; before/after in D:\workspace\GameBuilder\plans\reports\shots-hud\ ; 0 console errors.

Status: DONE_WITH_CONCERNS
Summary: HUD text now readable on any scene via shared backdrop helper; gates green.
Concerns: 3D sample has no HUD text, so 3D/PiP verified only by shared code path (same Hud class). Bottom-left city hint uses a dark explicit colour, so it gets a light backdrop (readable, intentionally). Floating-label look on object not visible in the shots ("Nha 2" shows light pill since its colour is explicit dark).
