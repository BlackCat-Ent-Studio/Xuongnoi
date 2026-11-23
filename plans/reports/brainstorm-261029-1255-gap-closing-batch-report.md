# Brainstorm — Gap-closing batch (items 2, 5, 4, 1, 3)

- Date: 2026-10-29 12:55 · Status: APPROVED by user ("làm cái 2,5,4,1,3")
- Execution: 4 parallel worktrees, controller merges (resolver agent) afterwards. Base: main 01ed58e.
- Rule: original designs/text only. Append-only contract changes. Each group adds unit tests + one sample (except editor tools).

## WT-A `feat/editor-tools` (item 4) — editor only
- Undo/Redo: Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) + top-bar buttons ↩️ ↪️. History of graph/mode/name changes (cap 100), coalesce drags (one entry per drag). Disabled while playing/lesson-locked appropriately; tutorial still works.
- Copy/Paste/Duplicate: select multiple nodes (Shift+click, box-select by dragging on empty canvas with Shift or a select-mode), Ctrl+C / Ctrl+V (paste offset, wires between copied nodes kept, new ids), Ctrl+D duplicate, Delete removes selection. Clipboard in-app (+ localStorage so it works across boards).
- Comments: "📝 Ghi chú" sticky notes on canvas (editable text, color, resizable, movable, saved in board JSON — append-only `notes` field, format_version stays compatible: old files load, new field optional).

## WT-B `feat/logic-sensors` (items 1 + 3)
- 🎲 Số ngẫu nhiên: inputs roll (edge, optional) ; params min, max, integer yes/no, mode "mỗi lần bấm"/"mỗi nhịp"/"một lần khi bắt đầu"; output value. Deterministic seeded RNG per run (seed param, 0 = random per run) so tests are reproducible.
- 🔀 Công tắc nhớ: inputs set, reset, toggle (edges); output on (bool); param start state.
- 📏 Đổi thang số: input value; params inMin,inMax,outMin,outMax, clamp; output.
- 📡 Cảm biến vùng: params center vec3, size vec3 (box zone, invisible in play, shown as translucent box in edit), filter "mọi nhân vật / người chơi / bot / đồ vật / phương tiện"; outputs inside:bool, entered:pulse, exited:pulse, count:number, first:object.
- 📏 Khoảng cách: inputs a, b (object); outputs distance:number, within:bool; param threshold.
- Sample `dice-zones` "Xúc xắc và vùng".

## WT-C `feat/objects` (item 2)
- 🧱 Bệ di chuyển: solid moving platform between A and B (speed, wait, loop/ping-pong, input run bool); carries riders (characters/items standing on it move with it). 
- 🔄 Bệ xoay: rotates in 90° steps (keeps AABB collision exact) on input/timer; plus continuous spin option for NON-solid hazards/decor (touch still works via bounding sphere). Document honestly.
- 🔫 Bắn đạn: inputs shooter (object), fire (edge); params speed, lifetime, damage, size, color, gravity on/off; projectiles fly in facing dir, hit characters (uses combat damage if Máu present), stop on solids; output hit pulse + lastHit object.
- ✨ Sinh vật thể: input spawn (edge); params template kind (khối / đồ vật / bot đơn giản?) — keep: block or item with params (size,color,shape,solid), position or at an object, max alive, lifetime; outputs lastSpawned object, count.
- Sample `dodge-shoot` "Né và bắn".

## WT-D `feat/camera-teleport` (item 5)
- 🎥 Camera node (play time): inputs target (object, optional), zoom (number), shake (edge); params mode follow/fixed position, offset, zoom default, smoothness; overrides default follow while active; multiple → last enabled wins. Edit-mode camera unaffected.
- 🌀 Dịch chuyển: inputs who (object), go (edge); params destination vec3 or target object, keep velocity yes/no; teleports character/item/vehicle (with driver) safely (find free spot). Optional 2-way "cổng" pair: a portal block entity that teleports anything touching it to its partner with cooldown.
- Sample `portal-camera` "Cổng dịch chuyển".

## Merge
Order A → B → C → D; resolver agent; full test + browser sweep; HANDOFF update.
