# L7 fix report
- Timer: param `repeat` (Không default / Có), handbook param + tip, 2 tests.
- Level 7: tray timer(repeat Có)+latch+not, par 3. Wires: done->toggle, on->go, on->Không->bridge.hiddenWhile. Base keeps on-start->bridge.hide only (Hoặc/Hiện lại removed), else empty answer wins. Tests updated.
- Guard for all 8 levels: solution wires pass canConnect incrementally. Removed self-wire workaround in guide-script test.
- Mascot: FRAME_SHARE 0.9 in mascot.ts; duplicate .pz-mascot-frame CSS merged into mascot.css.
- Verify: tsc ok, build ok, 1753 tests pass, Playwright guide of L7 wins. Shots: plans/reports/shots-l7-fix/ (*-t2.png).
