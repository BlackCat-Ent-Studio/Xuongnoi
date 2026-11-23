# Brainstorm: cozy-cartoon robot character previews

Date: 2026-11-01 · Status: approved (1a, 2a+2b, 3a, 4a)

## Request
Original robot character in "cozy cartoon" style (soft rounded, chunky, pastel, like MEGA PACK WORLD look) for the puzzle mode. Style only, not a copy. Two variants. Samples for review/tuning; NOT into the game yet. Must not look like old code-drawn box characters (`render/character-styles/`).

## Decisions
- Form: 3D built from rounded primitives (three.js), standalone preview pages.
- Variants: A = one-wheel roller bot, B = two short legs waddle bot. Siblings: same palette, head, face.
- Colours: light blue body, yellow accents (antenna ball, lights), cream face screen.
- Old box robot stays untouched.
- Pages: `plans/ui-mockups/cozy-robot/robot-wheel.html`, `robot-legs.html` (local, gitignored) → published as private artifacts.
- Each page: orbit view, animation buttons (đứng, đi, nhảy, vui, buồn), tuning panel (colours, head/body scale, wheel/leg size), copy-params JSON.

## Out of scope
Game integration, GLB export, pack palette/models in the page.

## Next
User reviews + tunes; then a separate brainstorm to add the chosen bot as a character look.
