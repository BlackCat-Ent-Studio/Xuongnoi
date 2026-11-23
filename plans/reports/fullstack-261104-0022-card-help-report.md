# Card "?" help button — report (2026-11-04)
Worktree D:\workspace\GameBuilder-help (feat/card-help), commit b3357e8. Dev server 5232 stopped.

## What was built
- White round "?" with dark-blue ring on the top-right corner of every card (puzzle + editor) and every tray chip. Hint "?" is brown/yellow-red, so they differ. Never touches hintsUsed/stars.
- Tap opens a short centred popup: title + English term, 1-sentence purpose, one line per port the card actually shows (read from the card rows, so puzzle locked cards hide the same ports), one example, buttons "Xem đầy đủ trong Sổ tay" / "Đóng". Esc or tap outside closes. Scrolls inside when long.
- "Xem đầy đủ" → requestHandbook(kind). Editor: existing dialog. Puzzle: dialog created lazily on first request (dynamic import) in readOnly mode (no "Thử ngay"/lesson buttons, own colours via handbook-standalone.css).
- Footprint: "?" is absolutely positioned on the header corner (header became position:relative) → no width/height change; estimateNodeSize untouched. Group cards not touched (own builder).
- Puzzle tray chip now wrapped in `.pz-chip-wrap` (chip disabled when used up, so "?" must be a sibling); `chipEl()` returns the wrap so the guide ring still works. Tray got 9px top/right padding so the corner "?" is not clipped.
- Drag/tap-port/knots/focus: "?" swallows pointerdown+click; popup overlay swallows pointer events. Guide overlay is pointer-events:none, "?" left visible during guide (does not capture guide taps).

## Files
New: src/handbook/card-help-summary.ts, card-help-popup.ts, card-help.css, handbook-standalone.css, tests/handbook/card-help.test.ts
Changed: handbook-request.ts (opts param, CRLF kept), handbook-text-vi.ts, handbook-dialog.ts (readOnly, CRLF kept), editor/graph/node-view.ts, node-cards.css, puzzle/ui/board-view.ts, puzzle.css, puzzle-main.ts.

## Verification
- tsc clean. Full `vitest run --testTimeout 120000`: 157 files, 2639 tests pass.
- Unit: every registered kind has handbook summary with non-empty purpose, example, and a non-empty explanation for every current input/output port (incl. Tới Đích / Đã bắt đầu); port filtering; first-sentence cut. No jsdom in repo, so popup DOM behaviour is covered by Playwright only.
- Playwright (plans/browser-scripts/card-help-check.mjs), L5 `du-ba-thung`, desktop 1280x720 + phone 844x390: chip popup, card popup, Esc, tap outside, locked card has "?", card not focused / node count unchanged by "?", "Xem đầy đủ" opens handbook (no action buttons), Esc closes. Hint badge 8 → 8 both sizes. Phone popup 420x366 fits inside 844x390. Editor: 2 sample cards have "?", 0 on groups, sizes unchanged (168 wide), popup + full handbook OK. Console errors: none.
- Shots read: D:\workspace\GameBuilder\plans\reports\shots-card-help\ (desktop-1..4, phone-1..4, editor-1..3).

## Notes
- Popup can be tall for kinds with many ports (e.g. Tìm vật gần nhất: 4 skip ports); it scrolls, but is not truly "short" there.
- Phone full handbook is cramped (list limited to 30vh, mode bar hidden); readable, page scrolls.
- Not tested: real touch device, dragging a card by its header right next to the "?" on touch.

Status: DONE_WITH_CONCERNS
Summary: "?" with short popup on all puzzle/editor cards and tray chips, full-handbook link works on both pages, no star cost, tsc + full vitest green, shots checked.
Concerns: popup long for port-heavy kinds; phone handbook layout tight; popup DOM has only Playwright coverage (no jsdom). Branch not merged.
