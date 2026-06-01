# Agent Instructions

This repository is a static React app for browsing talk live event schedules across several event venues.

## Product Goal

- Show events grouped by day.
- Include recent past events because archive streaming can remain useful.
- Let users filter the list by venue and month.
- Open official event detail pages in a new tab from event cards.
- Host the app as a static SPA on GitHub Pages.
- Do not add a backend service unless the project direction changes.

## Architecture

- Frontend: Vite + React + TypeScript.
- Routing: hash-based routing implemented in `src/features/events/hooks/useHashRoute.ts`.
- Data source: static JSON files under `public/data/`.
- Data generation: Node/TypeScript scripts under `scripts/`.
- Deployment: GitHub Actions workflow under `.github/workflows/deploy-pages.yml`.
- Generated JSON under `public/data/*.json` is ignored by Git and should be produced before local builds or inside the Pages deploy workflow.

## Important Files

- `src/main.tsx`: React entrypoint only.
- `src/app/App.tsx`: top-level app composition and screen switching.
- `src/components/`: shared UI components.
- `src/features/events/`: event feature code, including components, hooks, utils, and types.
- `src/styles.css`: global styling for the SPA.
- `vite.config.ts`: Vite config. GitHub Actions derives the Pages base path from the repository name unless `VITE_BASE` is set.
- `scripts/fetch-events.ts`: fetches source pages and writes generated JSON.
- `scripts/parser.ts`: parses LOFT schedule/detail HTML.
- `scripts/lateral-parser.ts`: parses Lateral Osaka schedule/detail HTML.
- `scripts/bookandbeer-parser.ts`: parses Honya B&B event category/detail HTML.
- `scripts/dommune-parser.ts`: parses DOMMUNE top/detail HTML.
- `scripts/pundit-parser.ts`: parses Pundit Shopify collection/product HTML.
- `scripts/venues.ts`: source-of-truth venue list for the fetcher.
- `public/data/.gitkeep`: keeps the generated data directory present.
- `public/data/events.json`: generated event records read by the SPA; do not commit.
- `public/data/venues.json`: generated venue records read by the SPA; do not commit.

## Working Rules

- Keep `src/main.tsx` minimal. App logic should live below `src/app/` or `src/features/`.
- Keep event-specific code inside `src/features/events/`.
- Keep shared presentational components in `src/components/`.
- Keep generated data shape compatible with `src/features/events/types.ts`.
- Keep generated `public/data/*.json` out of Git. Actions should generate them before `npm run build`, and Vite will copy them into the Pages artifact.
- Preserve the no-backend assumption: browser code should read `./data/*.json`, not scrape source pages directly.
- Use `venue.provider` when adding non-LOFT sources. Add a provider-specific parser instead of forcing unrelated HTML into the LOFT parser.
- DOMMUNE uses the top page as its schedule source. Its teaser links include the year in `/streamings/YYYY/...`, and recent archive entries are filtered to the app's past-14-day window during data generation to avoid keeping old archives in JSON.
- Pundit uses a Shopify collection as its schedule source. The fetcher requests several collection pages with `?page=N`; the parser reads the date from product titles and enriches events from product details.
- Preserve streaming detection precedence in `scripts/parser.ts`: explicit LOFT `配信あり` / `配信なし` text is authoritative. Only infer streaming when the explicit value is unknown. Never let inferred streaming override explicit `配信なし`.
- If a parser changes, add or update tests in `scripts/parser.test.ts` or a provider-specific test file.
- Avoid committing `dist/`, `node_modules/`, and generated `public/data/*.json`.

## Commands

- Install dependencies: `npm install`
- Start local dev server: `npm run dev`
- Build: `npm run build`
- Run tests: `npm test`
- Refresh generated event data: `npm run fetch:events`

On Windows PowerShell, use `npm.cmd` if `npm` is blocked by execution policy.

## Verification Before Hand-Off

Run these after code changes:

```sh
npm test
npm run build
```

Run this after scraper/parser changes:

```sh
npm run fetch:events
```
