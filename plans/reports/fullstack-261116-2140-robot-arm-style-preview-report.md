# Robot arm style preview (2026-11-16)

Page: `plans/ui-mockups/robot-arm-style/index.html` (standalone, three@0.160.0 via jsDelivr importmap, no app code touched).
Screens: `plans/ui-mockups/robot-arm-style/shots/*.png`, contact sheet `plans/ui-mockups/robot-arm-style/contact-sheet.png`. Script: `shot.mjs` (same Playwright/chromium launch as mechanics-check.mjs). No console/page errors in the run. App test suite not run.

## What exists in the page
Looks 0 / A / B / C, switchable; same 2-joint arm + gripper + 3 crates + piston + 2-wheel chassis. Orbit 3D or orthographic 2D side view (2D hides piston/chassis). Sliders: shoulder/elbow angle, 2 link lengths, thickness, pillar height, gripper width, piston stroke, wrist angle. Open/close, "kẹp hướng xuống" (auto-level wrist), elbow axis pitch/yaw (visual only). States: Bình thường / Giữ thùng / Thùng tuột / Thùng bẹp / Khớp quá tải. 3 colour pickers (link, joint, gripper) persist across looks; "Về màu gốc". "Sao chép thông số" copies Vietnamese-keyed JSON (look, state, joints, links, gripper, colours, base height, stroke) with textarea fallback.

## What each look is made of (measured triangles, default params)
| Look | link | joint | base | gripper | crate (+tags) | piston | chassis |
|---|---|---|---|---|---|---|---|
| 0 Hiện tại | box 12 | box 12 | box 12 | 3 boxes 36 | box 12 | 36 | 124 |
| A cozy | capsule + cream ring 308 | cream ball + 2 flattened-sphere caps + 2 rings 648 | rounded foot + rounded pillar + 2 discs 536 | rounded palm + 2 capsule fingers + 2 capsule soft pads 516 | rounded box + 2 straps + 2 tag planes 520 | capsule body + rod + rounded head 652 | rounded body + 2 wheels + hub + caster 804 |
| B factory | extruded tapered trapezoid (bevel) + yellow stripe 56 | dark servo collar + 2 motor caps + 12 bolts + yellow pin 560 | hazard-textured plate + grey pillar + flange + belt + bolts 500 | black palm + motor drum + 2 fingers + yellow pads 404 | rounded box + 8 steel corners + band 412 | orange cylinder + dark end caps + chrome rod + black head 416 | body + bumper + 2 wheels 672 |
| C asset-like | 6-sided tapered prism 48 | 8-sided prism + 2 cone caps 96 | 2 stacked 8-sided frusta 96 | box palm + 2 extruded chamfered fingers 44 | box + 2 slats 40 | 80 | 164 |

Materials: 0 and C Lambert (C flatShading); A toon, 3-step gradient (same as the cozy robots); B toon, 4-step gradient. Tags are cached canvas textures (192x96) on basic material. Pieces are 40..650 tris except A gripper/piston and B/A chassis (500..800); a full scene is 4.4k (B) to 6k (A) tris, C 0.8k. The three 3D looks are cheap enough; A is the heaviest because of rounded boxes (RoundedBoxGeometry segments 2) – drop to segments 1 or capsules if needed.

## How it stays parametric
Every part is a pure function of its values, rebuilt on each change (geometry disposed): `base(H)`, `joint(axis, colour, T)`, `link(L, T, colour)`, `gripper(gap, colour)`, `crate(label, damaged, colour)`, `piston(stroke)`, `chassis()`. Sizes derive from the params: joint radius = 0.7*T + 0.1; link capsule/prism/trapezoid built for any L (stripes/bands placed at fractions of L, so 0.2-3 m work); gripper fingers placed at gap/2, palm width follows gap (0.3-1.5 m), pads and fingers are fixed size. Colour: one input hex per piece; look derives shades by HSL lightness offsets (`adj`), e.g. A ring = joint colour -14% lightness, B link stripe = link +22%, C cap = joint +14%, so any custom colour keeps a harmonious 2-tone. Chain 1-3 joints = repeat joint+link inside nested groups (page demos 2 joints + gripper; wrist slider shows a third rotation). Axis yaw = joint group rotated 90 deg about x.
States: held crate is a child of the gripper (gap = crate size); crush = crate scaled 0.6 along grip axis and 1.12 on others plus colour -22% lightness/-15% saturation; slip = crate lying tilted on the floor under open-ish gripper; overload = pose sags (+16 / +22 deg), red torus ring + translucent red sphere on each joint pulsing (sin 8 rad/s), plus a red "!" triangle sprite above the joint (world-space, depthTest off).

## Porting notes (app/src/render)
- Arm pieces are currently `type: 'block'` entries (one `BoxGeometry` + `MeshLambertMaterial` with `e.color`) in `scene-view.ts` (~line 400); `damaged-look.ts` (`DAMAGED_HEIGHT 0.6`, `DAMAGED_WIDEN 1.12`, `damagedColor`, `tintDamaged`) handles crushed crates; item crates go through `item-shapes.ts` (`buildItem`).
- Best seam: a new `arm-part-models.ts` exporting `buildArmPart(kind: 'joint'|'link'|'gripper'|'base'|'piston'|'chassis', params, look)` returning a Group, hooked in `scene-view.ts` where the block entry is created and rebuilt when size/colour/open change (same rebuild rule as `canReuse` for items). Look = a table of material factory + geometry builders like `character-styles/` (`kit.ts`, `toon-parts.ts` already have toon gradient + rounded helpers to reuse for A/B).
- Joint/gripper/link node defs (`nodes/joint.ts`, `gripper.ts`, `linear-actuator.ts`) need to expose to the renderer: axis, length, thickness, gripper opening, overload flag. Overload glow needs a per-frame pulse hook (game-loop.ts) and a state flag from physics.
- Crate tags need a shared canvas-texture cache; the "2 kg / 6 kg" label should come from the entity mass.
- A/B rely on `RoundedBoxGeometry` and `ExtrudeGeometry` from three/examples (already used by robot-wheel.ts for the former). C needs nothing beyond core.

## Open questions
1. Which look (or a mix: e.g. A materials + B bolts)? Per-theme choice or one global look?
2. Hold direction: page assumes gripper opening lies in the arm plane (visible in 2D). In the physics sim is the opening perpendicular to the arm plane instead?
3. Crush squash axis: page squashes along the grip axis (matches "crushed by fingers"); app currently squashes height. Keep app behaviour?
4. Gripper "closed without crate" gap fixed at 0.06 m; fine?
5. Pillar is drawn as a simple column per look; the real base is "any block" – should the look restyle arbitrary blocks (hazard plate under them) or only a dedicated base piece?
6. Colour param: one colour per piece, shades derived automatically; do users need a second (accent) colour?
7. Piston/chassis drawn for visual family only; their parameters (stroke, wheel size) were not explored beyond stroke.
8. Verified only in swiftshader Chromium at 1400x860; not tried on phone-sized viewport (CSS has a narrow layout but unchecked).
