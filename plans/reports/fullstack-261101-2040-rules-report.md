# Rules report (feat/rules)
- "?" counting: guide.hint() returns stepKey (piece:/param:/wire:<solution id>) or null; hint-rules countHint(Set,key); level-screen keeps revealedHints Set per visit (board reset does not refund); playSfx('hint') added.
- Level 7: could NOT reproduce a win without the bridge wire. Base wire begin->bridge.hide already hides the bridge at start; headless: minus sw4 = lose; browser (Playwright): no bridge wire = lose, full solution = win; brute force of every go-source + up to 1 extra wire (incl. the spare "and") with no wire into the bridge never wins. level-07.ts unchanged; tests added (bridge wire required + small brute force).
- Level 5: LEVEL_INTRO line added (3D camera), WIRE_LINES already existed; forced guide + replay button work; guide skips intro tips. Browser shots in plans/reports/shots-rules (l5-*).
- Checks: tsc clean, vitest tests/puzzle 200 pass, build ok. Dev server stopped. Commit on feat/rules.
