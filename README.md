<h1 align="center">CS2 Roundcraft</h1>

<p align="center"><strong>Call the round. Read the play. Build the next advantage.</strong></p>
<p align="center">A CS2-inspired tactical manager that puts the command desk beside the broadcast.<br>Choose a plan, watch both teams, and trace each turning point back to the match events.</p>
<p align="center"><a href="https://seiya058904.github.io/cs2-roundcraft/">Play CS2 Roundcraft</a> &nbsp;·&nbsp; <a href="#the-round-loop">The Round Loop</a> &nbsp;·&nbsp; <a href="#inside-the-game">Inside the Game</a> &nbsp;·&nbsp; <a href="#run-locally">Run Locally</a> &nbsp;·&nbsp; <a href="docs/publishing/AUDIT.md">Audit & Readiness</a></p>
<p align="center"><sub>50 SNAPSHOT TEAMS · 250 STARTING SEATS · 7 MAPS · 12 PLAYER ABILITIES</sub></p>
<p align="center"><img src="docs/media/match-desktop.png" width="1100" alt="Match command desk with tactics above mirrored five-player teams and source-backed equipment silhouettes" /></p>

> **The game interface and commentary are Simplified Chinese.** This README and repository guidance are English. This is an unofficial fan-made regional simulation, not a CS2 client or demo parser.

## The Round Loop

<p align="center"><code>CHOOSE A PLAN → CALL THE ROUND → WATCH THE EVENTS → ADJUST</code></p>

1. **Take the desk.** Start Vitality vs FURIA, configure a seeded sandbox, or take over a club in career mode.
2. **Set your intent.** Choose a preset and purchase strategy. Expand phase adjustments, positioning and risk controls when needed.
3. **Execute one full round.** Read commentary as health, utility, equipment and casualties update at the same event boundary.
4. **Review the evidence.** Inspect the event ledger and make the next decision. Playback speed and animation settings do not change the result.

Automatic batches hand tactical decisions to the AI; they do not repeat every manual instruction. Reproduction requires the same seed, engine version, roster and decisions.

## Inside the Game

<table>
<tr>
<td width="50%" valign="top"><h3>Command & Economy</h3><p>Map-aware presets, phase overrides, purchase policies, tactical pools and coach timeouts. Plans resolve against equipment, travel, utility and available information.</p></td>
<td width="50%" valign="top"><h3>Observe & Explain</h3><p>Two aligned five-player panels show weapons, utility, cash, health and deaths. Commentary cites revealed events, with detailed and brief reading modes.</p></td>
</tr>
<tr>
<td width="50%" valign="top"><h3>Scout & Compare</h3><p>Search professional aliases, inspect twelve modeled abilities and compare two players. Sourced statistics, estimates and missing evidence remain distinct.</p></td>
<td width="50%" valign="top"><h3>Sandbox & Career</h3><p>Seeded BO1/BO3/BO5 series, map vetoes, custom lineups, seasonal events and player exchanges. Background simulation supports cancellation at safe boundaries.</p></td>
</tr>
</table>

### A board you can read

Commands sit above the teams. Attacking gold and defending blue follow side changes while your team stays on the left. Advanced controls and technical details expand on demand.

Weapons use individually mapped SVGs. Armor, helmets, grenades, kits and C4 retain sourced silhouettes. Live cash and armor labels distinguish purchase-time information from settlement.

<p align="center"><img src="docs/media/match-mobile.png" width="390" alt="Mobile observer board with both five-player teams side by side" /></p>

GSAP handles shared motion; Lenis smooth scrolling can be disabled. Reduced-motion preferences are respected. Reading earlier commentary pauses automatic following.

## Run Locally

Use **Node.js 22.12+** and npm; CI targets Node 24. No API key, application account or backend is required.

```sh
npm ci
npm run dev
```

Open the address printed by Vite, normally `http://127.0.0.1:5173/`.

```sh
npm run build
npm run preview -- --port 4173
```

After the first online load finishes caching, production supports offline refresh and Worker simulation. Development mode does not install a service worker. Serve `dist/` over HTTP or HTTPS; do not open HTML directly from disk.

**Keep a save backup.** Autosave and three manual slots live in browser IndexedDB. Export JSON before moving between localhost and the hosted site, changing browser profiles or clearing site data. Browser storage is not cloud backup.

## What the Numbers Mean

| Layer | Meaning |
| --- | --- |
| Roster | October 5, 2026 Valve VRS snapshot; not a live roster feed. |
| Evidence | Dated player statistics and roles, with sample descriptions and gaps. |
| Abilities | Twelve game estimates; not official ratings or predictions. |
| Simulation | Regional topology, timing, sight lines, economy and event causality; not CS2 physics. |
| Commentary | Local narration grounded in revealed events, attributed quotations and original connective text. |

The current audit confirms **209 known nationalities**, **40 unverified roles**, and no sourced real transfer histories. Career transfers belong to the simulated world. Exact bullet physics, reloads, grenade bounces and real-demo playback are outside the model.

## Development & Verification

```sh
npx playwright install chromium
npm test -- --maxWorkers=2
npm run data:validate
npm run build
npm run test:e2e
npm run test:offline
npm run test:pages
```

`test:pages` serves production beneath `/pages-preview/` without a development-server fallback, then checks offline restore, equipment loading and Worker simulation.

<details>
<summary><strong>Source map and deeper simulation checks</strong></summary>

| Path | Responsibility |
| --- | --- |
| `src/domain/` | Deterministic matches, economy, careers and save validation |
| `src/MatchView.tsx` | Replay and commentary |
| `src/MatchCommand.tsx` · `src/BattlePlanEditor.tsx` | Commands and phase controls |
| `src/MatchRoster.tsx` · `src/EquipmentIcon.tsx` | Observer display and equipment |
| `src/simulation.worker.ts` | Background batches and cancellation |
| `src/storage.ts` | Local save persistence and recovery |
| `src/data/` · `data/source/` | Runtime data, snapshots and provenance |
| `tests/` | Unit, browser, offline and deployment regressions |

For engine changes, run `npm run sim:stress` (10,000 maps), `npm run sim:career` (two seasons), and relevant `sim:tactics`, `sim:matrix`, `sim:commentary` or `sim:timeouts` experiments. Historical reports are not fresh validation claims.

`npm run data:import` rebuilds data from checked-in sources and writes generated files. It is maintenance, not normal startup.

The optional `esm2026-extract/` reference package is local-only and excluded from Git. It is not required to build, test or play. Historical Chinese design notes remain in `docs/`.

</details>

## Deployment

The [Pages workflow](.github/workflows/pages.yml) verifies the project before deploying only `dist/`. Relative URLs support repository subpaths; offline caches are isolated by deployment scope.

[Play CS2 Roundcraft](https://seiya058904.github.io/cs2-roundcraft/) · [GitHub repository](https://github.com/seiya058904/cs2-roundcraft) · [Deployment notes](docs/publishing/DEPLOYMENT.md).

## Sources & Rights

See [Third-party notices](THIRD_PARTY_NOTICES.md) and the [equipment provenance manifest](src/assets/equipment/sources.json). Original attribution is preserved.

No repository-wide open-source license is declared; see [licensing status](LICENSE.md). This project is not affiliated with Valve, tournament organizers or professional teams. Public source availability does not relicense third-party material.

[Contributing](CONTRIBUTING.md) · [Support](SUPPORT.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

---

<p align="center"><sub>FIVE PLAYERS. ONE PLAN. ANOTHER ROUND TO GET IT RIGHT.</sub></p>
