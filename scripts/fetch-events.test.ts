import { describe, expect, it, vi } from "vitest";
import type { TalkEvent } from "../src/types";
import { fetchText, selectPreviousEventsForFailedSources } from "./fetch-events";

function makeEvent(id: string, venueId: string, sourceUrl: string): TalkEvent {
  return {
    id,
    venueId,
    venueName: venueId,
    sourceUrl,
    title: id,
    date: "2026-06-01",
    performers: [],
    ticketLinks: [],
    fetchedAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("event fetching", () => {
  it("retains only events belonging to failed schedule URLs", () => {
    const previousEvents = [
      makeEvent("june", "plusone", "https://example.com/schedule?month=6"),
      makeEvent("july", "plusone", "https://example.com/schedule?month=7"),
      makeEvent("other", "loft9", "https://example.com/loft9?month=7"),
    ];

    const retained = selectPreviousEventsForFailedSources(
      previousEvents,
      "plusone",
      new Set(["https://example.com/schedule?month=7"]),
    );

    expect(retained.map((event) => event.id)).toEqual(["july"]);
  });

  it("retains venue data when a failed new schedule URL has no previous match", () => {
    const previousEvents = [
      makeEvent("june", "plusone", "https://example.com/schedule?month=6"),
      makeEvent("other", "loft9", "https://example.com/loft9?month=7"),
    ];

    const retained = selectPreviousEventsForFailedSources(
      previousEvents,
      "plusone",
      new Set(["https://example.com/schedule?month=7"]),
    );

    expect(retained.map((event) => event.id)).toEqual(["june"]);
  });

  it("retries temporary server errors", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 503, statusText: "Service Unavailable" }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const delays: number[] = [];

    const result = await fetchText("https://retry.example.com/schedule", {
      fetchImpl,
      requestDelayMs: 0,
      maxRetries: 2,
      retryBaseDelayMs: 10,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    });

    expect(result).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([10]);
  });
});
