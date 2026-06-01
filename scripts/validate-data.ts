import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { TalkEvent, Venue } from "../src/types";

const dataDir = join(process.cwd(), "public", "data");
const minEvents = Number(process.env.DATA_MIN_EVENTS ?? 50);

async function main() {
  const events = await readJson<TalkEvent[]>("events.json");
  const venues = await readJson<Venue[]>("venues.json");

  assert(Array.isArray(events), "events.json must be an array.");
  assert(Array.isArray(venues), "venues.json must be an array.");
  assert(events.length >= minEvents, `events.json has ${events.length} events; expected at least ${minEvents}.`);
  assert(venues.length > 0, "venues.json must contain at least one venue.");

  const venueIds = new Set(venues.map((venue) => venue.id));
  const invalidVenue = venues.find((venue) => !venue.id || !venue.name || !venue.scheduleUrl);
  assert(!invalidVenue, `venues.json contains an invalid venue: ${JSON.stringify(invalidVenue)}`);

  const invalidEvent = events.find(
    (event) =>
      !event.id ||
      !event.venueId ||
      !event.venueName ||
      !event.sourceUrl ||
      !event.title ||
      !/^\d{4}-\d{2}-\d{2}$/.test(event.date) ||
      !Array.isArray(event.performers) ||
      !Array.isArray(event.ticketLinks) ||
      !event.fetchedAt ||
      !venueIds.has(event.venueId),
  );
  assert(!invalidEvent, `events.json contains an invalid event: ${JSON.stringify(invalidEvent)}`);

  console.log(`Validated ${events.length} events and ${venues.length} venues.`);
}

async function readJson<T>(fileName: string): Promise<T> {
  const content = await readFile(join(dataDir, fileName), "utf8");
  return JSON.parse(content) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
