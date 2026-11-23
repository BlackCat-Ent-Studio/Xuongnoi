# Phone layout + logic checker preview — report (2026-11-02)

**Deliverable:** `D:\workspace\GameBuilder\plans\ui-mockups\phone-layout\index.html` (single file, built by `build.sh` from `src/` + approved `cozy-stage/src` props/robot builders; three.js 0.160 and Google Fonts load from CDN).
**Publish:** NOT done. `mcp__claude-artifacts__guide` / `publish_files` are not available in this agent's toolset ("No such tool"), so no artifact URL. Caller should publish `index.html` (title "Xưởng Bot — bố cục điện thoại + kiểm tra logic") from the main session.

## What it does
- Phone frame 844x390 / desktop 1280x720 (scaled down if browser is narrower). Controls outside the frame: Khung, Bố cục A/B/C, Bộ kiểm tra V1/V2/Tắt, "Làm sai thử" (checkbox + which wire: Nhân vật→Cảm biến, Cảm biến→Công tắc nhớ, Công tắc nhớ→Hộp cửa).
- One level (Màn 2 Cửa kho), real 3D stage (legs robot, red button, swing door, flag, same style-A props), cards/wires in the node-style-preview look. Extra locked card "Hộp · Nút đỏ" so the touch sensor has its Vật B.
- Layout A: big toggle "Nối mảnh / Xem sân"; CHẠY jumps to stage; DỪNG returns to board; on a fail it returns to the board after 1.5 s so the explanation is visible.
- Layout B: board full, stage = corner window (follows bot, zoom 2.3). Tap -> full screen; tap once (or ⤡ button) -> shrink; double-tap in big view = camera reset (single-tap shrink waits 340 ms to tell the two apart).
- Layout C (cheap): A + slide transition + swipe (swipe left on board -> stage; swipe right from the glowing left edge strip on stage -> board), dots in top bar.
- Camera (all layouts, when stage is big): drag pan, wheel / ctrl+wheel / two-finger pinch zoom (1x-4x, around the pointer), double-tap or ⟳ = fit, +/- buttons, zoom chip; pan/zoom clamped to level bounds.
- Checker V1: live per-port Đúng/Sai/numbers + glowing cards/pins, white flash + spark on the wire that fires, red pulsing culprit card with "!" and Mèo Mun bubble with plain reason. V2: right-docked collapsible checklist, one row per piece: ✓/✗/…/– , live state, "đổi X s" last change, expected behaviour, red reason on the culprit; footer summary.
- Sim: bot walks, steps button (latch on), door swings open, bot reaches flag (win ~6.6 s). Cut wire -> bot stops at door, fail after 3 s stuck (~7.3 s).

## Verification (Playwright, `shot-phone-layout.mjs`, swiftshader GL)
- 53 PNGs in `plans\ui-mockups\phone-layout\shots\` (all read): layout x checker x ok/fail (mid, end-board, end-stage / pip-full), the other two cut wires, checker Tắt, idle, camera (fit, wheel zoom, drag pan, hard-drag clamp, ctrl+wheel, double-click fit, synthetic pinch, synthetic touch double-tap), B enlarge/zoom/shrink, C swipes, desktop A+V1 and B+V2.
- Asserted numerically: wheel zoom to 3.1x, clamp holds (cx/cy inside bounds), ⟳ / dblclick / touch double-tap return to zoom 1 centre, pinch 1->3.8x, B tap-enlarge/tap-shrink/dblclick-reset, C swipe both ways, DỪNG returns to board in A/B/C.
- Console: no errors or warnings.
- Bugs found and fixed during review: stale "Thua" banner after restart, port values never shown (setPort arg mix-up), bubble clipped/overlapping task box, ctrl+wheel too jumpy, duplicate C dots.

## Known limits
- Not tested on a real phone (touch only emulated via synthetic pointer events); real pinch/trackpad feel unverified.
- V2 shrinks the board to ~0.73x on 844 wide (text ~9 px) unless the panel is collapsed with its ▶ button; this is the main V2 trade-off to judge.
- In B the small window follows the bot at 2.3x (not "fit"); robot is ~40 px tall there.
- Needs internet (CDN) to open; local file path works with network.
- Other levels, 3D redo and real engine wiring are out of scope (preview only; `app/` untouched).

Status: DONE_WITH_CONCERNS
Summary: Preview built and verified locally; artifact publish impossible from this agent (claude-artifacts tools missing).
Concerns: publish step not done; real-device touch untested.

## Update: layout B is now a two-way swap (default)
Board full + stage corner; CHẠY or tapping the corner stage -> stage full, board becomes a live mini board in the corner; tap mini board / DỪNG / ⤡ -> back. Transform-only animation. Stage-full keeps Mèo Mun bubble (V1) or compact checklist (V2); mini board highlights culprit. Script: shot-layout-b-swap.mjs; shots shots/bswap-*.png. No console errors.
