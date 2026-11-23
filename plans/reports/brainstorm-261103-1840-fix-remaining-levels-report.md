# Brainstorm — fix remaining levels + L7 phone (2026-11-03 18:40)
User: 1a (keep win = blue crate in each of 3 slots; crate lane 1.12), 2a (L7 phone: tray one scrollable row, cat bubble avoids the card it points at), "sửa luôn các màn bạn định sửa".
## Scope (3 parallel agents)
- A ui-phone (5224): puzzle tray single horizontal scroll row on phone; guide bubble placement never covers spotlit card/port. All levels benefit. No level data.
- B L5 (5225): remove hidden puzzle-only `fetch-store` brain; L5 runs only on editor-registered pieces, logic cards VISIBLE locked (left), new general node "Tìm vật gần nhất" (+ reuse next-free-slot, go-to, carry, math). Player tray/solution/par/stars unchanged (minimal solution target move allowed, report). Then move parkingSpot out of slot-patrol and delete slot-patrol + fetch-store if no active level uses them (archive L8 import must keep compiling: archive can keep a local copy or be excluded—report).
- C L6 (5226): new "Lẻn qua mắt lính gác" per approved preview v2 (guard-vision): legs-robot guard patrol + drawn vision fan; cat-chibi cover-to-cover; seen = lose; new general node "Dự đoán tầm nhìn" (seconds until viewer's sight covers a point/segment, using its patrol route) + route-follow advanced "Chạy từng chặng" (step to next point on input, latched dash); player wires So sánh (Còn ≥ Cần + 0.5) → Chạy chặng kế; decoy Đo khoảng cách; sensors/guard/cat movement = visible locked cards. Values locked in safe band (patrol 3.2–3.4, guard speed 1.3–1.6, cat 3–3.4).
- L4: hidden pieces are general nodes (not forced code) — leave; audit later.
## Shared-file conflicts expected
nodes/index.ts, node-names.ts, node count test (B +1, C +1), handbook index, course packs → resolve keep-both at merge.
