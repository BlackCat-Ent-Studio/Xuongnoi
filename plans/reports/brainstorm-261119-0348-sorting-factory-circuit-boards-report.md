# Brainstorm — Xưởng phân loại kiện hàng + "bảng mạch" nhiều tầng (2026-11-19, rev 11:06)

Status: DESIGN PRESENTED, waiting on user approval + 4 answers (end). Nothing built.

## Source
- Clip `c:\Users\trong\Videos\Screen Recordings\Screen Recording 2026-11-18 160421.mp4` (20 s, AGV sorting centre): belt + scan station → many tilt-tray AGVs on grid floor → drop holes into bags → queue back.
- User (03:48 → 11:06): sample like the clip WITH robot arm; remake AGV + arm looks, add parcels; keep a gap list; each machine = its own circuit board, boards composed into one system; **"làm đầy đủ các tầng", product is for FUNDRAISING, do it complete**.

## Decisions taken from the user's words
- Boards nest: Linh kiện (thẻ) → Mạch máy → Trạm (cụm máy) → Xưởng. No reduced one-level version.
- One board TYPE used by many machines (edit once, all copies follow); each copy has its own open settings.
- Pins chosen and named by the learner (cards "Chân vào" / "Chân ra" inside the board).
- Factory rules: existing logic cards on the factory board + new general piece "Bộ điều phối".
- Asset remake of AGV + arm allowed (explicit user request), preview first.
- Look/UX of anything visible: preview → user picks → port (memory feedback-no-unpreviewed-ui).

## Scout facts (code)
- Engine takes ONE flat graph: `compileGraph(graph)` 82 lines (src/engine/compile.ts:45). Boards can be expanded to a flat graph BEFORE it → engine, physics, hash guards untouched.
- `Graph` = nodes, wires, groups?, settings?, knots? (src/engine/types.ts:221). `Board` = name, mode, graph, notes. Save format versioned with step migrations (src/io/save-format.ts, migrations.ts).
- Groups ("Nhóm mảnh ghép", ec804f7): editor-only folding, ports derived from crossing wires (group-model.ts:156 `deriveGroupPorts`), enter/exit scope in editor-state.ts (`scope`, `enterGroup`, `exitGroup`), crumb bar "Bảng chính › tên", no nesting. Used by 1 sample (city-delivery-3d).
- Duplicate / paste give fresh node ids (clipboard.ts `pasteClip`) → a copied robot IS a new robot, but at the same world position and with no link to the original.
- go-to / route-follow drive bots + vehicles, NOT robot-body. Arm 2-joint + gripper, piston unload, scale + value-table, spawner + timer all proven under real physics.
- Parcel models in the licensed pack: City_14_Parcel_1..5, Public_10_Package_1..2, boxes.

## Design

### D1. Data model
- `Board.circuits?: Circuit[]` = library of board TYPES saved inside the file. `Circuit` = id, name, colour/icon, graph (nodes, wires, knots), pins (ordered: id, label, dir, type, inner port), exposed settings (label → inner node param), `bench` node ids (test-only scene).
- New node kind `circuit` (instance): params = circuit id + per-instance values of exposed settings + placement (position, heading).
- A circuit graph may contain `circuit` instances of OTHER circuits (nesting). Cycle = rejected at edit time; depth cap 4.
- `expandBoard(board) → flat Graph`: every instance replaced by its circuit's nodes with ids `inst/inner`, wires to pins re-pointed at inner ports, exposed settings written into inner params, placement applied to world-position params, bench nodes dropped. Pure, deterministic, tested: expanded graph of a hand-built reference == same hashes as the flat board.
- Old files: no `circuits` → unchanged (no migration needed); groups keep working; inspector action "Chuyển nhóm thành bảng mạch".

