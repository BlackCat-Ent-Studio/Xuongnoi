# Handbook UI report (feat/hb-ui)

Gates in app/: vitest 90 files / 1233 tests pass, tsc clean, npm run build ok.
Browser (port 5221, stopped): menu open, level/group views, node page, search (no accents), Esc close, 900px layout, "?" in palette and properties, drag from palette still adds node, 0 console errors. Shots: plans/reports/shots-handbook-ui/.

Files: new app/src/handbook/{handbook-dialog.ts,.css,handbook-model.ts,handbook-text-vi.ts,handbook-request.ts}, tests/handbook/handbook-dialog.test.ts. Small edits: editor/app.ts, palette.ts, properties-panel.ts, shell-text-vi.ts, tutorial/controller.ts (new Tutorial.startLesson(id)).

Level rule: levelOf(entry.lessonId) via chapterOf -> basics+items=1, bots+fighting=2, world+vehicles=3, delivery+numbers-ui=4, real-games=5; no entry or lesson outside course = Cap 3 (FALLBACK_LEVEL). Order inside level = LESSONS index, then label.
"?" opens via document CustomEvent (handbook-request.ts), span role=button swallowing pointerdown/keys.
