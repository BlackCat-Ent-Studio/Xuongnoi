# Node rename report (feat/rename, 2026-11-02)

Branch `feat/rename`, worktree `D:\workspace\GameBuilder-rename\app`. Source of truth: `plans/ui-mockups/node-rename/node-rename.json` (54 nodes, approved as-is).

## What changed
- `NodeDef.labelEn?` and `PortDef.labelEn?` added (`src/engine/types.ts`). `label` = approved Vietnamese name, `labelEn` = small English term.
- `src/nodes/node-names.ts` (new): table of all 54 nodes + every port (vi, en), `applyNodeNames()` run once in `nodes/index.ts`, `nodeSearchAliases()` (English term + the old Vietnamese name). In-file labels in `src/nodes/*.ts` were also changed to the new Vietnamese names, so the two never disagree (a test checks it). Extra ports not in the review table: select-number "Bang 4-6", sequence "Viec 4-6" follow the 1-3 pattern.
- IDs untouched (kinds, port ids, param ids). Samples JSON untouched (hash-identical); saved boards load as before.
- Display: card subtitle (editor + puzzle share it), palette item (English next to name), properties header ("Shoot · Nhom Hanh dong"), handbook heading + English under every port name, port-row tooltip "Vi · En".
- Search: palette and handbook also match the English term and the OLD name (type "Cam bien cham" finds Cham nhau; screenshot 1b).
- Text sweep (about 90 files): handbook pages, 30 lessons (steps, hints, titles, try-board names), guide-script lines (Meo Mun), puzzle level hints, node descriptions, test titles/expectations. Context-sensitive names handled by hand: Vua bam (Phim -> Vua nhan, Nut bam / Bam vao vat unchanged), Dang giu (phim/chuot), Vat (Do phia truoc -> Vat nhin, Bam vao vat -> Vat can bam), Vat A/B (Cham nhau -> Vat chinh/Vat kia, Do khoang cach -> Vat 1/2), Khong (node -> Dao nguoc, yes/no option labels kept), Phuong tien (node -> Xe; the cargo-type option "Phuong tien" kept), Dung (route-follow "Dung" kept, only the vehicle port is "Phanh").
- Deliberately NOT renamed: chapter title "Danh nhau", step title "Danh nhau trong game", sample group name / note "Man hinh bat dau ..." (generic prose, would change shipped sample JSON).

## For the feat/obj-cards agent
- English subtitle is added by `cardSubtitle(node, def)` in `src/editor/graph/node-view.ts`, called from `buildNodeView` (shared card). Returns `instanceName || def.labelEn || categoryLabel`. Nothing in `puzzle/ui/board-view.ts` was touched. Locked object cards keep showing `params.name` on that line today; if you change the title/sub for them, keep movable (tray) pieces calling `cardSubtitle`.
- Card header CSS: `.wc .wc-node:not(.wc-group) .wc-sub` uses `contain: inline-size` and title is `flex: 1 1 0` so the subtitle never widens a card.

## Footprint proof (saved layouts)
- Heights: identical for all 54 kinds (same sub line reused). 
- Widths measured in Chromium on main (old) vs branch (new), blank board, every kind added from the palette (`plans/browser-scripts/rename-card-sizes.mjs`): 3 kinds grow, only while the "Thieu N day" badge is showing, because the Vietnamese NAME itself is longer: Do khoang cach +21px, Cam dung cu +30px, Thang / Thua +5px. Without the badge their header is under the 168px minimum so no growth. 18 kinds shrink (the old long port labels went away), rest equal.
- 16 shipped samples opened in the browser, every card compared (`rename-sample-sizes.mjs`): 0 cards moved, 0 grew (1px sub-pixel on "Ne va ban" gun card), real overlap counts identical (0 except race 1 and dice 1, same as before).
- `estimateNodeSize` (used by `spreadOverlaps` on load and for placing new nodes) depended on label length; first run moved 2 cards in the dice sample. Fixed: 13 kinds keep their old longest-label length in `LEGACY_LONGEST_LABEL` (graph-geometry.ts) so the estimate is byte-identical to before.

## Verification
- tsc clean; `npm run build` OK.
- Full `npx vitest run --testTimeout 120000`: 130 files, 2249 tests passed; build OK.
- New test `tests/nodes/node-names.test.ts` (names for all 54 kinds, ports, ids kept, old-name and English search in palette and handbook, card subtitle).
- Tests changed to the new labels (never weakened): block-hidden-while, object-nodes, ui-nodes, level-7, levels-1-4, levels-5-8, course-pack-c, lesson-bot-tool, conveyor, vehicle-train, handbook try-board names (`Thu: <label>` must equal the node label, so try boards renamed too).
- Playwright shots (read), `plans/reports/shots-rename/`: `<size>-1-palette`, `1b-palette-search-old-name`, `2-sample-board`, `3-properties`, `4-handbook`, `5-lesson-step`, `6-puzzle-cua-kho`, `6-puzzle-ne-linh-gac` at 1280x720 and 844x390. No console errors.

## Not verified / notes
- English terms come from the approved table (not web-checked).
- Editor at 844x390 is cramped (pre-existing layout; board area is tiny), the rename does not change that. Puzzle at 844x390 is fine.
- Port rows on cards show only the Vietnamese label; English is in the tooltip (adding it would widen cards).
- Lessons were checked by tests and one step screenshot, not played end to end in the browser.
- `docs/` and HANDOFF.md not updated by this agent.
- Dev server :5213 stopped (and the baseline :5215 server on main).
