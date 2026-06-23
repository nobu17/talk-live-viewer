import type { TalkEvent } from "../types";

export type FavoriteEventSnapshot = TalkEvent & {
  savedAt: string;
};

type FavoriteShareItem = Pick<
  FavoriteEventSnapshot,
  | "id"
  | "venueId"
  | "venueName"
  | "sourceUrl"
  | "detailUrl"
  | "title"
  | "date"
  | "weekday"
  | "openTime"
  | "startTime"
  | "isStreaming"
  | "imageUrl"
  | "savedAt"
>;

type FavoriteSharePayload = {
  version: 1;
  favorites: FavoriteShareItem[];
};

export const favoritesStorageKey = "talk-live-viewer:favorites:v1";
export const favoriteShareLimit = 50;

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

export function mergeFavoriteSnapshots(
  current: FavoriteEventSnapshot[],
  incoming: FavoriteEventSnapshot[],
): FavoriteEventSnapshot[] {
  const merged = new Map(current.map((snapshot) => [snapshot.id, snapshot]));
  for (const snapshot of incoming) {
    merged.set(snapshot.id, snapshot);
  }
  return [...merged.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function createFavoriteShareUrl(snapshots: FavoriteEventSnapshot[], href: string) {
  const url = new URL(href);
  const payload: FavoriteSharePayload = {
    version: 1,
    favorites: snapshots.slice(0, favoriteShareLimit).map(toShareItem),
  };
  url.hash = `/favorites/import?data=${encodeBase64Url(JSON.stringify(payload))}`;
  return url.toString();
}

export function parseFavoriteShareHash(hash: string): FavoriteEventSnapshot[] {
  const route = hash.replace(/^#/, "");
  const match = route.match(/^\/favorites\/import\?(.+)$/);
  if (!match) {
    return [];
  }

  const data = new URLSearchParams(match[1]).get("data");
  if (!data) {
    return [];
  }

  try {
    const payload: unknown = JSON.parse(decodeBase64Url(data));
    if (!isFavoriteSharePayload(payload)) {
      return [];
    }
    return payload.favorites.map(fromShareItem);
  } catch {
    return [];
  }
}

function toShareItem(snapshot: FavoriteEventSnapshot): FavoriteShareItem {
  return {
    id: snapshot.id,
    venueId: snapshot.venueId,
    venueName: snapshot.venueName,
    sourceUrl: snapshot.sourceUrl,
    detailUrl: snapshot.detailUrl,
    title: snapshot.title,
    date: snapshot.date,
    weekday: snapshot.weekday,
    openTime: snapshot.openTime,
    startTime: snapshot.startTime,
    isStreaming: snapshot.isStreaming,
    imageUrl: snapshot.imageUrl,
    savedAt: snapshot.savedAt,
  };
}

function fromShareItem(item: FavoriteShareItem): FavoriteEventSnapshot {
  return {
    ...item,
    performers: [],
    ticketLinks: [],
    fetchedAt: item.savedAt,
  };
}

function isFavoriteSharePayload(value: unknown): value is FavoriteSharePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<FavoriteSharePayload>;
  return payload.version === 1 && Array.isArray(payload.favorites) && payload.favorites.every(isFavoriteShareItem);
}

function isFavoriteShareItem(value: unknown): value is FavoriteShareItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<FavoriteShareItem>;
  return (
    typeof item.id === "string" &&
    typeof item.venueId === "string" &&
    typeof item.venueName === "string" &&
    typeof item.sourceUrl === "string" &&
    typeof item.title === "string" &&
    typeof item.date === "string" &&
    typeof item.savedAt === "string"
  );
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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
