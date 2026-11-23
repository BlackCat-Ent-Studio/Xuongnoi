# Title fix report
- Root cause of buttons jumping right: puzzle.css `.pz-btn:active:not(:disabled){transform:translateY(.3cqw)}` (higher specificity) replaced the centering `transform: translateX(-50%)` of `.pz-play` and `.pz-settings-btn` on press -> button shifted right by half its width (Chơi 640 -> 804 px at 1280). Fix: centre with `translate:-50% 0`; press/pulse use `transform` only (shell.css).
- Layout: title column centred at 50%, cat x .15, wheel .74, legs .88 (ending keeps old slots), bubble/tag moved, bench props hidden on title (class pz-props in shell-kit.ts).
- Checks: plans/browser-scripts/title-layout-check.mjs (4 viewports, silhouettes via pixel diff, no overlaps), button-press-check.mjs (38 buttons title/settings/map/end/level, 0 shifts; baseline showed 2 real shifts). Shots: plans/reports/shots-title-fix/.
- tsc clean, vitest tests/puzzle 261 pass, build ok. Win card not measured separately (shares .pz-btn rule).
