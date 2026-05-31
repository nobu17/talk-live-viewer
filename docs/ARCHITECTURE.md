# Architecture Notes

## Current Shape

This app is intentionally static. There is no runtime server, database, or API layer. The only network scraping happens in the data generation script, usually through GitHub Actions.

```text
LOFT schedule pages
Lateral Osaka schedule pages
Book and Beer event category pages
DOMMUNE top page
Pundit Shopify collection pages
  -> scripts/fetch-events.ts
  -> public/data/events.json + venues.json generated during local/Actions builds
  -> React SPA
  -> GitHub Pages
```

## Frontend Boundaries

- `src/app/` owns top-level composition and screen selection.
- `src/components/` contains shared UI that is not event-domain-specific.
- `src/features/events/components/` contains event-domain UI.
- `src/features/events/hooks/` contains event-domain data and routing hooks.
- `src/features/events/utils/` contains pure event/date helpers.
- `src/features/events/types.ts` is the canonical frontend data contract.
- `src/types.ts` re-exports event types for script imports.

## Data Contract

The SPA expects `public/data/events.json` to be an array of normalized event records with at least:

- `id`
- `venueId`
- `venueName`
- `sourceUrl`
- `title`
- `date`
- `performers`
- `ticketLinks`
- `fetchedAt`

Optional detail fields include:

- `detailUrl`
- `weekday`
- `openTime`
- `startTime`
- `isStreaming`
- `priceText`
- `description`
- `imageUrl`

Keep this contract compatible when changing the fetcher or parser.

`public/data/*.json` is generated data and is ignored by Git. The directory is kept with `public/data/.gitkeep`; real JSON files should be created by `npm run fetch:events` before local development/builds or by GitHub Actions before deploying Pages.

## Remote Images

Event images are displayed by referencing the original remote image URL. Do not download, commit, cache, transform, or re-host image files in this repository.

- `imageUrl` may be stored in generated JSON.
- The UI should render the original URL directly with lazy loading.
- Broken images should disappear rather than show a broken icon.
- Only known source image hosts are displayed by default. Current allowed hosts are `loft-prj.co.jp`, `lateral-osaka.com`, `bookandbeer.com`, `dommune.com`, and `pundit.jp`.
- Keep official event links visible so users can reach the source page.

## Scraper Boundaries

- `scripts/venues.ts` is the source of truth for target venues.
- `scripts/fetch-events.ts` handles orchestration, fetch errors, JSON writing, and source URL generation.
- `scripts/parser.ts` handles LOFT HTML parsing and normalization.
- `scripts/lateral-parser.ts` handles Lateral Osaka HTML parsing and normalization.
- `scripts/bookandbeer-parser.ts` handles Honya B&B HTML parsing and normalization.
- `scripts/dommune-parser.ts` handles DOMMUNE teaser/detail parsing and normalization.
- `scripts/pundit-parser.ts` handles Pundit Shopify collection/product parsing and normalization.
- Parser failures should not remove an event if schedule-page data is available.

## Streaming Detection

`isStreaming` is intentionally conservative and has a fixed precedence:

1. Explicit LOFT text such as `配信あり` or `配信なし` is authoritative.
2. If explicit text is unknown, detail-page text and ticket links may infer streaming availability from strong signals such as `twitcasting`, `ツイキャス`, `zaiko`, `Streaming+`, `配信チケット`, `オンライン配信`, `有料配信`, `生配信`, `アーカイブ配信`, or `視聴チケット`.
3. Inference may set unknown events to `true`, but must not override explicit `false`.

Known examples:

- `https://www.loft-prj.co.jp/schedule/plusone/353273` should parse as `isStreaming: true`.
- `https://www.loft-prj.co.jp/schedule/plusone/351358` should parse as `isStreaming: false`.

Lateral Osaka, Honya B&B, and Pundit use separate parsers. They may not expose the same explicit streaming labels as LOFT, so their `isStreaming` values are inferred only when strong streaming signals exist. DOMMUNE entries are treated as streaming-capable by source type.

## GitHub Actions

- The Pages workflow should install dependencies, run `npm run fetch:events`, test, build, and deploy `dist/`.
- Generated `public/data/*.json` should not be committed. Vite copies the generated files into `dist/data/`, and that build artifact is what GitHub Pages serves.
- A separate scheduled/manual update workflow is optional, but it should deploy a fresh artifact rather than commit generated JSON unless the project intentionally wants data history in Git.

## Future Extension Points

- Add keyword/search filtering in `src/features/events/utils/eventFilters.ts` and the app controls.
- Adjust archive visibility by changing `archiveLookbackDays` in `src/features/events/utils/eventFilters.ts`.
- Add new venues by editing `scripts/venues.ts`; generated `venues.json` will follow.
- Add parser cases in `scripts/parser.ts`, `scripts/fetch-events.ts`, or a provider-specific parser test.
