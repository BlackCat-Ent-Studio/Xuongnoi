# Phase 2 — Circuit editor ∥ robot navigation ∥ asset port

## 2A editor (after the user picked the UX preview; owns src/editor/circuits/**, extends graph/group-crumb, editor-state scope → scope path)
- Enter / exit by path, crumb, instance block (picked look).
- Pin cards, exposed settings on the instance inspector.
- "Tạo bảng mạch từ các thẻ đang chọn", "Chuyển nhóm thành bảng mạch".
- Library panel + export / import of a circuit file; starter circuits.
- Bench run with hand-driven pins; live wires inside an entered instance while the parent runs.
- Undo / redo, copy / paste of instances.
- Playwright script per flow + shots read by the controller.

## 2B navigation pieces (owns src/nodes/robot-goto*.ts, src/world/robot-goto*.ts, floor-marker)
- "Đi tới điểm" for robot-body: target x/z or object → left / right motor commands, heading + distance control with open gains, "Đã tới".
- "Mốc sàn": grid markers a sensor can read (id / row / col).
- Right-of-way from pieces (ahead sensor + dispatcher lanes); spike robot-vs-robot decides whether chassis solidity needs an engine rule.
- Tilt tray per spike result (joint + tray link), or report the missing rule.

## 2C assets (render-only: src/render/**, physics shapes unchanged)
Port the picked AGV, arm, parcel, chute, belt, marker looks; pixel compare of untouched objects = 0.

## Done when
User tried on :5173: make a circuit, add pins, reuse twice, bench-run it; an AGV drives to 6 points on the grid; assets as picked.
