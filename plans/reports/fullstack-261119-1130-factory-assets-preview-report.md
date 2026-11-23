# Factory assets look study – preview report (2026-11-19)

Status: DONE_WITH_CONCERNS (pack GLBs could not be loaded from the real app server: nothing was listening on :5173; see "Not verified").

## Files
- `plans/previews/factory-assets-261119/index.html` – the page (single file, three 0.160 via importmap from jsDelivr, opens from file://).
- `plans/previews/factory-assets-261119/shot-scripts/take-shots.mjs` – Playwright shots + UI check + contact sheet.
- `plans/previews/factory-assets-261119/shots/*.png` – 60 PNGs.
- Nothing in `app/`, `HANDOFF.md` or other plans was touched.

Run shots: `cd app && PW_ENTRY=<file URL of a module exporting chromium> node ../plans/previews/factory-assets-261119/shot-scripts/take-shots.mjs [group…]`
(groups: agv arm parcel chute belt floor scene ui sheet extra closeup). `playwright` is not installed in `app/` and the old scratchpad copy used by `plans/browser-scripts` is gone, so I installed `playwright-core@1.49.1` in my session scratchpad (matches the installed chromium-1148) and pointed `PW_ENTRY` at it.

## Page
Sticky bar: section links, material toggle "Hoạt hình (như hiện tại)" (MeshToon + the app's 4-step gradient, default) / "Mịn" (MeshStandard), "Tự xoay".
One WebGL canvas over the page, 14 views drawn by scissor (only the visible ones); views of one section share a camera so they orbit together. Drag = orbit, wheel = zoom.
Copy button gives e.g. `AGV=B, Tay máy=A, Cửa thả=1, Băng chuyền=1, Mốc sàn=1, Màu xe=xanh dương, Chất liệu=hoạt hình` (the two last fields are extra to the requested line). The line is also always visible in a text box.
No logo, brand name or livery anywhere; AGV colour via 4 swatches (đỏ, cam, xanh dương, xám).

## Looks and triangle counts (toon mode, parcel excluded)
| Asset | Look | Description | Triangles |
|---|---|---|---|
| AGV | A Bo tròn thân thiện | pill-shaped body in the chosen colour, dark skirt, light band all round in a dark groove, front visor with two "eye" lights, round fender arches, light tray with dark mat and coloured rim on 3 sides | 2,598 |
| AGV | B Công nghiệp gọn | dark hull + coloured wedge shell (sloped nose/tail), black bumpers with yellow blocks, light panel on the nose + side bars, exposed tyres with yellow hub and bar (today's wheel), steel tray with rails, ribs and yellow dump edge | 1,312 |
| AGV | C Phẳng hiện đại | white flat body, coloured foot band, white wheel pods, dark sensor window in front, thin side light lines, dark tray with light mat and coloured corner posts | 2,180 |
| Arm | A Cam xưởng | today's family, tidier: tapered orange links with round ends and light stripe, grey collars with cap, yellow pin, bolts; cone base with yellow ring; black gripper, yellow pads | 2,764 |
| Arm | B Trắng tròn | white tapered tubes, fat white joints with teal caps and glowing rings, cone base with glow ring, white palm, grey fingers with dark pads | 2,792 |
| Arm | C Khung kỹ thuật | twin graphite plates with spacers and an orange cable inside, yellow hubs with dark motor can, square bolted base with yellow band and fork, steel rail palm with sliding carriages | 2,668 |
| Chute | 1 Khung vàng + túi vải | yellow frame, grey square funnel, blue cloth bag on a ring, blue number board on a post | 944 |
| Chute | 2 Viền đèn + thùng nhựa | low dark kerb with green light line, steel chute walls, green wheeled bin, tilted floor sign with yellow number | 1,806 |
| Belt | 1 Khung xanh, chân hở | blue rails, dark belt with chevrons, steel legs, square yellow gate with scanner box, light bar and beacon | 1,706 |
| Belt | 2 Thân kín màu trắng | closed white body on dark plinth, grey belt, teal lips, dark arch gate with light ring | 1,262 |
| Floor | 1 Ô mã trắng | white sticker with abstract block pattern (not a real code) per cell, faint grid lines | texture only |
| Floor | 2 Vòng vàng + vạch đứt | yellow ring per node, dashed light lines, direction arrows | texture only |

All AGV looks are under 3k (A is the heaviest at ~2.6k; body corner segments and the three rounded tray rims are the easy cuts if 8 AGVs need less).
Status light logic shown: blue = empty, green = carrying, amber = tray tilting. Gate lamp blinks green/white while a parcel is within 0.2 m of the gate.

## Parametric mapping (for a render-only port)
Everything is built by functions of dimensions; geometry cached by size, materials by colour (same pattern as `robot-models.ts` / `arm-part-models.ts`).
- `buildAgv(look, d, wheels, color)`; `d = {L, W, H, tray:{L, W, T}}`, `wheels = [{forward, side, radius}]` (one per motor mount, as `view.robot.wheels`). Origin on the floor under the chassis centre (app uses entity centre: subtract H/2), nose +x, right side +z. Body = plates/shell sized from L, W, H (ground gap 0.04). Wheels, fenders (A) and pods (C) are drawn at each mount, so any mount list works; side light length is derived from the free span between wheels. Tray = plate tray.L × tray.W × tray.T on a 0.05 stand, hinged on its +z edge; `setTilt(theta)` turns only the tray group and re-aims the lifting rod. Drawn slightly outside the physical box: wheels/fenders/pods (as today's wheels), bumpers in B (+0.035 m each end), light band in A (+6 mm).
- `buildArm(look, p)`; `p = {baseR, baseH, jd, jw, L1, L2, t, d, palm:{x,y,z}, finger:{x,y,z}, open}`. Per part it matches today's `ArmPartFigure` kinds: joint (hub radius `jd*0.56`, length `jw + margin`, same rule as now), link (pivot to pivot, thickness t, depth d), palm block, finger block ×2 with `side = ±1`; fingers slide along z: centre at `±(opening/2 + pad + finger.z/2)`. `pose(a1, a2, opening, holding)` only sets two rotations and the finger offset. The base is extra draw (cylinder baseR × baseH; square in C).
- `carton(size, kg)` – rounded box + tape band + kg tag sized like `load-tag.ts` (front, back, top).
- `buildChute(look, {hole, drop, n})` – origin at hole centre on the floor top; `drop` = depth to the lower ground.
- `buildBelt(look, {L, W, H})` – belt along x, gate at 0.2 L; moving surface = repeating texture offset.
- `buildFloor(look, w, d, t, holes)` – slab with square holes; 1 marker tile per metre.
- Assumptions made because the sim has no tray/chute yet: tray hinge on the right-hand (+z) edge, max tilt 0.6 rad; chute = hole in a raised floor with the bag below (mezzanine, 0.75 m drop). Both are parameters/easy to change.

## GLBs
- Real attempt from file:// : 0/8 loaded – `ERR_CONNECTION_REFUSED`, no process on :5173 during this run (I did not start one, as instructed). The page showed "chưa tải được model …" plus three code cartons (1/2/5 kg) – shot `parcel-fallback-no-server.png`.
- Loader code path verified with a simulated server (Playwright route answering `http://localhost:5173/models/mega-pack-world/**` from `app/public/models/mega-pack-world/` with a permissive CORS header): 8/8 loaded and rendered – City_14_Parcel_1…5, Public_10_Package_1, Public_10_Package_2, City_4_Box_1 – shot `parcel-glb-simulated-server.png`. Each is scaled to fit 0.5 m; pack thumbnails (`thumbs/…webp`) are shown below as plain images.
- Path note: on disk and in `pack-model-table.ts` the files are `Exteriors/City/…glb` (no `GLB/` prefix; the prefix only appears in manifest.json). The page tries the real path first, then the `GLB/` one.

## Shots (plans/previews/factory-assets-261119/shots/)
- Contact sheet: `contact-sheet-agv-arm.png` (AGV A/B/C loaded, empty, tilting; arm A/B/C open, gripping).
- AGV rows (A/B/C side by side): `agv-flat-loaded-{cam,do,xanh,xam}`, `agv-flat-empty-cam`, `agv-tilt-{lifting,sliding,falling,dropped,empty,front}`, `agv-flat-loaded-smooth`, `agv-rear-low`, `agv-top`, `agv-front-low`, `agv-section`.
- Arm rows: `arm-open`, `arm-grip`, `arm-grip-stretched`, `arm-open-folded`, `arm-grip-from-{side,top,back}`, `arm-grip-smooth`.
- Close-ups 1000×680: `closeup-agv-{A,B,C}-{front,rear,tilt}`, `closeup-arm-{A,B,C}-{side,gripper}`.
- Parcels: `parcel-fallback-no-server`, `parcel-glb-simulated-server`.
- Chutes: `chute-num1`, `chute-num6`, `chute-from-above`, `chute-from-side`. Belts: `belt-idle`, `belt-t4`, `belt-t4_55`, `belt-from-end`. Floor: `floor-markers`, `floor-markers-top`.
- Assembled: `scene-A-A-1-1-1-cam`, `scene-B-C-2-1-2-xanh`, `scene-C-B-2-2-2-do`, `scene-C-B-2-2-2-do-low-front`, `scene-A-A-1-1-1-xam-from-back`, `scene-section`, `ui-after-clicks-scene-section`, `page-top`.

## Checks done
- Read the shots; fixed along the way: triangle counts (A 4.6k → 2.6k, C 4.8k → 2.2k), status light unreadable on same-coloured bodies (dark groove/bezel added in A and B), shadow acne (bias), motor box turning with the joint in arm C (now a can), chute-2 sign hidden behind the dumping AGV (moved to the side), scene too far away (floor 8×6 → 6×5, camera ≈ 9.4 m from centre).
- UI through real input: look/colour/tray buttons, slider, drag orbit, wheel zoom (2.32 → 1.89 m), copy → clipboard held the expected line.
- Console: only the expected connection-refused lines for the GLB/thumbnail requests.

## Not verified
- Real GPU look and frame rate (all shots are headless Chromium + SwiftShader); antialiasing, shadow softness and toon banding can differ slightly.
- GLB loading against the real Vite server from a file:// page. Risk: the app has no `server.cors` setting, and recent Vite versions only allow localhost origins by default; a page opened by double-click has origin `null`, so the GLB fetches may be refused even with the app running. The page then shows the note + code cartons, and the thumbnail images (plain `<img>`, no CORS needed) should still appear. If the owner must see the 3D models: serve the preview folder from any `http://localhost:<port>` (allowed by Vite's default rule) – needs a decision since I was told not to start servers.
- Clipboard on file:// in the owner's Chrome (headless test passed; the visible text box is the fallback).
- Still visible in close-ups (not at sim distance): faint smudgy self-shadow on faces turned away from the key light (e.g. carton back face in `closeup-agv-A-rear.png`); shadow-map artefact, left as is.
- Minor known look limits: a falling parcel is animated, not simulated (can brush the wheel fender mid-fall); the gripped parcel turns with link 2 (no wrist joint in the brief); "Mịn" mode is a little duller than toon under the same lights.

## Unresolved questions
1. Tray hinge side (right edge assumed) and whether chutes are holes in a raised floor or floor-level bins.
2. Should the arm get colour swatches too (currently each arm look has its own palette)?
3. Is ~2.6k triangles for AGV A acceptable, or cut to ~2k?
