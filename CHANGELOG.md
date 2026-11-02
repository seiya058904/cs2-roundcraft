# Changelog

## Unreleased — broadcast polish

- Desktop broadcast stage (windows at least 1240×760): the match fits one screen with no page scroll. The newest commentary line is pinned in large type under a scrolling history; statistics, the economy ledger and the map guide move into panel tabs.
- Simplified command: five modes — hand-off to the coach AI, patient, balanced (default), pressure, or manual with the previous full controls in a collapsible drawer. An optional autoplay starts the next round once the narration ends and stops for side choice, replay, pauses, timeouts and the series end.
- Analysis desk tab: map momentum, side-by-side team comparison, map leaders, form and rivalries, built only from rounds already shown.
- Live HUD strip with alive counts and bomb state; half-time and map-end recap strip.
- Smoother playback: each revealed line now plays its events one at a time (damage, kills, bomb) instead of landing in one frame; seeks, expand-all and round changes still snap. Adds floating damage numbers, kill slashes, HP count-downs, score drop-in with a ring burst, alive-pip knockouts, spotlight cards for first blood, clutches, multi-kills and bomb beats, a round-win edge flash and a breathing edge while the bomb is down. All of it follows the motion preference.
- Spoken commentary layer for new engine v5 rounds: generated fact sentences read like a caster (people counts spoken, timing as 第二时间, plant and result lines rewritten) with an intensity budget for interjections. Quotes, brief text, anchors and sources stay unchanged.

- Broadcast match view: a score HUD with series pips, a clickable round timeline and a round banner; an arena layout with both rosters beside the live feed; win-probability and kill-feed cards; HP damage trails, cash deltas and highlight badges.
- A layered design system (tokens, base, layout, match, pages) replaces the two legacy stylesheets. Adds a self-hosted Barlow Condensed display face, sliding selection indicators, number tweens and route entrance motion. The reduced-motion settings still turn all of it off.
- A two-voice commentary booth for new matches. An analyst cites equipment gaps, live win odds, post-plant and clutch chances, rivalries, form and round MVPs from the event ledger (87 new original lines).
- Numbers: CTM Rating 2.0 (a public approximation, not an HLTV rating), a win-probability model fitted on simulated rounds (`npm run sim:winprob`), round highlights, round MVP and a next-round economy outlook.
- Engine `causal-plans-v5`: post-plant holders keep less cover, so even-number retakes become winnable. Older engine versions replay byte-identically.

## Publication candidate

- Region-level, seeded CS2-inspired match simulation with round commands, economy, utility and phase plans.
- Chinese event-linked commentary, replay controls and a mirrored ten-player observer board.
- Fifty snapshot teams, 250 starting seats, twelve modeled player abilities and evidence-aware profiles.
- Sandbox, tournaments, career seasons, local saves and JSON backup/restore.
- Source-backed weapon and equipment SVGs, responsive layouts, reduced motion and scroll preferences.
- Publication preparation: relative production assets, scoped offline caches, React renderer chunk separation and a tested subdirectory deployment host.
- English repository guidance and a verification-gated GitHub Pages workflow.

The approved product name is CS2 Roundcraft; the repository and package name are `cs2-roundcraft`. Deployment evidence is recorded separately.
