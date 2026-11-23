# L3 "Nhặt sao" real stars — report (branch feat/l3-real-stars, worktree D:\workspace\GameBuilder-l3stars)

## Circuit (par 8, 18 player wires)
Board shows: Mèo, Sao 1-3, Cổng. Hidden scenery left: goal flag, touch-goal, ground, end (win plumbing). Old hidden star touch cards + wires deleted.

Pieces (tray = these 8 + 1 decoy "Và"): Khi bắt đầu, Chạy theo tuyến, Chạm nhau x3, Hoặc x2, Bộ đếm (goal 5 -> player sets 3).

| id | wire |
|---|---|
| s1 | Mèo.self -> Chạy theo tuyến.self |
| s2 | Tuyến.moveX -> Mèo.moveX |
| s3 | Khi bắt đầu.started -> Tuyến.on |
| t{k}a | Mèo.self -> Chạm nhau k.Vật chính |
| t{k}b | Sao k.self -> Chạm nhau k.Vật kia |
| h{k} | Chạm nhau k.Mới chạm -> Sao k.Ẩn đi |
| c1 / c2 | touch1.Mới chạm / touch2.Mới chạm -> Hoặc 1.A / .B |
| c3 | Hoặc 1.out -> Hoặc 2.A |
| c4 | touch3.Mới chạm -> Hoặc 2.B |
| c5 | Hoặc 2.out -> Bộ đếm.Cộng 1 |
| s4 | Bộ đếm.Đã đủ -> Cổng.Ẩn suốt lúc bật |

Par is 8, not 6-7: one input takes one wire (canConnect "input-taken") and "Hoặc" has only 2 inputs, so 3 star signals need 2 Hoặc. No smaller circuit found (touch per star is mandatory; counter has no 3-input gather).

## Two design decisions the brief did not foresee
1. Route preset changed. Keeping the star points in the walk (p1..p3 = stars) let the player count the route's own "Tới điểm" with 3 pieces (route, start, counter), no stars wired: the cheaper-win search found it. The preset walk now has 2 points, both beyond the gate (x 11, 12), so the cat still walks by route but its "Tới điểm" can never fire before the gate opens. Walk no longer carries any star coordinate. Test locks this.
2. **Hide wire is cosmetic (acceptance item NOT met).** "Removing each star's hide wire -> no win" cannot hold: the engine's hide is a pure visual effect; count and gate come from the touch. I tried making stars solid so a visible star blocks the cat (hide wire then load-bearing, per-wire removal test passed) but the tray route's "Nhảy"/"Bị chặn" outputs then become a count source (cheaper win via route.jump -> Hoặc -> counter). So stars stay "pickup". Tests: generic single-wire test skips h1-h3 for nhat-sao; a level-3 test asserts the win is unchanged without them. All other wires (s1-s4, t*a/b, c1-c5), every piece, and removal of each star object -> no win. Physics invariant "star is hidden at the win" still passes (needs the hide wires in the reference solution). Decision for you: accept, or allow an engine change (e.g. a block output "Đã ẩn" or touch ignoring hidden things) so the hide can matter.

## Files
- app/src/puzzle/levels/level-03.ts (rebuilt; CRLF kept)
- app/src/puzzle/ui/guide-script.ts (WIRE_LINES nhat-sao: 18 lines)
- tests/puzzle/levels-1-4.test.ts (level 3 block rewritten + skip of cosmetic h wires)
- tests/puzzle/levels-1-4-board-pieces.test.ts (hidden list), tests/puzzle/hint-rules.test.ts (L3 now 3 free hints)
- Task/hint texts updated in level-03.ts. L3 has no mandatory guide (not in LEVEL_INTRO); unchanged, nothing broke.
- Browser scripts: plans/browser-scripts/l3-stars-lib.mjs (port 5234 copy), l3-real-stars-shots.mjs

## Tests
- tsc clean. tests/puzzle full: all green after fixing the 4 stale assertions (hint counts, hidden list). Full vitest: see Status line below.
- New L3 coverage: reference wins; empty fails; every wire except h* removed -> fail; every piece removed -> fail; touch wires and piece per star; each star object removed (base mutation) -> fail; goal 5/4 -> shut, 3 -> win; canConnect for every wire in order; locked cards no overlap (gate moved to y 450, stars 100 apart); cheaper-win search with decoy "Và": no wins; decoy over-build = 2 stars.

## Screenshots (plans/reports/shots-l3-real-stars/, read myself)
l3-empty/built/run-mid/won for desk 1280x720 and phone 844x390. Reference solution built with real clicks, run, win card shown on both. The solved board is dense (wires cross; plenty of wire overlap at default zoom, cards partly under the top bar) — free board pan/zoom needed to see it all; I did not change any layout/CSS.

## Unverified
- Real phone / touch; wire readability of the 18-wire board for a child; free-hint step text (hint order) not eyeballed in UI beyond guide-script tests.

# v2 (user: 2 stars, hiding must matter) — merged main d701b7d, then:

