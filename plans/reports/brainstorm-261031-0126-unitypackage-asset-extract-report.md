# Brainstorm: extract hieu333.unitypackage assets with full colour

Date: 2026-10-31 · Status: approved (1a 2a)

## Problem
User wants all models + colours from `D:\asset\hieu333.unitypackage` (Mnostva Art MEGA_PACK_WORLD, Asset Store pack). Unity-only stuff not needed.

## Findings
- 2144 FBX (binary, Kaydara) + 5 palette PNG (128..2048) + 1 mat + doc; rest = Unity prefabs/settings.
- Every FBX colours via UV into `Color_Islands_Texture_2048.png`, referenced by author's path `..\to send\Textures\...` → opens grey anywhere else.
- Smaller shipped palettes differ ~6% of pixels from 2048.

## Decision
- Extract to `D:\asset\hieu333_extracted\MEGA_PACK_WORLD\` (done, 2151 files). Outside repo (licence: no raw redistribution).
- 1a: convert each FBX → self-contained `.glb` with embedded 512 palette downsampled from 2048; keep FBX originals.
- 2a: preview page with thumbnail grid per category.
- Tool: headless Chrome (Playwright) + app's three.js FBXLoader/GLTFExporter; 5 parallel pages (City/Farm/Public/Store/Town), no subagents.

## Validation
- Each GLB: has texture + UV (auto check).
- Each thumbnail: non-grey pixel ratio check, flag grey ones.
- User eyeballs preview grid.

## Rejected
- B (copy texture beside FBX): loader-dependent, not guaranteed.
- C (embed 2048): ~1.9 GB total.

## Unresolved
- FBX unit scale (cm vs m) — check on trial batch.

## Result (2026-10-31 01:45)
- 2142 models (2144 FBX minus 2 DEMO showcase scenes, FBX kept) → `GLB/` 580 MB, 0 failures.
- Fixes found in trial: drop vertex colours (Unity ignores them; made Pizzeria black), cm→m scale 0.01, mergeVertices (~3x smaller).
- Checks: every GLB has embedded image + texture on every mesh + UVs; every thumbnail rendered from reloaded GLB; 227 low-colour flagged, eyeballed = genuinely grey/white props.
- Preview: `Preview/index.html` (file://, tabs, search, flag tab). Tools copied to `D:\asset\hieu333_extracted\_tools\`.
