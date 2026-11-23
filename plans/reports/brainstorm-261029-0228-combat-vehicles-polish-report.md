# Brainstorm — Sequence lesson, combat, vehicles, polish

- Date: 2026-10-29 02:28 · Status: APPROVED ("1a 2a 3a 4b 5a 6a")
- Execution: 3 sequential jobs (parallel would collide on lessons.ts / item.ts / world.ts).

## Job 1 — polish + lesson 7
- A1 Lesson 7 "Chuỗi việc": learner builds a bot doing 3 sequential tasks with Chuỗi việc + Đi tới (+ carry). Original text.
- B1 Hand tools render ~35% smaller when in hand; tools lying on the ground lie flat (horizontal).
- B4 Item shape `lock` "Ổ khoá" (padlock from boxes); key-door sample uses it. New node `show-text` "Hiện chữ": inputs show:bool (default true), params text, position (corner / above an object via object input `anchor`), color; renders HUD text or floating label above the anchored entity.

## Job 2 — combat (A2)
- `health` "Máu" node: input self:object, heal:bool edge + healAmount param; params maxHp (default 5), showBar; outputs hp:number, hurtPulse "Vừa bị đánh", dead:bool "Hết máu". Health bar above head.
- Damage sources: hand-tool use (empty hand = punch 1; item param `damage` default by shape: kiếm 3, búa 2, cuốc 2, others 1), thrown item hitting a character (item damage), knockback away from attacker, red flash, 0.5 s invulnerability.
- Death (user choice 4b): hp 0 → character tips over (~0.8 s) then hidden automatically; `dead` stays true. Held/carried items released.
- Bot brain `fight` "Đánh nhau": inputs self, target; uses pathfinding to approach, outputs moveX/moveY/jump + attack:bool pulse when in range (wire into Cầm tay.Dùng), backs off briefly after hit; param range, attackCooldown.
- Sample `arena` "Võ đài"; lesson 8 "Đánh nhau".

## Job 3 — vehicles (A3) + bot nav extras
- `vehicle` "Phương tiện": params kind xe hơi/xe máy/xe tải nhỏ, steerMode "Theo hướng" (bots/easy) / "Ga - Lái" (realistic), maxSpeed, accel; inputs moveX, moveY (+ brake?); outputs self, hasDriver, speed, driver:object. Inertia, turning; solid; side mode = left/right drive; top/3d = car steering.
- `enter-exit` "Lên / Xuống xe": inputs character, press edge; outputs inVehicle, vehicle. Seated character hidden/seated pose, follows vehicle, own movement ignored; exit beside vehicle in free spot. Camera follows vehicle when player drives.
- Bots drive: brains output into vehicle (Theo hướng). Pathfinding with vehicle clearance.
- B2 Unreachable goal → path to closest reachable cell.
- B3 Brain nodes param "Tìm đường" Bật/Tắt (default Bật).
- Sample `race` "Đua xe về đích" (bot racer); lesson 9 "Lái xe".

## Global acceptance per job
All previous tests/samples/lessons pass; new unit tests; scripted engine runs of new samples; browser check; tsc/build clean; commit after each job; HANDOFF.md updated.