## Engine (general, rule 4)
- New `NodeDef.optionalOutputs {all, active(params)}` + `activeOutputs/knownOutputs/knownOutputsOf` in engine/registry.ts, same style as optionalInputs. Active ports: runtime tick, card (node-view), size estimate, properties panel. Known (all) ports: canConnect, port-compat, groups, wire colour lookup, guide labels, node-names.
- Block "Vật thể": advanced select "Báo đang ẩn" (showHiddenOut, default no). On = output "Đang ẩn" (id `hidden`, En "Hidden"), true while hidden (hide pulse or Ẩn suốt lúc bật). Evaluate returns `hidden` ONLY when the option is on, so default results stay byte-identical.
- Default unchanged: full suite incl. solid-off baselines, sample/lesson/handbook hashes, hand-tools "usedOn" exact outputs all green; estimateNodeSize test (+26 px only when on). Handbook: param text + tip on the block page (optional port not listed, same as route-follow object inputs).
- Tests: tests/nodes/block-hidden-output.test.ts (false -> true after hide -> false after show; drives another block; hiddenWhile; default ports/size/canConnect; save/load).

## L3 v2 circuit: par 5, 12 wires
Pieces: Khi bắt đầu, Chạy theo tuyến, Chạm nhau x2, Và (tray: these + 1 extra Và as spare; Hoặc not used, "Đảo ngược" rejected: a lone Not outputs true and starts the route with no start piece). No counter, no editable param. Stars at x -3 and 3, showHiddenOut on, shown: in Ẩn đi, out Vật thể + Đang ẩn. Route points still beyond the gate.
Wires: s1 Mèo->route.self, s2 route.moveX->Mèo, s3 start->route.on; per star t{k}a Mèo->touch.a, t{k}b Sao->touch.b, h{k} Mới chạm->Sao.Ẩn đi, g{k} Sao.Đang ẩn->Và.A/B; s4 Và->Cổng.Ẩn suốt lúc bật.
Acceptance met: reference wins, empty fails, removing ANY wire (incl. h1, h2, g1, g2) or piece -> no win, removing star-1 or star-2 object -> no win, every wire passes canConnect, locked cards no overlap (stars y 150/280, gate 450), physics invariants green, tsc clean, full vitest 160 files / 2681 tests green. Guide WIRE_LINES, task and hint rewritten. L3 still has no mandatory guide.

## NOT met: "no cheaper win" (inherent, needs your decision)
The cheaper-win search finds 4-piece wins, and I confirmed a 3-piece one by hand:
1. Fan-out: one "Chạm nhau" "Mới chạm" wired to BOTH stars' "Ẩn đi" (drop the second touch): both stars hide when the cat touches star 1. A sensor pulse can always feed several inputs.
2. Direct: Sao 1 "Đang ẩn" straight into the gate (no Và, no second touch); star 2 is a pickup the cat just walks through. (The search did not report this one, my probe did.)
These exist for any design where the gate reads a star's hidden state, because the engine does not force the cat to really touch each star. The earlier counter design was immune. Tests: the generic search test allows only the fan-out family for nhat-sao; a level-3 test pins both shortcuts as known (so a change shows up). Options: (a) accept (par 5 = intended route, shortcuts cost less but are odd to find), (b) solid stars (kills shortcut 2; fan-out still works; adds the route "Bị chặn/Nhảy" count exploits only if a counter returns), (c) go back to counter design with 2 stars (immune to both).

## Screenshots v2 (plans/reports/shots-l3-real-stars/l3v2-*.png, read myself)
empty/built/run-mid/won, desk 1280x720 and phone 844x390; both win. Stars show "Ẩn đi" in, "Vật thể" + "Đang ẩn" out. Scripts: plans/browser-scripts/l3-real-stars-shots-v2.mjs. Dev server :5234 left running (worktree GameBuilder-l3stars).

# v3 (user chose option b: solid stars)
- level-03.ts: stars `type: 'solid'` (only change in data; no engine change). "Chạm nhau" in default edge mode still fires against a solid star (cat stops against it, touch began fires, star hides, cat walks on). No grow needed.
- Proved: without h1 or h2 the cat is stopped in front of that star -> timeout (tests + screenshot l3v3-stuck-star2-*). Direct shortcut (Sao 1 Đang ẩn -> gate, no Và/touch2) now does NOT win (pinned by a test). Reference wins; each wire/piece removal and each star object removal still no win.
- Cheaper-win search (tray 5 pieces + spare Và): only two shortcut families, both "a signal feeds more than one input": (1) one touch "Mới chạm/Đang chạm/Vừa rời" into both stars' Ẩn đi (user accepted); (2) NEW: route "Nhảy" pulse (fires when the route is blocked by a solid star) wired into a star's Ẩn đi in place of that star's touch (4 pieces). Route "Đang bị chặn" gives no win, nothing found that opens the gate or hides stars via blocked. The generic search test allows exactly these two patterns for nhat-sao; a level-3 test pins both as winning.
- Physics invariants unchanged and green (stars hidden at win, cat past the gate). tsc clean; full vitest 160 files / 2683 tests green.
- Screenshots (plans/reports/shots-l3-real-stars/, read): l3v3-built-{desk,phone}, l3v3-run-mid-*, l3v3-stuck-star2-* (hide wire of star 2 removed: cat waiting at the star after 5.5 s, no win card), l3v3-won-*. Script plans/browser-scripts/l3-real-stars-shots-v3.mjs. Dev server :5234 left running.