### D2. Editor
- Navigation: crumb "Xưởng › Trạm nạp › Tay máy" (extends group-crumb), double-click an instance to enter, Esc to go up.
- Inside a circuit: palette as today + cards "Chân vào" / "Chân ra" (name, type, order) + "Thông số mở" (exposes an inner param on the instance).
- Instance block on the parent board: board look (C style), name, pins by name, small status (running / waiting).
- "Chạy thử máy này": runs the circuit alone with its bench scene (floor, a line, a crate…); pins can be driven by hand (switch / number box) and read live.
- "Thư viện bảng mạch" panel: circuits of this file; export / import a circuit file; shipped starter circuits (Xe AGV, Tay máy 2 khớp, Trạm cân).
- Live view while the factory runs: enter an instance and see ITS wires carrying current (per-instance values).

### D3. New general pieces (gap list)
1. Nhớ số (lấy mẫu khi có nhịp) — destination memory.
2. Đi tới điểm cho thân robot 2 bánh (heading + distance control from pieces: exposes target x/z, outputs left/right command, "Đã tới") + floor markers ("Mốc sàn") for grid navigation.
3. Bộ điều phối: N request inputs / N busy flags → picks a free machine, queue, fair order. General, no "AGV" inside.
4. Khay nghiêng: joint + link on chassis carrying a crate → SPIKE first (crate rests on / slides off a tilting solid link).
5. Robot–robot: solid chassis vs chassis + right-of-way from pieces (ahead-sensor) → VERIFY first.
6. Spawner: random pick of colour / mass class (open list).
7. Old open: one-joint arm grip under real physics, slippery floor, X-ray scanner (parked).

### D4. Assets (preview 2–3 looks each → user picks → render-only port)
AGV with tray (own design, no real-brand logo/colours), arm remake, parcels (pack models + kg tag), drop chute + bag, belt + scan gate, floor grid markers, charging bay (decor).

### D5. Sample "Xưởng phân loại kiện hàng"
Circuits: Xe AGV (×4 → later 8), Tay máy, Trạm nạp (belt + scale/scan + arm), Cửa thả (×4–6), Xưởng (instances + Bộ điều phối + counters). Anti-forced tests as for other samples; per-tick geometry checks; on-mode hash baseline. Plus a short lesson chain "Bảng mạch" (make a board, add pins, reuse it twice).

## Waves (each ends with a build the user can open on :5173)
- W0 UX preview (clickable HTML of D2) + asset previews (D4) → user picks. Spikes #4, #5 and a spike of placement-on-expand run in scratch.
- W1 Core: D1 model + expand + file format + tests (no UI) ∥ pieces #1, #3, #6.
- W2 Editor D2 (navigation, pins, instance block, bench run, library) ∥ piece #2 ∥ asset port.
- W3 Sample D5 + lessons, built only with circuits.
- W4 Demo hardening: 8 robots perf on a real GPU, Chrome/Edge/Safari, deploy, demo script.

## Risks
- Placement of an instance: which vec3 params are world positions must be declared per piece (new `ParamDef` flag) — spike in W0.
- Feedback loops through pins (compile cuts loops only at `feedback` ports) — pins must forward that flag.
- Live per-instance wire values inside an entered circuit need the id mapping kept at run time.
- Grid navigation + traffic for 8 robots is the least certain part; fallback = painted-line loop (already proven) with the same circuits.
- Card count: 8 AGVs × ~45 inner cards ≈ 360+ expanded nodes; engine cost per tick must be measured.
- Two similar concepts (Nhóm vs Bảng mạch) can confuse → groups stay for old boards, palette teaches boards only.

## Success criteria
- Open the factory: main board shows ≤ ~15 blocks; enter any machine and see its circuit live.
- Edit circuit "Xe AGV" once → all AGVs change. Remove any pin wire → the factory visibly stops working for the right reason (no forced code).
- Sample runs endlessly, parcels land in the right chute (counted per chute), 0 robot overlaps, full suite green, old boards hash-identical.

## Unresolved questions (asked 11:06)
1. Date of the fundraising demo. 2. Robots/chutes for the first showable version (4/4 vs 8/6). 3. Navigation in the sample: grid free-drive (like clip) vs line loop first. 4. Approve design → write the phased plan.
