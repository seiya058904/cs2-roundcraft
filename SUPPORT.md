# Support

For a reproducible bug, open an issue with browser/version, viewport, game mode, seed, actions and expected versus actual behavior. Screenshots are useful; remove private information before sharing them.

## Common questions

**Is the game in English?** The playable interface and commentary are Simplified Chinese. The public README and repository guidance are English.

**Where are my saves?** IndexedDB in the browser you used. Localhost and GitHub Pages have different origins and do not share saves. Export JSON from the Saves screen and import it at the destination. Use the same browser profile for continued play.

**Does offline play work immediately?** The production site must load online and finish caching first. Development mode does not install a service worker. Browser storage eviction or clearing site data can remove the cached app and saves.

**Are player ratings official?** No. Rosters use a dated snapshot, and sourced statistics are shown separately from twelve modeled abilities. Some roles and personal evidence are still missing.

**Is this a CS2 demo viewer?** No. It simulates region-level decisions and plays back its own event log. It does not parse real CS2 demos or implement the game's physics.

**The page looks outdated.** Try an online reload. Export saves before clearing browser data. Include the URL and browser version if the issue persists.
