---
phase: 7
title: Save load and samples
status: completed
priority: P2
dependencies:
  - 6
effort: S
---

# Phase 7: Save load and samples

## Overview
Versioned JSON save, localStorage autosave, file export/import, 3 sample boards.

## Requirements
- Format: `{ format_version: 1, mode, name, graph: { nodes, wires } }`.
- Load validates: unknown node kind / port / bad type → Vietnamese error, board unchanged.
- `migrations.ts`: map version → upgrade fn (empty for v1, structure ready).
- Autosave to localStorage 1 s after last change; restore on open.
- Lưu = download `<name>.xuongnoi.json`; Mở = file picker or sample list.
- Samples (original content): `sample-side-stars.json` (run/jump, 5 stars, fall = lose), `sample-top-collect.json` (4-dir, 5 items → win), `sample-3d-hop.json` (simple 3D platforms to goal).

## Related Code Files
- Create: `src/io/save-format.ts`, `validate.ts`, `migrations.ts`, `autosave.ts`, `file-io.ts`, `src/samples/*.json`
- Modify: `editor/top-bar.ts` (Lưu/Mở + sample menu)
- Create: `tests/io/save-roundtrip.test.ts`

## Implementation Steps
1. Serialize/deserialize + validate.
2. Autosave + restore.
3. File export/import.
4. Build 3 samples in editor, export, commit as JSON.
5. Tests: roundtrip equality, invalid file rejected, each sample loads + runs 600 ticks without error.
6. Commit `feat(io): versioned save, autosave, sample boards`.

## Success Criteria
- [ ] Reload browser → board restored
- [ ] Export → import gives identical board
- [ ] 3 samples load and play to win/lose

## Risk Assessment
localStorage quota tiny risk (boards small). Corrupt autosave → catch, keep backup key, start blank with message.
