# Changelog

## Unreleased — broadcast polish

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
