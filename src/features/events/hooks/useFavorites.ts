import React from "react";
import type { TalkEvent } from "../types";
import {
  createFavoriteShareUrl,
  favoritesStorageKey,
  mergeFavoriteSnapshots,
  mergeFavoriteEvents,
  parseFavoriteShareHash,
  parseFavoriteSnapshots,
  serializeFavoriteSnapshots,
  toggleFavoriteSnapshot,
} from "../utils/favorites";

export function useFavorites(events: TalkEvent[]) {
  const [snapshots, setSnapshots] = React.useState(() => readSnapshots());

  React.useEffect(() => {
    writeSnapshots(snapshots);
  }, [snapshots]);

  const favoriteIds = React.useMemo(() => new Set(snapshots.map((snapshot) => snapshot.id)), [snapshots]);
  const favoriteEvents = React.useMemo(() => mergeFavoriteEvents(events, snapshots), [events, snapshots]);
  const shareUrl = React.useMemo(() => {
    if (typeof window === "undefined" || snapshots.length === 0) {
      return "";
    }
    return createFavoriteShareUrl(snapshots, window.location.href);
  }, [snapshots]);

  const isFavorite = React.useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);
  const toggleFavorite = React.useCallback((event: TalkEvent) => {
    setSnapshots((current) => toggleFavoriteSnapshot(current, event));
  }, []);
  const clearFavorites = React.useCallback(() => {
    setSnapshots([]);
  }, []);
  const importFavoritesFromHash = React.useCallback((hash: string) => {
    const incoming = parseFavoriteShareHash(hash);
    if (incoming.length === 0) {
      return 0;
    }
    setSnapshots((current) => mergeFavoriteSnapshots(current, incoming));
    return incoming.length;
  }, []);

  return {
    favoriteEvents,
    favoriteCount: snapshots.length,
    shareUrl,
    isFavorite,
    toggleFavorite,
    clearFavorites,
    importFavoritesFromHash,
  };
}

function readSnapshots() {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    return parseFavoriteSnapshots(window.localStorage.getItem(favoritesStorageKey));
  } catch {
    return [];
  }
}

function writeSnapshots(snapshots: ReturnType<typeof readSnapshots>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(favoritesStorageKey, serializeFavoriteSnapshots(snapshots));
  } catch {
    // Ignore storage failures so browsing remains usable.
  }
}
