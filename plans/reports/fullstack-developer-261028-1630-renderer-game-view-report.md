# Renderer / GameView report

Files: app/src/render/{game-view,scene-view,cameras,hud,game-loop,text-vi}.ts, app/tests/render/render-logic.test.ts

- `createGameView(): GameView` implemented per app-contracts.
- Tests: 10 pass (accumulator, camera math). `tsc --noEmit` clean (imports of runtime/world/nodes resolved).
- Not verified: actual WebGL rendering / 60 FPS (no browser run).

Behaviour notes
- registerAllNodes() called once per page (module flag) since registerNode throws on duplicates.
- After game end: loop stops, overlay shown, onGameEnd fired once; isPlaying() stays true and getRuntime() stays valid until stop() or a new play().
- 3d: left-drag orbit (also in preview), wheel zoom (all modes), yaw sent via world.setCameraYaw each frame. yaw 0 = toward -Z; drag right decreases yaw.
- Preview/no-character frames all visible entities (ortho height auto-fits, min 16).
- Build/runtime errors: console.error + Vietnamese message "Không thể hiển thị bảng này" (not the specific error text).
- Per-frame errors in tick/step stop the loop and show the same message.
- mount() adds `position:relative` to container if static; canvas fills container 100%.
