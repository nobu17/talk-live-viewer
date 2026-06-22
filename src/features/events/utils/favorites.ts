import type { TalkEvent } from "../types";

export type FavoriteEventSnapshot = TalkEvent & {
  savedAt: string;
};

export const favoritesStorageKey = "talk-live-viewer:favorites:v1";

export function createFavoriteSnapshot(event: TalkEvent, savedAt = new Date().toISOString()): FavoriteEventSnapshot {
  return {
    ...event,
    savedAt,
  };
}

export function parseFavoriteSnapshots(value: string | null): FavoriteEventSnapshot[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isFavoriteEventSnapshot);
  } catch {
    return [];
  }
}

export function serializeFavoriteSnapshots(snapshots: FavoriteEventSnapshot[]) {
  return JSON.stringify(snapshots, null, 2);
}

export function toggleFavoriteSnapshot(
  snapshots: FavoriteEventSnapshot[],
  event: TalkEvent,
  savedAt = new Date().toISOString(),
) {
  if (snapshots.some((snapshot) => snapshot.id === event.id)) {
    return snapshots.filter((snapshot) => snapshot.id !== event.id);
  }
  return [createFavoriteSnapshot(event, savedAt), ...snapshots];
}

export function mergeFavoriteEvents(events: TalkEvent[], snapshots: FavoriteEventSnapshot[]): TalkEvent[] {
  const latestById = new Map(events.map((event) => [event.id, event]));
  return snapshots.map((snapshot) => latestById.get(snapshot.id) ?? snapshot);
}

function isFavoriteEventSnapshot(value: unknown): value is FavoriteEventSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Partial<FavoriteEventSnapshot>;
  return (
    typeof event.id === "string" &&
    typeof event.venueId === "string" &&
    typeof event.venueName === "string" &&
    typeof event.sourceUrl === "string" &&
    typeof event.title === "string" &&
    typeof event.date === "string" &&
    Array.isArray(event.performers) &&
    Array.isArray(event.ticketLinks) &&
    typeof event.fetchedAt === "string" &&
    typeof event.savedAt === "string"
  );
}
