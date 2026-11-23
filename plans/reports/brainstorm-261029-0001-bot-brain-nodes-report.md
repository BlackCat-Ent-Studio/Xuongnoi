# Brainstorm — Bot "brain" nodes

- Date: 2026-10-29 00:01 · Status: APPROVED ("1a, 2a, 3b")

## Key insight
A bot = a Nhân vật whose control wires come from brain nodes instead of keys. Existing Cầm/Thả, Cầm tay, Tương tác already take any character → reused as-is.

## Decision
Approach A: small brain nodes (category new "Bộ não" or existing "Hành động" — implementer picks; prefer new "Bộ não"). Pathfinding included (user chose), delivered in a 2nd wave.

## Nodes
| kind | vi | inputs | outputs | params |
|---|---|---|---|---|
| patrol | Đi tuần | self:object (the bot), on:bool (default true) | moveX, moveY:number, atEnd:pulse | pointA vec3, pointB vec3, wait (s), turnAtEdge (bool select) |
| go-to | Đi tới | self:object, target:object (optional), go:bool (default true) | moveX, moveY:number, jump:bool, arrived:bool, arrivedPulse | targetPos vec3 (used if target unwired), stopDistance |
| chase | Đuổi theo / Tránh xa | self:object, target:object | moveX, moveY, jump, seeing:bool | mode select đuổi/tránh, sightRange, giveUpRange |
| sequence | Chuỗi việc | next:bool edge "Xong việc", reset:bool edge | step1..step6:bool (active step held true), stepPulse1..? → keep simple: each `stepN` true while active + `started` pulse per step; `index:number` | stepCount (2–6), loop (bool select) |
Sequence advances on `next` rising edge (wire from go-to.arrivedPulse, carry.holding etc).
Moves output −1..1 in the same convention as Cần điều khiển so they wire into Nhân vật moveX/moveY; jump into Nhân vật.jump.

## Character role
Nhân vật new param `role` "Vai trò": player (default) / bot. Camera follows first `player` character (fallback first character). Old boards unchanged.

## Steering (wave 1) / pathfinding (wave 2)
- Wave 1: straight-line steering; side mode: jump when blocked by ≤1.5-high obstacle or at gap edge toward target; turn at edge for patrol if turnAtEdge.
- Wave 2: pure `src/world/navigation/*` — grid A* on XZ for 2d-top & 3d (cells blocked by solid blocks, character size clearance); 2d-side platform graph (walk, jump up ≤2 cells, jump gap ≤2 cells, drop down) with A*; recompute path at most every 0.5 s or when target cell changes; follow waypoints; fallback to straight steering when no path. go-to & chase use it.

## Samples + lesson
- `guard-patrol` "Lính gác" (2d-side or 2d-top — implementer picks what reads best): bot patrols, chases player when seen, touch player → lose; player gets key → door → win.
- `cleaner-bot` "Bot dọn dẹp": sequence: go-to crate → grab → go-to bin → drop → loop; counter of crates delivered (touch crate-bin zone → hide crate, +1) → win when all done (watching game).
- Lesson 6 "Tạo bot" (original text).

## Out of scope
Bot vision cones/occlusion, combat AI, multi-bot coordination, moving platforms.

## Acceptance
Unit tests for each brain node + role camera choice + (wave 2) pathfinding on fixtures (maze top-down, platforms side); samples scripted engine runs (guard catches idle player; cleaner delivers all crates unattended); lesson 6 completes in browser; all previous lessons/samples pass; tsc/build clean.
