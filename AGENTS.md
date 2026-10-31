# AGENTS.md

## Project and verification

CS2 Roundcraft is a React, TypeScript and Vite single-player tactical management game. `src/` owns the interface and simulation; `scripts/` contains data and simulation checks. Preserve game state, seeded reproducibility and existing user changes.

Use the project lockfile and Node version required by `package.json`. For relevant changes run focused checks, `npm test`, `npm run data:validate` and `npm run build`; UI and delivery changes also need the applicable `npm run test:e2e`, `npm run test:offline` and `npm run test:pages`. CI runs these gates before Pages deployment. Documentation-only work needs proportionate documentation checks, not the full suite.

Preserve user saves and use isolated browser test data. Do not publish, push, merge, change dependencies or remote configuration without explicit authorization. Stage only intended files and report actual checks and limitations.

## Browser tool selection

- Prefer Ego Browser for exploratory navigation, visual review and interactive checks when available. Use Playwright for repeatable regression, CI, isolation, request interception or other automation requiring its APIs; combine tools when useful. If Ego is unavailable, use a suitable existing browser tool.
- Keep this repository's required browser commands, versions, profiles and safety boundaries; an exploratory check does not replace required automated tests. Do not alter real user data or production state for testing. Report the tools, coverage and any untested paths.
