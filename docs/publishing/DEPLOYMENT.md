# Deployment

Approved name: **CS2 Roundcraft**. Repository: [cs2-roundcraft](https://github.com/seiya058904/cs2-roundcraft). Website: [Play](https://seiya058904.github.io/cs2-roundcraft/). Deployment verification is recorded in the publication audit.

## Hosting contract

- Static site only; no backend, secrets or API keys. Build with `npm ci` and `npm run build`.
- Publish only `dist/`, never the workspace or reference package.
- Relative asset URLs support repository subpaths. Navigation is in-memory, without nested client routes.
- Service workers require HTTPS or localhost and use URL-scope-specific caches.
- IndexedDB and preference keys remain stable. A new origin requires JSON export/import to transfer saves.

## Verification

The [workflow](../../.github/workflows/pages.yml) runs unit tests, data checks, production build, browser tests, root offline tests and subdirectory offline tests before uploading the site artifact. Pull requests verify without deploying. Actions are pinned to commits.

The subdirectory test uses a strict static server at `http://127.0.0.1:4175/pages-preview/`, without a fallback that could hide asset errors.

## Publication sequence

1. Confirm the English name; update the title, public links and description consistently.
2. Create the owner's repository with `main` and enable Pages with GitHub Actions as its source.
3. Push the reviewed commit; wait for that exact commit's verification and deployment jobs.
4. Open the reported HTTPS URL and verify the title, ten-player board, execution, equipment, saves and Worker behavior.
5. Test offline reload after caching. Record the deployed SHA, scope and URL in the audit report.

A successful source push is not proof of deployment. Remote permissions and hosted-browser behavior still require live verification.

## References

- [Vite deployment](https://vite.dev/guide/static-deploy.html)
- [Vite relative base URLs](https://vite.dev/guide/build.html#relative-base)
- [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
