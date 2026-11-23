---
phase: 1
title: Scaffold app
status: completed
priority: P1
dependencies: []
effort: S
---

# Phase 1: Scaffold app

## Overview
Empty Vite + TS project in `app/` with Three.js and Vitest, folder skeleton, Vietnamese text module.

## Requirements
- `npm run dev` / `build` / `test` work. Strict TS. No UI framework (plain DOM) — KISS.
- Deps only: `vite`, `typescript`, `three`, `@types/three`, `vitest`.

## Architecture
```
app/
  index.html
  package.json  tsconfig.json  vite.config.ts
  src/
    main.ts               entry: mounts editor
    ui-text-vi.ts         all Vietnamese UI strings (single source)
    engine/ nodes/ world/ render/ editor/ io/ samples/
  tests/
```

## Related Code Files
- Create: all of the above (root `.gitignore` already ignores deps + build output).
- Modify: root `.gitignore` — add `!app/package-lock.json` for reproducible installs.

## Implementation Steps
1. `npm create vite@latest app -- --template vanilla-ts`; strip demo files.
2. Install deps; add `"test": "vitest run"`.
3. `tsconfig`: `strict`, `noUncheckedIndexedAccess`.
4. Folder skeleton + `ui-text-vi.ts` with app title "Xưởng Nối".
5. Placeholder `main.ts` renders title; one trivial vitest test.
6. Commit `chore: scaffold vite typescript app`.

## Success Criteria
- [ ] dev server shows title at :5173
- [ ] `npm test` and `npm run build` pass

## Risk Assessment
Low. Template version drift → pin versions in package.json.
