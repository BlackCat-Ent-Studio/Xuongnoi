# Free board preview - report (2026-11-04)

## Built
- `plans/ui-mockups/free-board/index.html` (single file, Google Fonts via CDN like wire-tidy) and `shot-free-board.mjs`. Nothing under `app/` touched, no commit.
- Page text is Vietnamese. Preview-only chrome: Màn 5/7 switch, "Cũ (bị ép) / Mới (tự do)" switch, zoom % readout. Hint line pill on the board.
- Cards, pins inside cards, wire look + energy, "?", lock, x, tray chips: copied from the real CSS. Wires are the game's plain bezier. Wire-tidy toggles, routing, knots, labels removed.
- Mới: infinite canvas. Drag empty board = pan, no bounds. Wheel and 2-finger pinch zoom 0.25-1.6 around the pointer. Double-tap/click on empty board = fit. Cards drag by header in world space, no push-apart. Wire drag from a pin (snaps to compatible pins within 30px, other pins dim). 6px tap slop. Tray chip drops a card in the nearest free spot to the view centre (prefers fully on screen). x returns a card to the tray.
- Cũ: mimics board-view.ts layout(): level positions stretched to the screen, scale ladder down to 0.46, separateBoxes (ported). No pan/zoom.
- Fit rule: zoom = clamp(fit, 0.70, 1).
- Locked cards x1.5. The "placed" solved cards (stand-in for the player's cards) are also x1.5, so the board looks evenly spread.

## Shots (`plans/ui-mockups/free-board/shots/`)
`{desk,phone}-m{5,7}-{old,new,new-zoomin,new-pan,new-dblfit}.png`, plus `desk|phone-m5-wiredrag.png`, `-tray-drop.png`, `-pinch.png`, and `checks.json` (numbers). Desktop 1280x720, phone 844x390 (touch).
Checks that passed (checks.json): zoom clamps at 0.25 and 1.6; far pan not bounded; dbl-click and real double-tap return to the fit view; tapping a card header or pin moves nothing; card drag moves in world space; wire drag adds and replaces a wire; tray drop works; synthetic 2-pointer pinch zooms. No console errors.

## Uncertain
- Deviation: when the cards do not fit at 0.70, I align the top-left (first cards) in view instead of centring, because centring cut the leftmost / top cards in half on the phone and Màn 7. One switch: `CENTER_WHEN_TOO_BIG = true` in index.html restores centring.
- Old board is a faithful-but-approximate port (my own free-spot scan; the 1000x560 stretch and ladder are from the code). On desktop 1280 Màn 5 is not squeezed at all, the squeeze shows on phone / Màn 7.
- Pinch tested with synthetic pointer events, not a physical device. Wire drag does not detach an already connected input (real game behaviour not checked).
- Preview header takes ~55px; the real game has more room, so fit zoom will differ slightly.
- "?" is visual only.

Status: DONE_WITH_CONCERNS
