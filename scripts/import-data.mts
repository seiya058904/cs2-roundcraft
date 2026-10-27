// Rebuild the complete checked-in dataset, in dependency order, using the local source snapshots.
await import('./import-vrs.mts');
await import('./enrich-players.mts');
await import('./enrich-regions.mts');
await import('./apply-player-evidence.mts');
await import('./import-commentary.mts');
(await import('./import-quotes.mts')).importQuotes();
await import('./import-nicknames.mts');
