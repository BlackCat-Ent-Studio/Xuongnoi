---
status: done
source: plans/reports/brainstorm-261029-1648-ui-redesign-pro-docked-report.md
mockup: plans/ui-mockups/d-pro-docked/index.html
---
# UI redesign: mockup D "Xưởng Pro" in the real app

The decisions are in the brainstorm report: Hộp, Mảnh ghép, live numbers but locked structure during play, shape + colour ports, required ports, desktop only.

## Wave 1 (parallel, 5 worktrees)
| Agent | Branch | Exclusive files |
|---|---|---|
| A Shell | feat/ui-shell | `editor/app.ts`, `editor/top-bar.ts`, `editor/layout-model.ts`, `editor/layout-splitters.ts`, `src/style.css`, `index.html`, new `editor/icons.ts`, new `editor/menu-bar.ts`, new `editor/shell-text-vi.ts` |
| B Engine pause | feat/engine-pause | `engine/runtime.ts`, `render/game-view.ts`, `app-contracts.ts`, `engine/types.ts` (Runtime part only), world files only if needed for live param |
| C Graph | feat/ui-graph | `editor/wiring-canvas.ts`, new `editor/graph/*.ts`, new `editor/graph/graph.css`, `engine/types.ts` (PortDef `required?` only), `nodes/*.ts` (adding `required: true` only, NOT `block.ts`) |
| D Panels | feat/ui-panels | `editor/palette.ts`, `editor/properties-panel.ts`, `editor/look-picker.ts`, new `editor/panels/*.ts` + css |
| E Naming | feat/ui-naming | `nodes/block.ts` (labels), `editor/text-vi.ts`, `engine/text-vi.ts`, `io/text-vi.ts`, `tutorial/*` text, related tests |

Shared rules:
- New UI strings go in the agent's own new `*-text-vi.ts`. Only E edits the existing text-vi files.
- New CSS goes in the agent's own file, imported from its TS module. Only A edits `style.css`.
- Keep the `createWiringCanvas`, `createPalette` and `createPropertiesPanel` signatures compatible: new options must be optional.
- Design tokens are CSS variables defined by A in `style.css`: `--bg --chrome --panel --panel2 --line --text --text2 --text3 --accent(#3ecf8e) --warn --danger --t-bool(yellow) --t-num(blue) --t-obj(pink)`. C and D use the variables, with the mockup hex values as fallbacks.

## Wave 2 (after wave 1 is merged)
- F Play state + Bảng tin. Wires Tạm dừng/Từng bước/Dừng to B's API, blocks structural edits during play, adds live-edit from the Inspector, adds `editor/console-dock.ts` with the log and the issue list.
- G Scene tree: `editor/scene-tree.ts`.
- H Lessons dock + launchpad: `tutorial/controller.ts` and the overlay.

## Wave 3
Tester browser sweep at 1440/1280/1024, all samples plus key lessons, then update HANDOFF.

## Acceptance
See the "Success criteria" section of the brainstorm report. The gates in `app/` are vitest, `tsc --noEmit -p .` and `npm run build`.
