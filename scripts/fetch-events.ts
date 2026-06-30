import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const requestDelayMs = readNonNegativeInteger("FETCH_REQUEST_DELAY_MS", 1_000);
const maxFetchRetries = readNonNegativeInteger("FETCH_MAX_RETRIES", 3);
const retryBaseDelayMs = readNonNegativeInteger("FETCH_RETRY_BASE_DELAY_MS", 2_000);
const lastRequestStartedAt = new Map<string, number>();

type FetchError = {
  venueId: string;
  url: string;
  message: string;
};

async function main() {
  const errors: FetchError[] = [];
  const events: TalkEvent[] = [];
  const retainedEvents: TalkEvent[] = [];
  const retainedEventIds = new Set<string>();
  const previousEvents = await readPreviousEvents(process.env.PREVIOUS_EVENTS_PATH);
  const previousEventsById = new Map(previousEvents.map((event) => [event.id, event]));

  for (const venue of venues) {
    const monthUrls = buildMonthUrls(venue.scheduleUrl, 5, undefined, venue.provider);
    const failedSourceUrls = new Set<string>();
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
            const previousEvent = previousEventsById.get(stub.id);
            if (previousEvent) {
              retainedEvents.push(previousEvent);
              retainedEventIds.add(previousEvent.id);
            } else {
              events.push({ ...stub, ticketLinks: [] });
            }
          }
        }
      } catch (error) {
        errors.push(toFetchError(venue.id, sourceUrl, error));
        failedSourceUrls.add(sourceUrl);
      }
    }

    for (const event of selectPreviousEventsForFailedSources(previousEvents, venue.id, failedSourceUrls)) {
      retainedEvents.push(event);
      retainedEventIds.add(event.id);
    }
  }

  const normalized = mergeDuplicateEvents([...retainedEvents, ...events]).sort((a, b) =>
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
    retainedEventCount: retainedEventIds.size,
  });
  await writeJson(join(outDir, "fetch-errors.json"), errors);

  console.log(
    `Wrote ${normalized.length} events with ${errors.length} fetch errors; retained ${retainedEventIds.size} previous events.`,
  );
}

export function selectPreviousEventsForFailedSources(
  previousEvents: TalkEvent[],
  venueId: string,
  failedSourceUrls: Set<string>,
) {
  if (failedSourceUrls.size === 0) {
    return [];
  }

  const venueEvents = previousEvents.filter((event) => event.venueId === venueId);
  const matchingEvents = venueEvents.filter((event) => failedSourceUrls.has(event.sourceUrl));
  const matchedSources = new Set(matchingEvents.map((event) => event.sourceUrl));
  const hasUnmatchedSource = [...failedSourceUrls].some((sourceUrl) => !matchedSources.has(sourceUrl));

  // A newly requested month has no exact previous URL. Keep the venue's prior
  // data rather than publishing it as empty after a temporary fetch failure.
  return hasUnmatchedSource ? venueEvents : matchingEvents;
}

export function buildMonthUrls(
  baseScheduleUrl: string,
  months = 5,
  start = addMonths(tokyoToday(), -1),
  provider: "loft" | "lateral" | "bookandbeer" | "dommune" | "pundit" = "loft",
) {
  const urls: string[] = [];
  const base = new URL(baseScheduleUrl);
  const current = addMonths(start, 1);
  const currentMonth = current.getMonth();
  const currentYear = current.getFullYear();
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

function tokyoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Date(year, month - 1, day);
}

type FetchTextOptions = {
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  requestDelayMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
};

export async function fetchText(url: string, options: FetchTextOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? wait;
  const delayMs = options.requestDelayMs ?? requestDelayMs;
  const retries = options.maxRetries ?? maxFetchRetries;
  const baseRetryMs = options.retryBaseDelayMs ?? retryBaseDelayMs;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await paceHostRequest(url, delayMs, sleep);

    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: {
          "user-agent": "talk-live-viewer/0.1 (+https://github.com/)",
        },
      });
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      const retryDelay = baseRetryMs * 2 ** attempt;
      console.warn(`Fetch failed for ${url}; retrying in ${retryDelay}ms.`);
      await sleep(retryDelay);
      continue;
    }

    if (response.ok) {
      return response.text();
    }

    const message = `${response.status} ${response.statusText}`;
    if (!isRetryableStatus(response.status) || attempt === retries) {
      throw new Error(message);
    }

    await response.body?.cancel();
    const retryDelay = parseRetryAfter(response.headers.get("retry-after")) ?? baseRetryMs * 2 ** attempt;
    console.warn(`${message} for ${url}; retrying in ${retryDelay}ms.`);
    await sleep(retryDelay);
  }

  throw new Error(`Failed to fetch ${url}.`);
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

async function readPreviousEvents(path: string | undefined) {
  if (!path) {
    return [];
  }

  try {
    const value = JSON.parse(await readFile(path, "utf8")) as unknown;
    if (!Array.isArray(value)) {
      throw new Error("previous events data is not an array");
    }
    console.log(`Loaded ${value.length} previous events from ${path}.`);
    return value as TalkEvent[];
  } catch (error) {
    console.warn(`Could not load previous events from ${path}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

async function paceHostRequest(url: string, delayMs: number, sleep: (milliseconds: number) => Promise<void>) {
  if (delayMs <= 0) {
    return;
  }

  const host = new URL(url).host;
  const previousStartedAt = lastRequestStartedAt.get(host);
  if (previousStartedAt !== undefined) {
    const remainingDelay = delayMs - (Date.now() - previousStartedAt);
    if (remainingDelay > 0) {
      await sleep(remainingDelay);
    }
  }
  lastRequestStartedAt.set(host, Date.now());
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

function parseRetryAfter(value: string | null) {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function readNonNegativeInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
