# Cozy stage design preview — report

Date: 2026-11-01. Nothing under `app/` touched. Not committed, not published.

## Deliverable
- Page: `D:\workspace\GameBuilder\plans\ui-mockups\cozy-stage\index.html` (generated; sources in `src/`, rebuild with `sh build.sh`).
- Needs internet (three.js 0.160 from jsDelivr, Google Fonts Baloo 2 / Be Vietnam Pro). Open the file directly in Chrome/Edge.
- Verification: `shot-cozy-stage.mjs` (42 PNGs in `shots/`), `sim-check.mjs` (60 s sim loop of every scene, bridge fall, UI toggles, copy JSON). Both: no console errors.
- URL helpers for testing: `?scene=l2|l3|l5|l6|l7|kit&frame=stage|phone|desktop&scale=1.6&zoom=1&follow=0&t=3.2&bare=1&mask=1&floor=tile&item=door-open&bridge=hide`.

## What is in it
| Scene | Content | Characters |
|---|---|---|
| Màn 2 Cửa kho (2D side, ortho, 11.5 deg pitch) | plank floor slab, cream plank wall + wood wainscot, window+plant, shelf, 2 swinging lamps, wooden door in frame (sinks into floor), red round button (presses), red flag (waves) | legs robot (see note 1) |
| Màn 3 Nhặt sao (2D side) | 3 chunky gold stars (spin), cat hops to grab each, picket gate sinks, flag | cat chibi |
| Màn 5 Đủ ba thùng (3D tilted) | wooden tray with low walls, plank (or warm tile) floor, 3 rounded crates + decor stack, painted storage pad (sage paint, cream border, honey corners, box icon, chevrons) | wheel robot carries crates in |
| Màn 6 Né lính gác (3D) | goal pad (disc+ring+star), painted patrol lane, plant | cat chibi waits, cat quad patrols |
| Màn 7 Cầu nhấp nháy (3D) | two banks, water channel with ripples/foam, plank bridge that drops in plank by plank and sinks out, flag; buttons: auto / always show / always hide (robot falls if bridge vanishes under it, then restarts) | wheel robot |
| Bộ đạo cụ | "Tất cả" grid of 20 labelled turntables, or one prop big: door closed/open, button up/pressed, flag, lamp, crate, star, zone pad, goal pad, bridge shown/half, gate closed/open, floor planks, floor tiles, wall piece, window, shelf, plant |

Controls (Vietnamese): scene picker; frame = Sân khấu 370x390 / Cả màn 844x390 / Máy tính; slider Cỡ nhân vật 1.0–2.0; slider Thu phóng 0.6–2.0; camera follow; overlay of areas covered by the hint box / HUD; floor style (3D); play/pause/restart; "Sao chép thông số" (JSON with scene, frame, charScale, zoom, charHeightPx...; textarea fallback if clipboard blocked). Caption under the frame shows the main character's real pixel height for the current frame.

Characters: builder code copied from robot-wheel (mudguard mount), robot-legs, cat-chibi, cat-quad. Look unchanged; only invisible expression extras (tears, zzz, box, anger marks, sparkles) were left out. Animations: idle/walk/happy ported; wheel spin follows speed.

## Defaults picked
- Frame: Sân khấu 370x390. Reason: in style A the stage is only the left ~44% of the 844x390 screen, and the hint bubble covers the bottom ~29%. Floor line sits at 68% of height so feet stay above the bubble.
- Cỡ nhân vật 1.6, Thu phóng 1.0, follow camera on. Result at 370x390: ~175px tall in 2D side (35% of frame height), ~107px in 3D (27%). At 1.0 the 3D robot is ~65px. Slider range 1.0–2.0 as asked; 1.4–1.8 is the useful band.
- 2D side view shows ~8 world units of height, so only ~7 units of width in the narrow stage → camera must follow (hence the follow toggle); "Thu phóng" 0.6 shows the whole level.

## Triangles (rendered, after 2.5 s of play)
| Scene | Triangles |
|---|---|
| Màn 2 | 11.8k |
| Màn 3 | 13.2k |
| Màn 5 | 31.7k |
| Màn 6 | 16.4k |
| Màn 7 | 30.8k |
| Kit (20 props) | 44.2k |

Breakdown: wheel robot is ~25k of the 31–35k in Màn 5/7 (fine spheres/torus: head 44x28, tire 18x48). Cats ~8k each, legs robot ~5.5k. Stage geometry (floor, walls, props) is ~5–9k per scene. Floor/walls are merged quads (2 tris per plank). For phones, dropping the wheel robot's sphere/torus segments (head 44x28 -> 28x18, tire 18x48 -> 12x32) would cut ~12k with no visible change; I did NOT do it because the brief said not to alter the characters.

## Findings that affect the port
1. Level data vs brief: Màn 2 cast is `robotLegs` (I used legs robot, not wheel); Màn 3 is `mode: '2d-top'` in data (I built the side view you asked for; a top-down version of the star level would need a different stage); Màn 6 camera is `top`, I used the shared tilted camera.
2. Collision boxes are not visuals: door is 0.8x8 in data (I drew a 3.6-high door; keep the collision box, shrink or hide its debug render); floors are 30x14 in data (preview trays are 25x9.2, patrol 4 instead of 5 half-length, bridge/water 4.4x8.4).
3. Door, gate pickets and bridge planks hide by sinking below y=0 / the water, using material clipping planes (`renderer.localClippingEnabled = true`) so no floor occlusion is needed. In the game either keep that flag or drive `visible` after the slide.
4. Everything is toon/lambert + vertex colours; the only generated textures are two small canvas gradients (blob shadow, lamp glow). No files.
5. Tested only on software GL (SwiftShader) in headless Chromium: look and counts are valid, frame rate on a real phone is NOT measured.

## Unresolved questions
- Which frame/size feels right to you (370x390 stage at 1.6? or bigger)? Tell me the copied JSON.
- Keep the two-lamp wall decor in 2D scenes, or only one?
- Accept the 3D stages as a small diorama tray (lit wooden walls) instead of an endless floor?

Status: DONE
Summary: Standalone preview built and verified by reading screenshots of all 5 stages plus prop kit at 1280x720, 844x390 and 370x390; zero console errors, sim loops and UI toggles tested.
Concerns/Blockers: wheel robot is ~25k triangles (unchanged by request); real-phone performance not measured; see "Findings that affect the port" for data/brief mismatches (Màn 2 legs robot, Màn 3 is 2d-top).
