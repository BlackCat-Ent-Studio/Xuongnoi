---
title: Node-wiring game builder 2D/3D — step 1
description: >-
  Browser editor: drag nodes, wire ports, press Play; one engine, 3 view modes
  (2D side, 2D top, 3D)
status: completed
priority: P2
branch: main
tags:
  - game-builder
  - threejs
  - vite
  - typescript
blockedBy: []
blocks: []
created: '2026-10-28T09:10:31.354Z'
createdBy: 'ck:plan'
source: skill
---

# Node-wiring game builder 2D/3D — step 1

## Overview
Original node-wiring game builder in `app/` (Vite + TS + Three.js). One 3D world; 2D modes = axis lock + fixed ortho camera. 16 original nodes, Vietnamese UI, autosave + JSON file, 3 sample boards.
Source: `plans/reports/brainstorm-261028-1601-node-wiring-builder-2d-3d-report.md` (approved).

**Hard rule:** original design only — no node list/names/params/UI/text/assets from GBG or `D:\gbg\`.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Scaffold app](./phase-01-scaffold-app.md) | Completed |
| 2 | [Logic engine](./phase-02-logic-engine.md) | Completed |
| 3 | [Step-1 nodes](./phase-03-step-1-nodes.md) | Completed |
| 4 | [World and physics](./phase-04-world-and-physics.md) | Completed |
| 5 | [Renderer and view modes](./phase-05-renderer-and-view-modes.md) | Completed |
| 6 | [Editor UI](./phase-06-editor-ui.md) | Completed |
| 7 | [Save load and samples](./phase-07-save-load-and-samples.md) | Completed |
| 8 | [Verify and playtest](./phase-08-verify-and-playtest.md) | Completed |

Order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (sequential; 4 can start after 2).

## Acceptance (whole plan)
1. `cd app; npm install; npm run dev` → editor at http://localhost:5173.
2. User wires side-view run/jump game from blank (move, jump, star +1, fall = lose).
3. Top-down game: 4-dir move, touch item +1, 5 → win.
4. Board plays correctly in 2D side / 2D top / 3D after mode switch.
5. Wrong-type wire rejected; click wire → live value.
6. Autosave survives browser restart; JSON export/import.
7. 3 sample boards play.
8. `npm test` green; `npm run build` no type errors.

## Dependencies
None (first plan). Git repo on `main`; commit per phase, conventional commits.
