# Guide report (branch feat/guide, worktree D:\workspace\GameBuilder-guide)

Commit: feat(puzzle): visual tutorial guide with spotlight, hand and ghost wire. Stat matches `-w` stat (no CRLF damage).

## Done
- New: `app/src/puzzle/ui/guide.ts`, `guide-script.ts`, `guide.css`; tests `app/tests/puzzle/guide-script.test.ts`, `guide-seen.test.ts`.
- Edited: `board-view.ts` (hooks: portEl, chipEl, paramEl, popoverEl, closePopover, pickedEnd, setGhost + dotted ghost wire), `level-screen.ts` (guide, replay button, "?" , win cheer), `puzzle-text.ts`.
- Steps generated from `level.solution`: intro (with "Tiếp ›"), take piece (new kinds say "Mảnh mới! ..."), set number (levels 3, 6, 7), each wire (output first, then input; ghost line), "Bấm CHẠY". Current step = first step not done, so undoing something steps the guide back.
- Level 8: no guide, no replay button; "?" still works. Guide hides during a run; on win the cat says a happy line (mood 'happy') above the win overlay.
- "?" : next missing piece chip / param row / wire (ghost + hand on output). Ghost stays until joined. While the guide leads, "?" only nudges and does NOT mark hint used.
- guideSeen: localStorage `xuongnoi.puzzle.guideSeen` (JSON array of level ids), marked when the guide auto-starts.

## Verification
- tsc clean; `vitest run tests/puzzle tests/editor` 289/289; `npm run build` OK.
- Playwright (1280x800): guides of levels 1, 2, 3 (number popover), 5, 6 walked to the win by following the hand; level 2 also at 844x390; "?" on level 3 (chip, ghost, joined, ghost gone); reload = no auto guide, replay works; level 8 no guide; reduced motion = no animations. No console errors. Shots in `plans/reports/shots-guide/` (L1-*, L2-*, L3-*, L5-*, P2-* phone, L3-hint-*, L8-hint-phone).

## Concerns
1. Level 7 cannot be solved in the real UI: its reference solution wires Hẹn giờ "Hết giờ" to its own "Đếm lại", and `canConnect` rejects same-node wires ("Không thể nối mảnh ghép với chính nó"). The guide reaches that step and then stalls (Playwright confirmed). Level tests pass only because they bypass the UI rule. Needs a level 7 redesign (not in my ownership) or an allowed self-wire. Guide test works around it only for that one wire.
2. `level.hint` text is no longer shown anywhere ("?" now shows the ghost line + toast). Kept in level data.
3. `.pz-mascot-frame` size/border is styled in guide.css; the other agent's mascot should keep that class on `el` (or restyle it).
4. Run step is slow under swiftshader for 3D levels (test artefact only).
