# Sound report (feat/sound, commit b760274)

## Files
- app/src/puzzle/ui/sound.ts: contract API (same names), controller: lazy AudioContext in unlockAudio(), settings + visibility handling, rate limit 40 ms per effect, star pitch counter.
- app/src/puzzle/ui/sound/notes.ts (pure): SynthEvent, midiToHz, pentatonic table, seeded RNG, rate limiter, star counter.
- sfx-recipes.ts (pure): events per effect. music.ts (pure): 8-bar loop builder + MusicCursor (4 melody variants per scene).
- synth.ts (WebAudio voices: pluck/bell/pad/blip/wood/thump/whoosh/shaker, buses + soft limiter, nodes disconnected on end), music-engine.ts (look-ahead scheduler 120 ms tick / 0.6 s ahead, crossfade 1.4 s), offline-render.ts, render-check.html (dev-only page, not in build).
- Tests: tests/puzzle/sound-notes.test.ts, sound-recipes.test.ts (27 tests).
- Scripts: D:\workspace\GameBuilder\plans\browser-scripts\sound-render-check.mjs (offline levels), sound-live-check.mjs (live API smoke).

## Behaviour
- Before unlockAudio(): all silent, never throws. startMusic before unlock is remembered and starts at unlock.
- Music off: fade 0.4 s and scheduling stops; on: current scene resumes. sfx off: playSfx silent. Hidden tab: ctx.suspend(); visible: resume.
- Same scene twice: no-op. Scene switch: crossfade. menu 92 BPM, level 82 BPM (calmer: sparser melody, quieter, no shaker). C-major pentatonic only.
- Music bus 0.3 (about half the effects RMS); all through one DynamicsCompressor limiter.
- First playSfx right after unlock can be dropped if context is still resuming (state not running yet).

## Measured (OfflineAudioContext, 44.1 kHz, via Playwright)
| item | peak | rms | audible s |
|---|---|---|---|
| tap | 0.161 | 0.012 | 0.07 |
| pick | 0.198 | 0.020 | 0.19 |
| wire | 0.317 | 0.028 | 0.26 |
| unwire | 0.140 | 0.017 | 0.14 |
| run | 0.408 | 0.051 | 0.66 |
| stop | 0.370 | 0.038 | 0.34 |
| win | 0.697 | 0.065 | 1.48 |
| lose | 0.276 | 0.037 | 0.80 |
| star (1st / 3rd) | 0.231 / 0.232 | 0.030 | 0.49 |
| hint | 0.372 | 0.039 | 0.69 |
| unlock | 0.320 | 0.049 | 0.65 |
| page | 0.027 | 0.003 | 0.27 |
| music menu (8 s) | 0.127 | 0.021 | - |
| music level (8 s) | 0.109 | 0.018 | - |

All peaks < 0.9, none silent. Live smoke (headless Chromium, autoplay allowed): unlock, all effects, scene switch, music/sfx toggle, stop: no page errors.

## Verify
tsc clean; vitest tests/puzzle 221/221 pass; npm run build OK. Dev server on 5202 stopped.

## Not verified
Actual sound quality by ear (nobody listened); only levels and no-error. Tuning (gains, melody) may need a listen. Effects use `document` for visibilitychange (browser only).

Status: DONE_WITH_CONCERNS
Summary: Sound API implemented with pure testable modules, offline level measurements all in range, tsc/tests/build pass, committed on feat/sound.
Concerns/Blockers: Not listened to by ear; first effect right after unlock may be skipped until the context reports running.
