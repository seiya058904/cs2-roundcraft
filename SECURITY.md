# Security

This is a client-side game with no application account system, backend or telemetry. A static hosting provider may still process ordinary request logs. Saves are stored in the browser; exported JSON files may contain custom team names and play history.

Do not post tokens, private information or personal saves in a public issue. For a suspected security vulnerability, use GitHub private vulnerability reporting if enabled. If it is unavailable, open a minimal issue asking the maintainer for a private reporting channel, without exploit details or sensitive data.

Only the current `main` branch is maintained. Fix availability depends on maintainer review; no response-time guarantee is made.

Save import validates structure and domain constraints, but only import files you trust. The 80 MB input limit is a guardrail, not a guarantee against every resource-exhaustion case.

The production service worker caches only this deployment's files and removes only obsolete caches in its own URL scope. Clearing site data deletes local saves as well as caches; export a backup first.
