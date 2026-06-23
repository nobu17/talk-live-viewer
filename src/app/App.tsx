import React from "react";
import { AppHeader } from "../components/AppHeader";
import { EmptyState } from "../components/EmptyState";
import { FavoriteShare } from "../components/FavoriteShare";
import { FavoriteViewFilter } from "../components/FavoriteViewFilter";
import { MonthFilter } from "../components/MonthFilter";
import { MonthPager } from "../components/MonthPager";
import { PastEventFilter } from "../components/PastEventFilter";
import { VenueFilter } from "../components/VenueFilter";
import { EventDetail } from "../features/events/components/EventDetail";
import { EventList } from "../features/events/components/EventList";
import { useEventData } from "../features/events/hooks/useEventData";
import { useFavorites } from "../features/events/hooks/useFavorites";
import { useHashRoute } from "../features/events/hooks/useHashRoute";
import { getVisibleEvents } from "../features/events/utils/eventFilters";
import { groupByDate } from "../features/events/utils/groupByDate";
import { getAvailableMonths } from "../features/events/utils/months";

export function App() {
  const { events, venues, status } = useEventData();
  const { selectedEventId, goToList } = useHashRoute();
  const { favoriteEvents, favoriteCount, shareUrl, isFavorite, toggleFavorite, importFavoritesFromHash } =
    useFavorites(events);
  const [venueId, setVenueId] = React.useState("all");
  const [monthId, setMonthId] = React.useState("all");
  const [hidePastEvents, setHidePastEvents] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"all" | "favorites">("all");
  const [favoriteImportCount, setFavoriteImportCount] = React.useState(0);

  const changeMonth = React.useCallback((nextMonthId: string) => {
    setMonthId(nextMonthId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const sourceEvents = viewMode === "favorites" ? favoriteEvents : events;
  const includeArchivedPast = viewMode === "favorites";
  const monthOptions = React.useMemo(
    () => getAvailableMonths(getVisibleEvents(sourceEvents, venueId, "all", hidePastEvents, includeArchivedPast)),
    [sourceEvents, venueId, hidePastEvents, includeArchivedPast],
  );
  const visibleEvents = React.useMemo(
    () => getVisibleEvents(sourceEvents, venueId, monthId, hidePastEvents, includeArchivedPast),
    [sourceEvents, venueId, monthId, hidePastEvents, includeArchivedPast],
  );
  const groupedEvents = React.useMemo(() => groupByDate(visibleEvents), [visibleEvents]);
  const selectedEvent =
    events.find((event) => event.id === selectedEventId) ??
    favoriteEvents.find((event) => event.id === selectedEventId);

  React.useEffect(() => {
    if (monthId !== "all" && !monthOptions.some((month) => month.id === monthId)) {
      setMonthId("all");
    }
  }, [monthId, monthOptions]);

  React.useEffect(() => {
    const importFromHash = () => {
      const importedCount = importFavoritesFromHash(window.location.hash);
      if (importedCount === 0) {
        return;
      }
      setFavoriteImportCount(importedCount);
      setViewMode("favorites");
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#/`);
    };

    importFromHash();
    window.addEventListener("hashchange", importFromHash);
    return () => window.removeEventListener("hashchange", importFromHash);
  }, [importFavoritesFromHash]);

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        onBack={goToList}
        isFavorite={isFavorite(selectedEvent.id)}
        onToggleFavorite={toggleFavorite}
      />
    );
  }

  return (
    <main className="app-shell">
      <AppHeader fetchedAt={events[0]?.fetchedAt} />
      <div className="filter-bar">
        <FavoriteViewFilter value={viewMode} favoriteCount={favoriteCount} onChange={setViewMode} />
        <FavoriteShare shareUrl={shareUrl} disabled={favoriteCount === 0} />
        <VenueFilter venues={venues} value={venueId} onChange={setVenueId} />
        <MonthFilter months={monthOptions} value={monthId} onChange={changeMonth} />
        <PastEventFilter checked={hidePastEvents} onChange={setHidePastEvents} />
      </div>
      {favoriteImportCount > 0 && (
        <div className="notice" role="status">
          Imported {favoriteImportCount} favorites.
        </div>
      )}

      {status === "loading" && <EmptyState title="Loading" body="Fetching generated event data." />}
      {status === "error" && (
        <EmptyState title="Could not load data" body="Check that the generated JSON files are available." />
      )}
      {status === "ready" && groupedEvents.length === 0 && viewMode === "favorites" && (
        <EmptyState title="No favorites yet" body="Use the star button on an event to keep it here." />
      )}
      {status === "ready" && groupedEvents.length === 0 && viewMode === "all" && (
        <EmptyState title="No events in range" body="Try another venue filter or update the generated data." />
      )}

      <EventList groupedEvents={groupedEvents} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
      <MonthPager months={monthOptions} value={monthId} onChange={changeMonth} />
    </main>
  );
}
