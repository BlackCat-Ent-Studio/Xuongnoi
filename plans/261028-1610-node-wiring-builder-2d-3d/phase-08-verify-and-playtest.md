---
phase: 8
title: Verify and playtest
status: completed
priority: P1
dependencies:
  - 7
effort: S
---

# Phase 8: Verify and playtest

## Overview
Run all acceptance checks, write short Vietnamese how-to for user, collect playtest feedback for step 2.

## Requirements
Whole-plan acceptance 1–8 (see `plan.md`).

## Related Code Files
- Create: `app/README.md` (Vietnamese: how to start, how to wire first game)
- Create: `plans/reports/playtest-<date>-step-1-feedback-report.md` after user plays
- Modify: `HANDOFF.md`

## Implementation Steps
1. `npm test`, `npm run build` clean.
2. Browser check (agent-browser / Chrome): open editor, load each sample, play to win + lose, switch modes, reload → autosave.
3. Build side-view game from blank following README; fix friction found.
4. Code review pass (`/ck:code-review`) on engine + editor.
5. User playtest; record feedback list → step-2 backlog (≈35 nodes, random, spawn, rotate, camera, text, color).
6. Commit `docs: step-1 usage guide` and update HANDOFF.

## Success Criteria
- [ ] All 8 acceptance items checked with evidence
- [ ] User plays samples + wires own game
- [ ] Feedback report written

## Risk Assessment
User finds wiring hard → feedback drives step 2 priorities before adding more nodes.
