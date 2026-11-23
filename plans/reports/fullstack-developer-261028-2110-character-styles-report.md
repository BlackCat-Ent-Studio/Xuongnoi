# Character body styles - report

## Files
- NEW `app/src/render/character-motion.ts`: pure motion math (Motion, motionOf, walkPhaseRate, yaw/facing helpers) moved out of humanoid-model.
- NEW `app/src/render/character-styles/`: `kit.ts` (StyleRig/StyleDef, PartKit shared geometry + cached materials, poseRig/blendPose, localYRange), `human|robot|cat|chick|jelly|dino.ts` (one builder + pose fn each), `index.ts` (registry `CHARACTER_STYLES`, `resolveLook`, `styleFor`; unknown look -> human).
- `app/src/render/humanoid-model.ts`: `Humanoid(color, mode, look?)` generic over styles; keeps velocity/facing estimation. Fit = measure posed y-range, lift by floor dip, compress vertically only if top would exceed box (guarantee, replaces footDrop).
- `app/src/render/scene-view.ts`: entry tracks look; character rebuilt when look changes.
- NEW `app/src/render/character-thumbnails.ts`: offscreen WebGL renderer -> PNG data URLs (144px, 3/4 view), cached per look+color (cap 120), released after use; returns empty map if WebGL fails.
- NEW `app/src/editor/look-picker.ts`: radiogroup of 6 tiles (thumbnail + vi label), one tab stop, arrows/Home/End move+select, selected highlighted, rAF-coalesced thumbnail refresh on color change.
- `app/src/editor/properties-panel.ts`: character `look` param renders the picker; refresh thumbnails on color edit while focus stays in panel.
- `app/src/nodes/character.ts`: `look` select param (default human, 6 vi options), passed to spawn.
- `app/src/engine/types.ts`: only `look?: string` on EntitySpec and EntityView. `app/src/world/entity.ts` + `world.ts`: pass-through.
- `app/src/style.css`: `.look-picker/.look-tile/...`.
- Tests: NEW `tests/render/character-styles.test.ts` (37), `tests/render/humanoid-model.test.ts` imports/pose tests adapted to moved API.

## Design decisions
- Picker hook: special-case `node.kind==='character' && def.id==='look'` in properties-panel instead of a `ParamDef.preview` field. Reason: the brief limited types.ts to the optional `look` fields; a special case is one line, and a generic hint can be added later if a second picker appears.
- Style registry is keyed by string; node options list (labels) lives in the node def; a test asserts both lists have the same ids.
- Pose state per style is a typed record blended generically (`poseRig`), so styles are ~60-90 lines each; stiff robot uses blend rate 32 + quantized swing.
- Old boards: parseBoard fills missing `look` with default 'human' (verified by test); samples unchanged and still parse/run.

## Verify
- `npx vitest run`: 190 pass (14 files; was 153). New tests: each of 6 looks rests with base exactly on box floor, stays inside box height and horizontal radius (<= 0.5*min(sx,sz), i.e. any yaw) across idle/run both ways/z-run/jump in 2d-side and 3d; base on floor after stopping; owner tagging + recolor; look pass-through node->world; old board without look parses -> human; save round-trip; SceneView rebuild on look change; unknown look -> human.
- `npx tsc --noEmit -p .` clean. `npm run build` ok (existing chunk-size warning only).
- Playwright (`scratchpad/smoke/styles-shots.mjs`, `styles-picker-3d.mjs`; shots in `scratchpad/styles/`): side-stars, picked each style via tile click (aria-checked true each), played; `montage.png` = idle/walk/walk2/jump for all 6; `picker-blue.png`, `picker-red.png` (thumbnails re-rendered after color change); `3d-hop-cat-walk.png`, `3d-hop-cat-jump.png`. Keyboard: ArrowRight x2 from human -> cat, focus follows, one tab stop. Zero console errors/warnings.
- Tutorial: `tut-run.mjs` (all lessons) 67 PASS / 0 FAIL, lesson 1 completes.

## Unresolved / notes
- Figures are small at default zoom; fine detail (jelly face, robot visor) only readable in thumbnails or zoomed.
- No DOM unit test for look-picker (vitest env is node, no jsdom); covered by browser run only.
- Thumbnail rendering is synchronous (6 renders on first panel open per color; cached after).
- Fit may squash a pose by a few percent vertically in extreme swings (needed to stay in box); invisible in practice.

Status: DONE
