# GBG research synthesis → input for an original node-based game builder

Date: 2026-10-27 · Mode: brainstorm (research only, no implementation)
Source dump: `D:\gbg\game-builder-garage\` (read-only, outside workspace). Origin per its REPORT.md: pirated NSP → study only; no asset/text/code/voice reuse, no clone.

Detail reports (same dir):
- `researcher-261027-gbg-logic-nodon.md` — node graph runtime
- `researcher-261027-gbg-graphics.md` — art & asset pipeline
- `researcher-261027-gbg-content-ux-audio.md` — curriculum, UX, audio, l10n
- `researcher-261027-gbg-engine-architecture.md` — engine, formats, physics, caps

Tags: [V] verified in dump · [I] inference · [U] unresolved.

## 1. What GBG is, in one paragraph

Nintendo in-house stack (sead/agl, Havok 2018.1 via "Phive", Labo lineage) [V]. A user game = a small BYML graph (`.blgc`, avg 3.4 KB, median 7 nodes) of ~90 node types; placed physical objects are nodes too [V]. Logic = float-only signals, synchronous push propagation [V]. Art = flat 2D node UI, each node a glyph character with texture-swapped faces, plus a small low-poly 3D prop set [V]. Teaching = 7 guided games, 59 cumulative steps, constrained checkpoint puzzles, per-node persona + hint, then free mode [V]. Cost budget 2000 units/program, hard caps 512 nodes / 1024 wires [V].

## 2. Cross-cutting findings

| Area | GBG does | Keep for ours? |
|---|---|---|
| Signal | one float32 per port, bool = 1/0, off = abs ≤ 1e-4, extra "kind" tag | Simplify: typed ports (bool/number/pulse) + explicit "no signal", checked at connect time |
| Evaluation | push on change; stops when value & kind unchanged; tick/eval/reset slots | Replace: fixed 60 Hz tick, topo order, back-edge = previous tick |
| Node impl | actor class per node + factory switch + per-type save/load cases | Replace: one registry table {ports, params, eval, cost} |
| Save format | BYML v4, CRC32-hashed keys, 16 format versions | Replace: versioned readable JSON + migrations; keep `format_version` from day one |
| Budget | per-type cost (fixed/move × visible/invisible), cap 2000; some types unpriced | Keep idea; price every type when added |
| Physics | Havok, 16 layers, 22 materials, 18 motion presets | Box2D (2D) / Jolt (3D); start 4-6 layers |
| Presentation | sound/VFX/haptics in separate event tables, logic never names files | Keep |
| Art | glyph bodies, 4-layer face states, flat rounded UI, 128² textures | Keep style direction; own designs |
| Onboarding | 59-step course + 8 checkpoints | Cut: scripted first win + 2-3 checkpoints + early free mode |
| Audio as tool | 190 SFX / 11 groups, BGM themes × 4 parts, max 4 BGM nodes | Keep pattern, small curated licensed library |
| L10n | 13 locales × 13,392 msgs, hard-coded line breaks, ~26k tags/locale | Named placeholders, reflow layout, Vietnamese first-class |

## 3. Recommended baseline (pending user decisions in §5)

1. Graph core: Node{id, typeId, params, ports}, Edge{from, to}; stable never-reused ids.
2. Node registry, ~12 primitives first: Button/Stick, Trigger, Latch(Flag), Timer, Counter, And/Or/Not, Compare, Constant, Calc, Map(range), Send/Receive; + object/sensor/camera/sound nodes.
3. Fixed-tick evaluator; logic serial & deterministic; physics fixed-step accumulator; sensors/actuators as the only logic↔physics bridge.
4. Edit-time caps with one-sentence explanations.
5. Hybrid onboarding; per-node hint + persona line in one data table.
6. Vietnamese: lock pronoun pair for hosts↔player first; diacritic line-height tests; comma decimals; full-glyph fonts.

## 4. Conflicts / errors noted between sources

- `next_id`: logic agent → equals max id in 285/436 (= last issued); engine agent → "> all ids". Treat as unresolved; irrelevant to our design (we define our own).
- Program count: dump REPORT says 472; actual files 466-467 (5 empty + mirrors).
- RTTI classes: REPORT 1,485 vs classes.json 1,778.
- `format_version` not constant 25 (15-25).

## 5. Decisions needed from user (block design)

1. Platform: web (TS + Canvas/SVG + three.js) / Godot 4 desktop / mobile?
2. World dimension: 2D only first, or 3D? (drives Box2D vs Jolt, art cost)
3. Audience: kids/students learning programming, or hobby creators?
4. Sharing: local files only, or online share codes (needs backend + moderation)?
5. Scope of v1: editor + runtime + N nodes + 1 tutorial?

## 6. Risks

- Content/translation cost dominates engine cost (GBG: 13k msgs/locale).
- 3D + physics + editor solo = large scope; 2D first cuts risk heavily.
- Online UGC sharing adds moderation/legal load.
- Legal: dump stays reference-only; nothing from it ships.

## Unresolved questions

- Exact GBG tick order, multi-source input resolution, Counter modes, kind tags 1/2 (no runtime available) — not needed for our design.
- Physics timestep / memory budgets / MaxNode values — not needed.
- User decisions §5.
