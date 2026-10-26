# Third-party notices

Source attribution is not a blanket permission to reuse all material. Original upstream notices are preserved, including notices written in Chinese.

| Material | Source and treatment |
| --- | --- |
| Roster snapshot | [Valve regional standings](https://github.com/ValveSoftware/counter-strike_regional_standings), dated October 5, 2026. Local source snapshots and per-record URLs are retained. This is not live roster data. |
| Player identity enrichment | [CS2-pro-steamid-lib](https://github.com/unicbm/CS2-pro-steamid-lib). See [upstream notice](data/source/identity-license.md) and [record attribution](data/normalized/identity-attribution.json). Liquipedia-derived material is attributed to Liquipedia contributors under CC BY-SA 3.0; original factual curation is subject to upstream's stated scope. |
| Player performance evidence | HLTV articles and statistics, with dates and sample descriptions in [evidence records](data/source/player-evidence-2026-10-26.json). Numeric game abilities are project estimates, not official ratings. |
| Weapon silhouettes and death marker | [Lexogrine CS2 React HUD](https://github.com/lexogrine/cs2-react-hud), commit `7874750c97fcecd8f72eb3fad382917e035ec651`. Its [MIT notice](src/assets/equipment/LEXOGRINE-LICENSE.txt) is retained. |
| Utility, armor, helmet, kit and C4 artwork | [counter-strike-icons](https://github.com/Juknum/counter-strike-icons), commit `92fa323cb5f954f310b8d653a7c280f5d1335163`, CS2 build `26144732`. The repository identifies these as extracted CS2 assets owned by Valve. Its [asset notice](src/assets/equipment/VALVE-ASSETS-LICENSE.md) is retained; the extraction tooling license is not a blanket asset license. |
| Commentary | User-supplied subtitle-derived quotations, original templates and style notes. Attribution and context remain attached. The project has not independently certified every transcript or obtained a general sublicense for all quotations. |
| Runtime and build libraries | React, GSAP, Lenis, Vite, TypeScript and the locked toolchain retain their upstream licenses. See the package versions in `package-lock.json` and each dependency's distributed notices. |

[Equipment provenance](src/assets/equipment/sources.json) pins each SVG to its source and SHA-256. Geometry is preserved; UI masks apply team colors. No real player portraits or club logos are bundled.

The website favicon reuses the existing helmet geometry from `src/assets/equipment/helmet.svg`, recolored in the interface's gold on a dark background. The same Valve asset attribution above applies.

The local `esm2026-extract/` reference package and bulk extracted symbol/content indexes are excluded from publication. Match rules are implemented in this project's own regional simulation; missing original functions are not represented as verified original mechanics.
