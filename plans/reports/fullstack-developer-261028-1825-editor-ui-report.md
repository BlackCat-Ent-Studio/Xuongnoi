# Editor UI (phase 6) report

Files: app/src/editor/{text-vi,editor-state,dom,keyboard-input,entity-drag,wiring-canvas,palette,properties-panel,new-game-dialog,top-bar,app}.ts, app/src/main.ts, app/src/style.css, app/tests/editor/editor-state.test.ts.

Verify: tsc clean, vitest 117 pass (9 files), npm run build OK. Not exercised in a real browser (no manual playtest).

Behaviour: autosave on every change except selection/playing; flushAutosave on pagehide; takeAutosaveProblem shown inline at startup. No alert/confirm/prompt. Palette click or pointer-drag adds nodes. Wire drag from either port with live ok/bad highlight and Vietnamese reason tooltip. Delete/Backspace removes selection (edit mode). Play: wire badges refresh at 10 Hz, object badge shows source node label. Entity drag uses a capture-phase listener on the game box, only for nodes with a vec3 `position` param, snap 0.5, grab offset kept. Mode switch notifies how many nodes are unavailable in the new mode.

No changes needed to types.ts or app-contracts.ts.
Not done: no undo; bundle >500 kB (three).

Status: DONE
Summary: Full editor UI implemented and mounted in main.ts; typecheck, tests and build pass.
Concerns/Blockers: Browser-level interaction (pointer capture on canvas, wire hit testing, 3D drag vs orbit) untested manually; verify in a playtest.
