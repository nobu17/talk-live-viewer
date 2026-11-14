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
npm run validate:data
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
4. Actions backs up the currently published `data/*.json` files when available.
5. Actions runs `npm run fetch:events`.
6. Actions runs `npm run validate:data`.
7. If fetching or validation fails, Actions restores the previously published JSON backup.
8. Actions runs `npm run build`.
9. The generated or restored JSON is copied into `dist/data/` by Vite and published as part of the Pages artifact.

Do not commit generated `events.json`, `venues.json`, `fetch-log.json`, or `fetch-errors.json` unless the project intentionally changes to a data-history-in-Git workflow.

## GitHub Pages

The Pages workflow is `.github/workflows/deploy-pages.yml`.

- It runs on `main` pushes, manual `workflow_dispatch`, and scheduled refreshes.
- It runs manually with `workflow_dispatch` and on scheduled refreshes.
- The scheduled refresh is Tuesday/Thursday/Sunday 27:00 JST, which is Wednesday/Friday/Monday 03:00 JST and Monday/Wednesday/Saturday 18:00 UTC in GitHub Actions cron.
- It runs tests before fetching event data, so test failures do not waste external scraping work.
- It generates event data during the workflow before building.
- It validates generated data before building. If refresh validation fails and previously published JSON exists, that previous data is restored and deployed instead.
- It deploys the built `dist/` artifact using GitHub Pages Actions.
- `vite.config.ts` derives the Pages base path from the repository name on GitHub Actions. Set `VITE_BASE` only if the deployment path needs to be overridden.

## Scheduled Workflow Keepalive

GitHub automatically disables scheduled workflows in public repositories after 60 days without repository activity. `.github/workflows/keepalive.yml` checks the default branch daily at 04:23 JST and creates a commit only when its latest commit is at least 30 days old. The commit records a UTC timestamp in `.github/keepalive.txt`; normal development commits postpone it.

The keepalive workflow uses the built-in `GITHUB_TOKEN` with `contents: write`. It needs permission to push directly to the default branch; branch protection or repository rules can block this push. It does not force-push or bypass those rules. A concurrent push can also cause a safe rejection; the next daily run checks again. Check workflow failures if keepalive commits are not being created.

Pushes made with `GITHUB_TOKEN` do not trigger the Pages push workflow. Event data continues to refresh through the existing deployment schedule, independently of keepalive commits.

After merging, run **Keep scheduled workflows active** manually on the default branch to check access and execution (recent commits result in a successful no-op). This no-op does not verify push permissions; check branch rules separately. If **Deploy GitHub Pages** is already disabled, enable it in the Actions UI and run it with `refresh_data=true` to restore fresh data. The keepalive workflow prevents inactivity but cannot recover itself if its own schedule has already been disabled.

## Notes for AI Agents

Read `AGENTS.md` first. It contains the working assumptions, file ownership, and verification commands for this repository.
