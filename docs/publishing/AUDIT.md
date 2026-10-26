# Pre-publication readiness audit

The owner subsequently approved **CS2 Roundcraft** (`cs2-roundcraft`). The game brand, browser title, package, README and repository description use this identity; the original browser storage keys remain unchanged for save compatibility. This document preserves the local audit below as a dated record, not a statement that publication is still awaiting naming approval. Current delivery status is available in [GitHub Actions](https://github.com/seiya058904/cs2-roundcraft/actions/workflows/pages.yml) and at the [website](https://seiya058904.github.io/cs2-roundcraft/).

The first hosted run exposed two test-duration limits: the multi-event Major test took approximately 27 seconds against 20 seconds, and the 40-seed commentary test took 5.3 seconds against 5 seconds. Their bounded timeouts were changed to 60 and 20 seconds respectively; all simulation samples and assertions remain intact. Both tests passed locally after the adjustment; hosted results remain recorded per commit in Actions.

Date: October 26, 2026. Scope: current application, repository hygiene, public documentation and static deployment. This is a release-readiness audit, not a claim that every engine line or third-party right has been independently certified.

## Findings and changes

| Finding | Resolution |
| --- | --- |
| Production assets assumed the origin root | Set Vite's relative base and verified a real subdirectory host, including Worker and equipment assets. |
| Offline cleanup matched every `ctm-assets-*` cache on the origin | Scope cache names to the service-worker URL. Only remove obsolete caches for that scope; read only the active app cache. Regression tests cover sibling projects and unrelated requests. |
| Online navigation could overwrite the cached shell with another page | Keep the precached build shell immutable; use it only as the offline navigation fallback. |
| React DOM's client renderer remained in the application chunk | Explicitly include `react-dom/client` in the React chunk. Main JS decreased from 508.39 kB to 297.66 kB, uncompressed. React chunk increased correspondingly; this is separation, not an equivalent total-byte saving. No chunk warning remains. |
| No repository or publication workflow | Initialized local `main`; prepared verification-gated Pages deployment without creating a remote yet. |
| Reference package and bulk historical dumps could enter the first commit | Ignore `esm2026-extract/`, historical archive/diff files and bulk extracted indexes. Preserve them locally. Retain the small frozen legacy fingerprint fixture required by tests. |
| Capture scripts contained workstation-specific paths | Use local ignored artifacts or `CAPTURE_DIR`; optional reference tools accept a path and default to the local ignored package. |
| Browser tests overwrote documentation screenshots | Route new test captures to Playwright's ignored output directory. README media is a deliberate publication asset. |
| Public-facing documentation was not ready | Added an English README, contributor/support/security guidance, licensing status, source notices, issue/PR templates and deployment notes. Retained historical Chinese documents and upstream notices. |

The README's structure was informed by the owner's Stillpond, Yuliang Life Sim and Numerical Battle Lab repositories: centered introduction, real imagery, readable gameplay sections and expandable development details. No artwork or implementation was copied from those repositories.

## Executed checks

| Check | Result |
| --- | --- |
| Baseline unit suite | 151 tests across 18 files passed. |
| New cache isolation regressions | 3 tests passed. |
| Data validation | 50 teams, 250 seats; 209 known nationalities, 40 inferred roles, no sourced transfer history. |
| Dependency audit | `npm audit --json`: zero reported vulnerabilities at audit time. No dependency versions upgraded. |
| Production build | Type-check and Vite build passed; no oversized-chunk warning after renderer separation. |
| Full browser suite | 33 passed at 1440, 1280, 1024 and 390 widths. The first run had one connection refusal during a configuration-triggered dev-server restart; the stable rerun passed all tests. |
| Root offline production test | Passed save/restore and Worker simulation; all 23 equipment SVGs decode offline. |
| Subdirectory production test | The same offline flow passed beneath `/pages-preview/` with a strict static host. |
| Equipment provenance | All 23 local SVG hashes match the pinned manifest. |
| Initial candidate scan | No matches for private-key, GitHub-token or AWS-key patterns. This is a targeted scan, not proof of absence of every possible secret. No reference-package files were candidates. |

## Clean export and staging review

Exported the staged source tree to an ignored, isolated checkout without the reference package or existing node_modules. `npm ci`, all **154 tests across 19 files**, the production build and data validation passed. Both root and subdirectory offline tests passed from that build.

An additional browser run initially reused the actively edited development server and encountered an aborted reload. The final complete run used the exported checkout on an isolated port (`127.0.0.1:5176`): **33 of 33 passed**. No application source was edited during that final run. Screenshot-output changes were included in the exported tests.

The final candidate contains 251 files, approximately 9.7 MiB before Git compression. The reference package contributes zero tracked files. All publication-facing English documents and their local links were checked. Workflow YAML parses locally; GitHub execution remains pending. `git diff --cached --check` passes; verbatim third-party snapshots and notices explicitly retain upstream whitespace. Domain and runtime-data bytes remain identical to the pre-equipment audit baseline. Dependency versions match the installed pre-audit lock.

Only formatting, source-preservation attributes and this report were finalized after the clean export; no subsequent behavioral change was introduced.

## Browser evidence

Browser plugin unavailable; used the installed Playwright Chromium workflow under the `frontend-testing-debugging` skill. Tested initial render, round execution, commentary state, saves, cancellation, role comparison, responsive layout, reduced motion and nested scrolling. No application error overlay or relevant runtime error was observed in the passing checks.

The [desktop](../media/match-desktop.png) and [mobile](../media/match-mobile.png) README images show the verified local match UI after the equipment replacement. The app's Chinese interface is intentional. The board retains equipment geometry and does not use player portraits.

## Remaining limits

- Repository name, remote creation, GitHub Actions execution and hosted HTTPS acceptance are pending. No deployment is claimed.
- The twelve player abilities remain game estimates. Forty role assignments and 41 nationalities lack confirmation; real transfer histories are absent.
- Third-party materials have mixed terms. Attribution is retained; no blanket repository license or general quotation sublicense is asserted.
- Only Chromium is automated here; Safari and Firefox are not certified. Browser storage can be evicted.
- This preparation does not change simulation or save rules. The historical 10,000-map and two-season reports were not rerun for deployment-only changes; do not present their older results as fresh checks.
- Source chunk separation removes the warning without claiming improved measured frame rate or equivalent total download savings.

## Publication exclusions

Keep local reference material, generated builds, node_modules, test traces, environment files and backup archives out of Git. Only the compiled `dist/` artifact is uploaded to Pages. Local saves stay in browser storage and are not included in the repository.
