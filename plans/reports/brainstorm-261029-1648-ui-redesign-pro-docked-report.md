# Brainstorm: UI redesign of the "Xưởng Nối" editor, based on mockup D "Xưởng Pro"

Date: 2026-10-29 16:48. Status: user approved the decisions below. Next step: /ck:plan.

## Problem
The current editor has 15 UX problems, listed in `plans/reports/ui-ux-designer-261029-1440-editor-ux-audit-report.md`. The main ones: port labels get clipped, nodes overlap, there is no zoom, the "Khối" label is ambiguous, the palette is a wall of 41 buttons, Play locks the editor, and the game gives no "why doesn't it work" feedback. The user wants a pro, modern layout in the style of Unity/Unreal.

## Approaches considered
Mockups A–F (links in HANDOFF.md §3, §3b).

| Mockup | For | Against |
|---|---|---|
| A/B/C | Restyle only, 4–6 days | Layout stays the same, so it does not feel like a pro tool |
| **D Pro docked** | Closest to Unity/Unreal: 4 docks, scene tree, inspector, console, play/pause/step | 13–17 days. Fit zoom is 65% at 1280 |
| E Graph focus | Graph gets the most space, presets, "Nối giúp tôi" | Renames nodes heavily. Game shown only in a PiP window |
| F Split live | Live wire values, "Chuyện vừa xảy ra" list | 16–18 days. Needs panning at 1280x720 |

**Chosen: D.** The user picks the good parts of E and F later, after the first round of D. They fit the D docks: the "Chuyện vừa xảy ra" list goes in the bottom dock and "Nối giúp tôi" goes in the graph toolbar.

## Decisions (user, 2026-10-29)
| # | Decision |
|---|---|
| 1 | Mockup D as the base, E/F extras deferred |
| 2a | The solid object is labelled "Hộp" in the UI. The internal kind `block` and the save format are unchanged, so no save migration is needed (only labels change) |
| 3a | Graph nodes are called "Mảnh ghép" in UI text (palette title, help, lessons) |
| 4a | During play: numbers and colours can be edited live. Add/delete nodes and wiring are locked until Dừng. Live edits are kept after Dừng, as in mockup D |
| 5a | Port type = colour + shape (yellow circle Đúng/Sai, blue diamond Số, pink square Vật thể). Category colour appears only on the icon tile. Node headers are neutral |
| 6a | Ports get a `required` flag, which drives the "Thiếu N dây" badge and the issue list |
| 7a | Desktop only. Touch and tablet are out of scope |

## Scout facts / constraints
- Stack: Vite 8, TS 7 strict, three.js, plain DOM, vitest (47 test files). The gates are `npx vitest run`, `npx tsc --noEmit -p .` and `npm run build` in `app/`.
- Editor files: `app/src/editor/{app,top-bar,layout-model,layout-splitters,palette,properties-panel,wiring-canvas(616 lines),editor-state,look-picker,text-vi}.ts`.
- **The engine has no pause/step yet** (`app/src/engine/runtime.ts`). This is the riskiest piece, as the D report warned.
- "Khối" is hardcoded in `nodes/block.ts` (label and port label), `editor/text-vi.ts` `paletteTitle`, `engine`/`io` text-vi, and about 6 lesson files.
- The mockup's game view is a 2D canvas fake. The real app keeps its three.js `render/game-view.ts`. Only the layout and UI chrome are ported, not the mockup's fake game.
- Playwright is not in `app/package.json`. Add it as a devDependency for the browser sweep.

## Proposed phases (for /ck:plan)
P1 must merge first. P2–P6 then run in parallel in separate worktrees, each with exclusive file ownership.

| Phase | Owns (files) | Content | Est. |
|---|---|---|---|
| P1 Shell | `app.ts`, `layout-model.ts`, `layout-splitters.ts`, `top-bar.ts`, global CSS, new `icons.ts` | Tokens (graphite + mint), SVG sprite, 40px top bar with Tệp/Sửa/Xem/Trợ giúp menus, 4-dock grid, tabs Màn chơi/Bảng nối, splitters (24px hit area), presets Mặc định/Chia đôi/Rộng bảng, sizes persisted. Play cluster rendered and wired to the existing play/stop | 2–3 d |
| P2 Graph | `wiring-canvas.ts` (+ split into helpers), `engine/types.ts` (`required` flag only) | Stacked nowrap ports, type shapes, legend, compatible pulse/dim, 24px snap, wrong-type shake + log, zoom toolbar, fit floor 0.6, semantic zoom, minimap, smart placement, Sắp xếp gọn, "Thiếu N dây" badge | 3–4 d |
| P3 Palette + Inspector | `palette.ts`, `properties-panel.ts`, `look-picker.ts` | Diacritic-insensitive search with synonyms, collapsible categories, drag-add. Inspector ports section, steppers, Tên riêng, Nhân đôi/Xóa, live-edit hook (uses P4 API) | 2–2.5 d |
| P4 Play state + Console | `engine/runtime.ts`, new `editor/console-dock.ts` | Pause/step/stop state machine, live param apply, structure lock during play, Bảng tin log + live issue list | 2–3 d |
| P5 Scene tree | new `editor/scene-tree.ts` | ARIA tree bound to real entities. Selecting an item selects its node | 1–1.5 d |
| P6 Naming + Lessons dock | `nodes/block.ts`, `*/text-vi.ts`, `tutorial/*` | "Hộp"/"Mảnh ghép" text, lessons rendered in the bottom dock (never over the game), "Chỉ cho tôi", launchpad on empty board | 1.5–2 d |
| P7 Sweep | tests + Playwright devDep | A11y pass, sample re-layout, browser sweep at 1440/1280/1024 | 1–1.5 d |

Cross-phase contracts that must be fixed in P1 or the plan:
- the dock mount-point IDs;
- the runtime API: `pause()`, `step()`, `isPlaying`, `applyParam(nodeId, key, value)`;
- the issue-list data shape.

## Risks
- **Engine pause/step and live param apply.** This could ripple into world/physics timing. Mitigation: P4 starts early and adds tests first.
- **Readability at 1280.** Fit zoom is 65% there. Mitigation: auto-collapse the palette at widths ≤1366 and use semantic zoom.
- **Lesson text drift after the rename.** Lesson tests use node labels. Mitigation: P6 owns all text and its tests are updated.
- **Merge conflicts on `app.ts`.** Mitigation: only P1 edits it. Later phases mount through the P1 mount-points.

## Success criteria
- At 1440, 1280 and 1024: no horizontal overflow, top bar on 1 row, 0 clipped port labels, 0 node overlaps after adding a node.
- Play, Tạm dừng, Từng bước and Dừng all work in the real three.js game. Changing a number during play affects the running game. Add/wire is blocked during play, with a clear message.
- A missing required port shows "Thiếu 1 dây" plus an issue-list entry, and "Xem khối" jumps to it.
- Old saves open unchanged.
- All 3 gates are green, and there are no console errors in the browser sweep.

## Out of scope
Touch/tablet, E/F extras (until the user picks them), screen-reader certification, Firefox/Safari testing.

## Unresolved
- Default layout at 1280x720: the plan proposes Mặc định with the palette auto-collapsed. Confirm with the user after the first build.
- Re-laying out the bundled samples: the plan assumes yes, positions only.
