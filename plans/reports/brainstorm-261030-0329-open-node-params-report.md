# Brainstorm: "mảnh ghép mở" - expose hard-coded tuning numbers

Date: 2026-10-30 03:29. Approved: 1a (fold under "Nâng cao", ParamDef.advanced), 2a (all rows, 4 parallel agents), 3a (per-object gravity scale), 4a (green collider frame when selected in edit mode).
Foundation committed: 2cd6f3c (ParamDef.advanced + panel fold).

| Agent | Nodes | New advanced params (defaults = current constants) |
|---|---|---|
| A collider | block, item, character, vehicle (+ world physics, render edit overlay, touch.ts geometric path) | Cỡ vùng va chạm (vec3, 0 = same as size), Lệch vùng va chạm (vec3), Hệ số trọng lực; item: Độ trượt, Độ nảy; green frame for selected entity in edit mode |
| B character | character, carry, fight | Bậc leo được, Thời gian bất tử, Lực bị đẩy lùi; Thả cách người, Góc ném lên; Thời gian lùi |
| C vehicle | vehicle, cargo, route-follow | Sức phanh, Tốc độ lùi, Tốc độ tính là đâm, Lực hất khi đâm; Khoảng đặt hàng, Số món mỗi tầng; Bán kính tới điểm, Độ gắt khi cua |
| D AI | chase, go-to, path-follower | Khoảng bắt được, Khoảng bắt đầu chạy trốn; Khoảng coi là tới nơi |

Rules: defaults reproduce current behaviour; all old tests green; no sample/lesson edits; constants become per-entity spec fields when they live in world/*.
Risk: A, B, C all touch EntitySpec/types.ts/world.ts -> additive fields only; controller resolves merge conflicts.
