# Brainstorm: Black cat team mascot as cozy 3D character

Date: 2026-11-01 · Status: approved (1a 2a 3a)

## Source
`D:\asset\Black cat` = Live2D (VTube Studio) model of the user's team mascot: `ava.png`, 2× 8192 texture atlas, 8 expressions (ANGRY, BIG EYE, BLUSH, box, CRY, logo, sleepy, suprise). 2D painterly; cannot convert to 3D directly.

## Mascot traits to keep
Black tuxedo cat; white fluffy chest bib; black tail with white tip; pink inner ears with white tufts; big blue eyes with highlights; pink nose; white paws (pink pads); red collar with dark-navy "X" logo pendant.

## Decisions
- 1a: rebuild in 3D cozy style (three.js primitives + toon, same family as cozy robots), simplified fur.
- 2a: two variants in parallel: chibi standing on 2 legs (big head, like ava) and quadruped round cat.
- 3a: preview pages only (`plans/ui-mockups/black-cat/cat-chibi.html`, `cat-quad.html`), not in game.
- All 8 expressions + normal; motions idle/walk/jump/tail wag; tuning panel + copy params.

## Out of scope
Live2D runtime, game integration, GLB export.
