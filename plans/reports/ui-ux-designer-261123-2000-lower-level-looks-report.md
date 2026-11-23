# Look preview: lower level (tug, truck, dock door, light sheet, warehouse scenery)

- Page: `plans/ui-mockups/lower-level-looks/index.html` (one file, 3D, Vietnamese, same page format as `plans/previews/doc-ma-261123`).
- Shot script: `plans/ui-mockups/lower-level-looks/take-shots.mjs`.
- Nothing under `app/` touched, no commits, no installs. Server on 5371 stopped.
- `plans/ui-mockups/cage-lamp-cover/` did not exist when I started and at last check, so I could not match its lettering; I followed the doc-ma page. Not touched.

## How to open

| Way | Works | Note |
|---|---|---|
| Static server at the REPO ROOT: `python -m http.server 5371` in `D:\workspace\GameBuilder`, then `http://localhost:5371/plans/ui-mockups/lower-level-looks/index.html` | Checked, offline | three.js r186 loaded from `app/node_modules` by relative path |
| Double-click `index.html` | Checked, needs Internet | A browser will not import local modules from disk, so the page falls back to the jsdelivr copy of three.js (only the library is fetched, no project data) |
| Server started inside the folder itself | Not checked | Would also fall back to the CDN |

Footer of the page says which copy of the library was used.

## Options and recommendation

| Section | Options | Recommend | Reason |
|---|---|---|---|
| 1 Xe kéo | X-a game's AGV look unchanged (orange, fenders, strip), narrowed 0.7 → 0.5 m to pass between cage legs; X-b flat teal body, hidden wheels, steel lift pad that rises 0.11 m to the cage underside; X-c teal body, black rubber bumpers with yellow stripe, latch pin, status light bars at nose, tail, sides (blue idle, green loaded) | X-c | Reads as a second fleet, and the status light stays visible while the tug is under a cage |
| 2 Xe tải | T-a open flatbed + headboard; T-b closed white box open at rear (the mock-up's truck); T-c flatbed + low side rails (about 0.5 m) + headboard | T-c | 4 cages countable from the tilted game camera; T-b's roof and sides hide them |
| 3 Cửa bến | C-a dark roll-up shutter, yellow bottom bar, drum box above; C-b red-white barrier arm on a yellow post with red/green lamp | C-a | Open/closed readable from far, looks like a warehouse dock |
| 4 Tấm sáng | S-a still flat sheet, faint idle, bright + white outline round the carton at the read; S-b fainter sheet + scan line moving up and down (slow idle, fast white at the read) | S-a | One change only: bright = "just read"; S-b's line moves even with no carton |
| 5 Cảnh nhà kho | K-a floor paint + low walls; K-b + full dock wall with 3 door frames, 6 hall columns; K-c + high side wall, 3 roof trusses, 6 hanging lamps, 2 rows of pallet racks | K-b | Feels like a warehouse, nothing overhead between camera and machines |

Draw cost of the scenery only (computed on the page, shown under each option):

| Option | Boxes | Triangles | Draw calls after merging |
|---|---|---|---|
| K-a | 124 | 1,488 | 1 |
| K-b | 158 | 1,896 | 1 |
| K-c | 453 | 5,916 | 2 (lamps glow separately) |

For scale: the outbound mock-up reported 224k triangles / 495 calls for layout A. All three are cheap; the cost of K-c is visual (truss members and their shadows cross the picture), not performance.

## Things found while drawing (need a decision later, not blocking the choice)

1. X-a at the game's real AGV size (0.7 m body, wheels at ±0.385 m) does not fit between cage legs (0.76 m clear). The preview narrows it to 0.5 m; the page says so.
2. Brief gives 0.35 m clearance; the mock-up cage has 0.27 m. Stand-in cage here uses 0.35 m.
3. X-a is shown in the robots' orange. A different body colour would help tell the fleets apart; colour is not part of this choice.
4. K-c: the truss nearest the camera was left out on purpose, otherwise it cut straight across the deck.

## Checks

- Headless Chromium (software GL), 1440 × 1000: no console errors, no page errors, no failed requests; served run made no request outside localhost.
- Drag orbit works (shot `extra-keo-xoay-...`); no sideways scroll at 1440 and 400 px wide.
- Rules: existing figures (AGV, belt, scan gate, carton) redrawn from the app's numbers, not altered; no text baked into 3D; scenery merged into 1 to 2 meshes.

## Shots (`plans/reports/shots-lower-level-looks/`, 22 files; I looked at the ones marked *)

| File | Shows |
|---|---|
| `page-top` * | Header, intro, first card |
| `1-xe-keo-X-a` *, `-X-b` *, `-X-c` * | Each tug alone and under a cage |
| `2-xe-tai-T-a` *, `-T-b` *, `-T-c` * | Each truck empty and with 4 cages |
| `3-cua-ben-C-a` *, `-C-b` * | Closed and open |
| `4-tam-sang-S-a` *, `-S-b` * | Idle and at the read |
| `5-canh-K-a` *, `-K-b` *, `-K-c` * | Game camera, see-through deck |
| `5-canh-K-a/b/c-san-dac` (b *) | Same with solid deck |
| `5-canh-K-b/c-nhin-thap` (c *) | Low side camera |
| `extra-nen-toi-X-c` | Dark page |
| `extra-keo-xoay-T-b-nhin-tu-sau` * | After a real drag: T-b from behind |
| `extra-dien-thoai-X-b` * | 400 px wide |

Of these, X-a, X-b, T-a, T-b, C-a, S-a, K-a, K-b and the solid-deck and low-camera shots were looked at in the first round only; after the camera distances changed I re-read X-c, T-c, C-b, S-b, K-c and page-top. The not-re-read ones use the same code path with the same change.

## Rough / unverified

- S-b "at the read" in a still looks almost like S-a "at the read": the moving line happens to sit at the carton top in the frozen frame. Live, the line moves.
- Rounded boxes are an approximation of the game's rounded box (rounded in plan, bevelled edge), because the page avoids three.js add-ons to stay a single file. Truck cab and AGV body may differ slightly from the game at the edges.
- Stand-in cage is the mock-up's cage, not the look being chosen in the cage page.
- Dock door has two fixed states, no opening animation. Lift pad of X-b likewise (down / up).
- T-b truck in the door scene and the stand-in machines in section 5 are placeholders (trucks there use T-c, tugs X-c, i.e. my recommendations; the user may read them as decided).
- Section 5 deck defaults to see-through so the lower level shows; the real game has no such switch decided yet.
- Tug "alone" view: the corner of the floor patch shows at the frame edge.
- Frame rate only seen on software GL. Phone layout shot once at 400 px (one card). Dark page shot once, not read.
- Hook `scout-block` denied listing `app/node_modules/three/build`; not worked around. The page only references that path in a URL, as the brief allows; that the file exists was confirmed by the page loading it (r186).

## Unresolved questions

1. If X-a is chosen: narrow the tug (as drawn) or widen the cage?
2. Cage clearance: 0.35 m (brief) or 0.27 m (mock-up)?
3. Should the tug fleet have its own body colour regardless of the look chosen?
