# Brainstorm: tunable params for Cảm biến vùng + Cảm biến chạm

Date: 2026-10-30 03:22. Status: approved by user (1a: param list as proposed, 2a: two parallel agents).

## Problem
Sensors only have "touch the edge" semantics; makers cannot tune how/when a contact counts (user compared to Unity collider tuning). Scope = sensor nodes only; no game/sample edits, no new node kinds.

## Cảm biến vùng (nodes/zone-sensor.ts)
- Xoay theo vật (when Bám theo vật is wired: center offset + box rotate with the followed entity's facing/heading). Default off.
- Chỉ tính loại hàng (text; matches entity tag; empty = all). Default empty.
- Tính khi nào: Chạm mép (default, current) / Tâm vật vào trong / Nằm trọn bên trong.
- Ít nhất bao nhiêu vật (inside true only when count >= N). Default 1.

## Cảm biến chạm (nodes/touch.ts)
- Nới / thu vùng chạm (number, + = farther, - = must overlap deeper). Default 0.
- Tính khi nào: Chạm mép (default) / Tâm A vào trong B / A nằm trọn trong B.
- Chạm bao lâu mới tính (seconds). Default 0.
- New output: Vừa thôi chạm.

## Acceptance
- All defaults reproduce current behaviour exactly; existing lessons/samples/tests unchanged and green.
- Headless tests per new param; 2D-side, 2D-top, 3D axis handling.
- Zone marker visible in edit mode reflects size/rotation where cheap.

## Risks
- Touch default path must keep using world contacts (physics) for exact back-compat; geometric path only when params differ.
- Rotated zone = OBB test; keep it 2D yaw only.
