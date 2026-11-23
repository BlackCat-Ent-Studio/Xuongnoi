---
title: Circuit boards (nested) + parcel-sorting factory sample
status: in-progress
created: 2026-11-19
design: ../reports/brainstorm-261119-0348-sorting-factory-circuit-boards-report.md
---

# Plan — Bảng mạch nhiều tầng + bài mẫu "Xưởng phân loại kiện hàng"

Product is for fundraising: make it complete; each wave ends with a version the user opens on :5173.

User answers (11-19 ~11:20): no fixed demo date · first showable version = 8 AGVs + 6 chutes · AGVs free-drive on a grid (line loop = fallback) · question 4 (approve design) left blank → ⭐ default taken (approved), told to the user.
Model rule: session + every agent on Fable 5.2 (`model: "fable"`).

## Phases
| # | Phase | Status | Depends on |
|---|---|---|---|
| 0 | [Previews + spikes](phase-00-previews-and-spikes.md) | done 11-19 | — |
| 1 | [Core: circuit model, expand, file format + pieces](phase-01-circuit-core-and-pieces.md) | done 11-19 (main ab21c74, full vitest 270 files / 4024 green) | spike "placement" of phase 0 |
| 2 | [Editor for circuits + robot go-to-point + asset port](phase-02-circuit-editor-nav-assets.md) | done 11-19 (editor slices 1 + 2, nav pieces, asset port) | user picks of phase 0, phase 1 |
| 3 | [Sample "Xưởng phân loại" + lessons](phase-03-sorting-factory-sample.md) | part 1 (stations) in main 0d273e9; MUST BE RE-PLANNED: on 11-22 the user chose grid layout A on a mezzanine + tug fleet + docks, see HANDOFF §A4 | phases 1–2 |
| 4 | [Demo hardening + deploy](phase-04-demo-hardening.md) | pending | phase 3, user says "deploy" |

## Acceptance (whole plan)
- Factory board shows ≤ ~15 blocks; double-click enters Trạm → Máy; the entered machine shows ITS live wires while the factory runs.
- Editing circuit "Xe AGV" once changes all 8 AGVs; each AGV keeps its own open settings.
- 8 AGVs + 6 chutes run endlessly on real physics; parcels counted per chute land in the right one; no chassis overlap; removing any pin wire breaks the factory for the visible reason (anti-forced tests).
- Old boards: off/on hash guards unchanged; full vitest green on the merged commit; tsc clean.
- Every visible element was previewed and picked by the user before porting.

## Rules that bind every phase
- Pieces only: no sample ids under src/world, src/nodes, src/engine. Gaps are reported, not faked.
- New behaviour = a general piece with open params.
- HANDOFF §4 workflow: worktrees + junctions made by the controller, merge as each agent finishes, controller reads the shots, one link :5173.
