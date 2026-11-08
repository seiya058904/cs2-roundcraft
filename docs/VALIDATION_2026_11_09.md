# Simulation initiative and match-session validation

## Scope

This delivery changes simulation action order for **new v6 matches** and preserves manual commands / reading position across page navigation. Save-slot redesign and additional spoiler-boundary changes are outside this delivery.

The v5 engine processes utility and movement/pickups in stored fighter order. An earlier flash can remove a later thrower's visible targets; an earlier visitor can claim a shared dropped weapon. Isolated probes showed that both stages contribute to the measured slot gap. V6 canonicalizes serialized fighters, then uses seeded Fisher–Yates initiative in these two contested stages. Shot ordering and combat coefficients remain as before. The old paths are retained for legacy, v3, v4 and v5 saves; v5 cover and spoken commentary are explicitly retained.

Match sessions are held in memory outside the saved game state and RNG. They retain the manual decision, selected view/round, revealed commentary position and feed scroll. Returning pauses playback with autoplay off. Starting a new sandbox (including the same seed/ID), preparing a career fixture, or loading/importing a save invalidates the prior session. Refreshing the app does not persist these temporary settings.

## Paired-seed evidence

Run `npx tsx scripts/order-experiments.mts`. The checked-in [report](order-validation.json) records the simulation-source fingerprint. Each cell uses 300 paired seeds with equal attributes, roles, map proficiency and team values, a controlled second-round budget (T $6000; CT $6000 or $2000), fast A versus stack A, seven maps and both team slots. Prior rounds remain valid; the comparison resets the random state and team effects before the measured round.

| Measure | v5 | v6 |
| --- | ---: | ---: |
| Mean absolute slot win-rate gap across 14 map/budget cells | 11.93 percentage points | 2.40 percentage points |
| Dust II, full-budget CT wins: slot 0 / slot 1 | 249 / 149 of 300 | 210 / 200 of 300 |

The maximum v6 cell gap was 8 percentage points. On the separate Dust II tactic contrast, v6 CT won 200/300 when defending A versus 56/300 when stacking B. This is diagnostic simulation evidence, not an assertion of perfect symmetry, overall game balance or professional match prediction. The existing fitted win-probability display model was not recalibrated in this delivery.

## Verification

- Unit suite: 287 tests passed, including seven-map fighter permutation/continuation checks, a 200-seed slot-bias regression, and six additional v4/v5 full-series byte fingerprints captured before implementation.
- Data validation: 50 teams, 250 players; source-coverage limitations unchanged.
- Production build passed. The existing large static commentary/Worker chunk warning remains.
- Seven-map stress: 700 maps / 14,177 rounds, all round/narration/economy/statistics invariants passed. [Report](stress-report-iteration15.json).
- Browser suite: 44 tests passed, including draft/phase/position retention, historical replay and scroll restoration, speed changes, autoplay cancellation, same-ID replacements and map transitions. Existing desktop/mobile layout and save protection checks also passed.
- Production offline and Pages subdirectory suites: one test each passed, covering restore, all 24 equipment images and offline Worker simulation.
- Career smoke: two seasons, 24 events and 894 matches completed; 215 players received statistics and the serialized save was 965,113 bytes. [Report](career-smoke.json).
- Final self-review checked version-gated random draws, legacy cover/commentary, manual-input validation before mutation, session invalidation and separation from saved state. `git diff --check` passed. No dependency or deployment configuration changed.

The first build caught a missing explicit type in the new diagnostic script; that was corrected. Initial browser/offline runs found an ambiguous global `series ended` text locator when a newly simulated series was lost. The assertions now target the scoreboard, and continue to require a real finished series.

The first PR run completed 286 unit tests successfully but the new 200-seed paired regression took about six seconds on the hosted runner, exceeding Vitest's five-second default. This single 800-round test now has a 20-second limit; the sample size, assertion and global timeout are unchanged.

## Remaining boundaries

Browser validation uses isolated Chromium storage. It does not certify physical phones, Safari, Firefox or assistive technology. Existing saved games intentionally continue on their original engine and retain the old simulation behavior. This change does not replace their historical results.
