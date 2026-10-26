# Contributing

Keep changes focused on a reproducible problem or a clearly described improvement. The interface and commentary are Simplified Chinese; repository-facing documentation is English.

## Local setup

Use Node.js 22.12+ (CI uses Node 24) and npm. Run `npm ci`, then `npm run dev`. For browser tests, install the existing Playwright Chromium build with `npx playwright install chromium`.

Before opening a pull request:

```sh
npm test -- --maxWorkers=2
npm run data:validate
npm run build
npm run test:e2e
npm run test:offline
npm run test:pages
```

`test:pages` runs the production app beneath a real URL subdirectory. Development-server tests alone cannot prove Pages or offline compatibility.

## Engineering boundaries

- Keep simulation, playback, and animation independent. The same seed, engine version, roster and decisions must reproduce the same events.
- Preserve existing save schemas, player role overrides, transfers and historical results. Introduce new mechanics through an explicit engine version.
- Generate commentary from revealed events. Never expose future results or grant hidden observer information to AI.
- Distinguish sourced player facts from game estimates. Record source, date, sample and uncertainty; do not invent individual ratings to fill missing evidence.
- Preserve source geometry and notices when changing equipment assets.
- Keep browser storage namespaces stable. Export saves before testing migrations.
- Do not commit personal saves, credentials, generated builds, local reference packages or bulk historical audit dumps.

For simulation changes, also run the relevant paired-seed experiments, `npm run sim:stress` and `npm run sim:career`. These longer commands write evidence under `docs/`; review generated changes separately from implementation.

## Pull requests

Explain the concrete trigger, resulting behavior and checks actually run. Include screenshots for visual changes, and a seed plus decisions for simulation regressions. Avoid dependency updates unrelated to the change. Discuss changes to licensing separately; public availability does not grant a blanket asset license.

Historical Chinese design notes remain under `docs/`. The optional `esm2026-extract/` research package is intentionally excluded from Git and is not required to build, test or play.
