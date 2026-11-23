# Puzzle levels 5-8 report (branch feat/puzzle-levels-b)

Files: app/src/puzzle/levels/level-05..08.ts, app/tests/puzzle/levels-5-8.test.ts. 44 tests pass, tsc clean.

| # | Solution | par | Tested wrong answers | Engine limits |
|---|---|---|---|---|
| 5 du-ba-thung | Locked: wheel robot patrol A<->B + carry(toggle) ferries 3 crates to bay. Player: zone (item, preset at bay) .count -> compare(ge).a, locked const 3 -> .b, out -> win. ~26s | 2 | empty=timeout, op gt=timeout, zone elsewhere=timeout | Used patrol.atEnd -> carry toggle instead of routes/push (reliable). Compare op 'lt' would win at once, so op is not editable. |
| 6 ne-linh-gac | distance(hero,guard).within -> not -> hero go-to.go. Threshold editable (tray default 1) | 2 | empty=lose, thr 1=lose, thr 8=timeout; thr 1.5-4.5 win (solution 3) | Guard speed 2 so an always-walking hero meets it; too big a threshold stalls hero forever. |
| 7 cau-nhap-nhay | timer.done->own reset + latch.toggle; latch.on -> bridge.show, robot go; not(latch) -> locked `or`.b -> bridge.hide (or.a = on-start keeps bridge hidden at start). timer seconds editable (tray default 1) | 3 | empty=lose, no go wire=lose, timer 1s=lose, no show=not win; 2/3/5s win | Block hide/show are edge triggered, so bridge starts hidden via locked on-start -> or. Water = zone(bot) -> lose. go-to pathfind off. |
| 8 xuong-tong-hop | Legs robot paces over button pad; touch(legs,pad).touching AND compare(bay.count>=2) -> door.hide; distance/not guard check -> hero go. Alt (tested): latch.set from touch.began instead of touching | 5 | empty=timeout, door only=lose, guard only=timeout, no crates=timeout, thr 1=lose; thr 2.5-3.5 win | Hero waits at the closed door (straight walk, pathfind off). Door is solid so go gating is only for the guard. |

All 3D levels have a locked fixed camera (tilted L5/7/8, top L6), no key/stick, locked win-lose. Every locked node is listed in shownPorts (no overlapping cards).
Looks use PUZZLE_LOOKS (render as default until the look agent merges).
