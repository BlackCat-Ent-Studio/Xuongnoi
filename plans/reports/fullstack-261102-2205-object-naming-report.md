# Object naming report (fix/object-naming, 2026-11-02)

Worktree `D:\workspace\GameBuilder-naming\app`, commit `85f491b` on `fix/object-naming`.

## Changes
- Node kind `block`: label "Hộp" -> "Vật thể", labelEn "Block" -> "Object" (`src/nodes/block.ts`, `src/nodes/node-names.ts`). Self output port "Hộp" -> "Vật thể". IDs unchanged. Search aliases: "Hộp" (was) and "Block" (new `wasEn` field in node-names) still find it in palette and handbook.
- Spawner option "Hộp" -> "Vật thể", param "Hộp rắn không" -> "Vật thể rắn không".
- Text sweep (17 files: handbook, lessons, guide lines, scene empty text, color-sensor description, block description first line): wherever "Hộp" names this kind or its port (`cổng "Hộp"`, `mảnh Hộp`, `của Hộp cánh cửa`, `Hộp tảng đá`, try-board name `Thử: Vật thể`...). Left alone on purpose: generic prose where hộp = a real box/room/crate (hộp xanh mờ, hộp nâu cao, "hộp bị ẩn"), style option "Hộp" (block-styles, item), "Hộp xoay", "Hộp hỏi", param label "Loại hộp".
- Puzzle object cards reverted to the editor header: removed `nameCard`, `hasNamedTitle`, `objectName` (and the blanked self pin / `pz-object` class). Header is now `buildNodeView` as-is: title = kind label, subtitle = `cardSubtitle` (instance name, else English term, else category). Normal category icon, no thumbnails. Files: `src/puzzle/ui/board-view.ts`, `src/puzzle/ui/object-cards.ts`.

## Footprint proof
- `LEGACY_LONGEST_LABEL.block = 21` already existed, so `estimateNodeSize` for block is unchanged; no edit needed in graph-geometry.ts.
- `rename-card-sizes.mjs` (all 55 kinds added from palette, main :5219 vs branch :5218): 0 kinds differ in width/height.
- `rename-sample-sizes.mjs` (16 shipped samples, 438 cards): 0 cards differ in x/y/w/h. Overlap vitest tests pass.

## Verification
- `tsc --noEmit` clean; `npm run build` exit 0.
- Full `npx vitest run --testTimeout 120000`: 133 files, 2260 tests passed (before the last one-line test-title edit in new-sensors.test.ts).
- Tests: `object-cards.test.ts` lost the named-title tests (feature removed); `node-names.test.ts` gained Vật thể/Object label, port, search by "Hộp" / "Block" (palette + handbook), and card header kind-over-name tests. No assertion weakened. No existing test asserted the old "Hộp" label.
- Playwright `plans/browser-scripts/object-naming-shots.mjs` (16/16 checks, no console errors/warnings), shots READ in `plans/reports/shots-object-naming/`: puzzle L1, L2, L7 at 844x390 and 1280x720, editor sample "Bot leo bục" board, palette search "Hộp" (finds Hộp hỏi, Vật thể, Vùng kích hoạt, ..., 8 results). Puzzle cards: "Nhân vật / Bot", "Vật thể / Cờ", "Vật thể / Cửa kho", "Vật thể / Nút đỏ"; self pins read "Vật thể" / "Nhân vật". Editor without a typed name shows "Vật thể / Object".
- Line endings: `git diff main --stat` equals `--stat -w` (24 files), no CRLF flips.
- Dev servers :5218 and baseline :5219 stopped.

## Notes
- `docs/` and HANDOFF.md not updated.
- Search "Vật thể" now also lists Tạo vật mới (its old name was "Sinh vật thể").
- A few capital-letter "Hộp" instances in prose were judged by hand (e.g. "Vật thể đỏ là bức tường", "Vật thể tảng đá"); reads slightly stiffer than before but consistent with the kind name.
- Lessons checked by tests only, not played in the browser.

Status: DONE
Summary: Block node is now Vật thể / Object everywhere user-visible, puzzle object cards show kind on top with the instance name below, same as the editor; card sizes proven identical.
Concerns: none blocking; text sweep of "Hộp" prose was by-hand judgement (see Notes).
