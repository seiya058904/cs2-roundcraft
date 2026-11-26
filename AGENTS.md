# AGENTS.md

## Project and verification
CS2 Roundcraft is a React, TypeScript, and Vite single-player tactical management game. `src/` owns interface and simulation; `scripts/` holds data/simulation checks. Preserve game state, seeded reproducibility, and existing user changes.

Use the project lockfile and Node version in `package.json`. For relevant changes run focused checks, `npm test`, `npm run data:validate`, and `npm run build`; UI/delivery changes also need applicable `npm run test:e2e`, `npm run test:offline`, and `npm run test:pages` (gated by CI before Pages deploy). Docs-only work needs proportionate checks.

Preserve user saves and use isolated browser test data.
