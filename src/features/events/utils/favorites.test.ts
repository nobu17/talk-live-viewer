import { describe, expect, it } from "vitest";
import type { TalkEvent } from "../types";
import {
  createFavoriteSnapshot,
  mergeFavoriteEvents,
  parseFavoriteSnapshots,
  serializeFavoriteSnapshots,
  toggleFavoriteSnapshot,
} from "./favorites";

const baseEvent: TalkEvent = {
  id: "plusone-1",
  venueId: "plusone",
  venueName: "LOFT/PLUS ONE",
  sourceUrl: "https://example.com/schedule",
  detailUrl: "https://example.com/events/1",
  title: "Original title",
  date: "2026-06-01",
  performers: ["Performer"],
  ticketLinks: [],
  fetchedAt: "2026-05-30T00:00:00.000Z",
};

describe("favorites", () => {
  it("toggles favorite snapshots by event id", () => {
    const added = toggleFavoriteSnapshot([], baseEvent, "2026-06-01T00:00:00.000Z");

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      id: "plusone-1",
      title: "Original title",
      savedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(toggleFavoriteSnapshot(added, baseEvent)).toEqual([]);
  });

  it("uses latest event data when a saved favorite is still in generated data", () => {
    const snapshot = createFavoriteSnapshot(baseEvent, "2026-06-01T00:00:00.000Z");
    const latest = { ...baseEvent, title: "Updated title", startTime: "19:00" };

    expect(mergeFavoriteEvents([latest], [snapshot])[0]).toMatchObject({
      id: "plusone-1",
      title: "Updated title",
      startTime: "19:00",
    });
  });

  it("keeps saved snapshots when generated data no longer contains the event", () => {
    const snapshot = createFavoriteSnapshot(baseEvent, "2026-06-01T00:00:00.000Z");

    expect(mergeFavoriteEvents([], [snapshot])[0]).toMatchObject({
      id: "plusone-1",
      title: "Original title",
    });
  });

  it("ignores invalid stored values", () => {
    expect(parseFavoriteSnapshots("not json")).toEqual([]);
    expect(parseFavoriteSnapshots(JSON.stringify([{ id: "missing-fields" }]))).toEqual([]);
  });

  it("round-trips valid snapshots", () => {
    const snapshot = createFavoriteSnapshot(baseEvent, "2026-06-01T00:00:00.000Z");

    expect(parseFavoriteSnapshots(serializeFavoriteSnapshots([snapshot]))).toEqual([snapshot]);
  });
});
