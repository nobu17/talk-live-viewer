import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { TalkEvent } from "../src/types";
import { parseBookAndBeerDetailPage, parseBookAndBeerSchedulePage } from "./bookandbeer-parser";
import { parseDommuneDetailPage, parseDommuneSchedulePage } from "./dommune-parser";
import { parseLateralDetailPage, parseLateralSchedulePage } from "./lateral-parser";
import { mergeDuplicateEvents, parseDetailPage, parseSchedulePage } from "./parser";
import { parsePunditDetailPage, parsePunditSchedulePage } from "./pundit-parser";
import { venues } from "./venues";

const outDir = join(process.cwd(), "public", "data");
const fetchedAt = new Date().toISOString();

type FetchError = {
  venueId: string;
  url: string;
  message: string;
};

async function main() {
  const errors: FetchError[] = [];
  const events: TalkEvent[] = [];

  for (const venue of venues) {
    const monthUrls = buildMonthUrls(venue.scheduleUrl, 5, undefined, venue.provider);
    for (const sourceUrl of monthUrls) {
      try {
        const html = await fetchText(sourceUrl);
        const stubs =
          venue.provider === "lateral"
            ? parseLateralSchedulePage(html, { ...venue, scheduleUrl: sourceUrl }, fetchedAt)
            : venue.provider === "bookandbeer"
              ? parseBookAndBeerSchedulePage(html, { ...venue, scheduleUrl: sourceUrl }, fetchedAt)
              : venue.provider === "dommune"
                ? parseDommuneSchedulePage(html, { ...venue, scheduleUrl: sourceUrl }, fetchedAt)
                : venue.provider === "pundit"
                  ? parsePunditSchedulePage(html, { ...venue, scheduleUrl: sourceUrl }, fetchedAt)
                  : parseSchedulePage(html, { ...venue, scheduleUrl: sourceUrl }, fetchedAt);
        for (const stub of stubs) {
          try {
            const detailHtml = stub.detailUrl ? await fetchText(stub.detailUrl) : "";
            events.push(
              detailHtml
                ? venue.provider === "lateral"
                  ? parseLateralDetailPage(detailHtml, stub)
                  : venue.provider === "bookandbeer"
                    ? parseBookAndBeerDetailPage(detailHtml, stub)
                    : venue.provider === "dommune"
                      ? parseDommuneDetailPage(detailHtml, stub)
                      : venue.provider === "pundit"
                        ? parsePunditDetailPage(detailHtml, stub)
                        : parseDetailPage(detailHtml, stub)
                : { ...stub, ticketLinks: [] },
            );
          } catch (error) {
            errors.push(toFetchError(venue.id, stub.detailUrl ?? sourceUrl, error));
            events.push({ ...stub, ticketLinks: [] });
          }
        }
      } catch (error) {
        errors.push(toFetchError(venue.id, sourceUrl, error));
      }
    }
  }

  const normalized = mergeDuplicateEvents(events).sort((a, b) =>
    `${a.date} ${a.startTime ?? ""} ${a.venueId}`.localeCompare(`${b.date} ${b.startTime ?? ""} ${b.venueId}`),
  );

  await mkdir(outDir, { recursive: true });
  await writeJson(join(outDir, "events.json"), normalized);
  await writeJson(join(outDir, "venues.json"), venues);
  await writeJson(join(outDir, "fetch-log.json"), {
    fetchedAt,
    eventCount: normalized.length,
    venueCount: venues.length,
    errorCount: errors.length,
  });
  await writeJson(join(outDir, "fetch-errors.json"), errors);

  console.log(`Wrote ${normalized.length} events with ${errors.length} fetch errors.`);
}

export function buildMonthUrls(
  baseScheduleUrl: string,
  months = 5,
  start = addMonths(new Date(), -1),
  provider: "loft" | "lateral" | "bookandbeer" | "dommune" | "pundit" = "loft",
) {
  const urls: string[] = [];
  const base = new URL(baseScheduleUrl);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  for (let offset = 0; offset < months; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + offset, 1);
    const url = new URL(base.toString());
    if (provider === "bookandbeer" || provider === "dommune") {
      if (offset === 0) {
        urls.push(base.toString());
      }
      continue;
    }
    if (provider === "pundit") {
      if (offset === 0) {
        urls.push(base.toString());
      } else {
        url.searchParams.set("page", String(offset + 1));
        urls.push(url.toString());
      }
      continue;
    }
    if (provider === "lateral") {
      const relativeMonth = (date.getFullYear() - currentYear) * 12 + date.getMonth() - currentMonth;
      url.searchParams.set("plus_month", String(relativeMonth));
    } else {
      url.searchParams.set("schedulemonth", String(date.getMonth() + 1));
      url.searchParams.set("scheduleyear", String(date.getFullYear()));
    }
    urls.push(url.toString());
  }
  return urls;
}

function addMonths(value: Date, offset: number) {
  return new Date(value.getFullYear(), value.getMonth() + offset, 1);
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "talk-live-viewer/0.1 (+https://github.com/)",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toFetchError(venueId: string, url: string, error: unknown): FetchError {
  return {
    venueId,
    url,
    message: error instanceof Error ? error.message : String(error),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
