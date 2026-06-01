# Talk Live Viewer

Static SPA for viewing LOFT PROJECT talk live schedules by day.

## Overview

Talk Live Viewer reads generated JSON from `public/data/` and displays upcoming events in a Vite + React app. The data is refreshed by a Node script and should be generated locally or on GitHub Actions before building.

The app currently supports:

- Events from the last two weeks through future schedules, grouped by date.
- Venue filtering.
- Month filtering.
- In-app event detail pages.
- Static hosting on GitHub Pages.

## Development

```sh
npm install
npm run fetch:events
npm run dev
```

Useful commands:

```sh
npm test
npm run build
npm run fetch:events
```

On Windows PowerShell, use `npm.cmd` if `npm` is blocked by execution policy.

## Project Structure

```text
src/
  app/                 top-level app composition
  components/          shared UI components
  features/events/     event feature components, hooks, utils, and types
  main.tsx             React entrypoint
  styles.css           global styles

scripts/
  fetch-events.ts      fetch schedule/detail pages and write JSON
  parser.ts            parse LOFT HTML into normalized event data
  venues.ts            venue source list

public/data/
  .gitkeep             keeps the generated-data directory in Git
  events.json          generated event data, ignored by Git
  venues.json          generated venue data, ignored by Git
  fetch-log.json       generated fetch summary, ignored by Git
  fetch-errors.json    generated fetch errors, ignored by Git
```

## Data Flow

1. `scripts/venues.ts` defines the target venue schedule URLs.
2. `npm run fetch:events` fetches schedule pages for the previous month, current month, and three future months using LOFT's `schedulemonth` and `scheduleyear` query parameters.
3. The fetcher parses schedule pages, follows event detail pages, and writes JSON to `public/data/`.
4. The React app loads `./data/events.json` and `./data/venues.json` at runtime.

## Generated Data Policy

`public/data/*.json` is generated data, not source code, so it is ignored by Git. Run `npm run fetch:events` before local development or production builds that need real event data.

For GitHub Pages, the intended flow is:

1. GitHub Actions checks out the repository.
2. Actions runs `npm ci`.
3. Actions runs `npm test`.
4. Actions runs `npm run fetch:events`.
5. Actions runs `npm run build`.
6. The generated JSON is copied into `dist/data/` by Vite and published as part of the Pages artifact.

Do not commit generated `events.json`, `venues.json`, `fetch-log.json`, or `fetch-errors.json` unless the project intentionally changes to a data-history-in-Git workflow.

## GitHub Pages

The Pages workflow is `.github/workflows/deploy-pages.yml`.

- It runs on `main` pushes, manual `workflow_dispatch`, and scheduled refreshes.
- It runs manually with `workflow_dispatch` and on scheduled refreshes.
- The scheduled refresh is Tuesday/Thursday/Sunday 27:00 JST, which is Wednesday/Friday/Monday 03:00 JST and Monday/Wednesday/Saturday 18:00 UTC in GitHub Actions cron.
- It runs tests before fetching event data, so test failures do not waste external scraping work.
- It generates event data during the workflow before building.
- It deploys the built `dist/` artifact using GitHub Pages Actions.
- `vite.config.ts` derives the Pages base path from the repository name on GitHub Actions. Set `VITE_BASE` only if the deployment path needs to be overridden.

## Notes for AI Agents

Read `AGENTS.md` first. It contains the working assumptions, file ownership, and verification commands for this repository.
