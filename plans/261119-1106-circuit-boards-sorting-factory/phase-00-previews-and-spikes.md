# Phase 0 — Previews + spikes (no change to main)

## Outputs
1. `plans/previews/circuit-boards-261119/index.html` — clickable UX preview of circuit boards:
   - 4 levels (Xưởng › Trạm nạp › Tay máy › thẻ) with the crumb bar;
   - instance block look, 2–3 variants to pick from;
   - pin cards "Chân vào" / "Chân ra", "Thông số mở";
   - "Chạy thử máy này" bench with hand-driven pins;
   - library panel;
   - light "Xám dịu" + dark, modes Học sinh / Giáo viên. Tokens from `plans/previews/ui-redesign-261118/index.src.html` (direction c, SOFT.s2).
2. `plans/previews/factory-assets-261119/index.html` — three.js page:
   - AGV with tray ×3 looks, arm ×3 looks;
   - parcels (pack GLBs via http://localhost:5173/models/…), chute + bag, belt + scan gate, floor marker;
   - turntable + states (tray flat / tilted, gripper open / closed).
3. Spike report `plans/reports/researcher-261119-1130-factory-spikes-report.md` (worktree ../GameBuilder-spike, branch spike/w0, never merged):
   - tilt tray: crate on a solid link mounted on a chassis joint; rests while flat, slides off when tilted, stays on while driving (numbers per tick);
   - robot vs robot: do two robot-body chassis collide / push under "Vật lý thật"; measured stop gap of a follower using the ahead sensor;
   - placement: every vec3 param of every node kind classified world-position vs size / other → proposal for a `ParamDef` flag;
   - cost: ms per tick for 8 copies of the AGV sample graph (flat) in node.

## User picks so far (11-19 ~11:50)
- Block look: **B "Thẻ thiết bị"** (said by the user).
- CONFIRMED by the user 11:46 (`1b,2b,3c,4c,5c,6b`): bench layout "Dải bên dưới"; library = group "Bảng mạch" inside the existing piece palette; editing inside a copy = direct for Giáo viên, "Sửa mạch" button first for Học sinh; repeated machines stack as "Xe AGV ×8" that expands; no separate level-1 view (a card only shows its properties).
- UX preview report: plans/reports/ui-ux-designer-261119-1130-circuit-boards-preview-report.md (32 shots, controller read 5).

## Asset picks (user, 11-19 ~12:20, pasted from the preview)
`AGV=A, Tay máy=A, Cửa thả=1, Băng chuyền=1, Mốc sàn=2, Màu xe=cam, Chất liệu=hoạt hình`.
Not answered → taken and told to the user: parcels = pack models AND code cartons with kg tag; robots solid vs each other under "Vật lý thật"; link gets a width + own mounted parts are not payload; the 4 scan fixes happen in wave 1.
CONFIRMED by the user 11:57: parcels = everything in the preview EXCEPT Package 1 and Package 2 (so Parcel 1–5, Box 1, and the code cartons with kg tag); 7a robots solid; 8 (read as 8a: link width + payload fix; user wrote only "8"); 9a scan fixes in wave 1.
Spike results: plans/reports/researcher-261119-1130-factory-spikes-report.md. Phase 0 CLOSED.

## Done when
User picked block look, bench layout, AGV look, arm look; spikes answered GO / NO-GO with numbers; new gaps added to the design report.
