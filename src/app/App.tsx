import React from "react";
import { AppHeader } from "../components/AppHeader";
import { EmptyState } from "../components/EmptyState";
import { MonthFilter } from "../components/MonthFilter";
import { MonthPager } from "../components/MonthPager";
import { PastEventFilter } from "../components/PastEventFilter";
import { VenueFilter } from "../components/VenueFilter";
import { EventDetail } from "../features/events/components/EventDetail";
import { EventList } from "../features/events/components/EventList";
import { useEventData } from "../features/events/hooks/useEventData";
import { useHashRoute } from "../features/events/hooks/useHashRoute";
import { getVisibleEvents } from "../features/events/utils/eventFilters";
import { groupByDate } from "../features/events/utils/groupByDate";
import { getAvailableMonths } from "../features/events/utils/months";

export function App() {
  const { events, venues, status } = useEventData();
  const { selectedEventId, goToList } = useHashRoute();
  const [venueId, setVenueId] = React.useState("all");
  const [monthId, setMonthId] = React.useState("all");
  const [hidePastEvents, setHidePastEvents] = React.useState(false);

  const changeMonth = React.useCallback((nextMonthId: string) => {
    setMonthId(nextMonthId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const monthOptions = React.useMemo(
    () => getAvailableMonths(getVisibleEvents(events, venueId, "all", hidePastEvents)),
    [events, venueId, hidePastEvents],
  );
  const visibleEvents = React.useMemo(
    () => getVisibleEvents(events, venueId, monthId, hidePastEvents),
    [events, venueId, monthId, hidePastEvents],
  );
  const groupedEvents = React.useMemo(() => groupByDate(visibleEvents), [visibleEvents]);
  const selectedEvent = events.find((event) => event.id === selectedEventId);

  React.useEffect(() => {
    if (monthId !== "all" && !monthOptions.some((month) => month.id === monthId)) {
      setMonthId("all");
    }
  }, [monthId, monthOptions]);

  if (selectedEvent) {
    return <EventDetail event={selectedEvent} onBack={goToList} />;
  }

  return (
    <main className="app-shell">
      <AppHeader fetchedAt={events[0]?.fetchedAt} />
      <div className="filter-bar">
        <VenueFilter venues={venues} value={venueId} onChange={setVenueId} />
        <MonthFilter months={monthOptions} value={monthId} onChange={changeMonth} />
        <PastEventFilter checked={hidePastEvents} onChange={setHidePastEvents} />
      </div>

      {status === "loading" && <EmptyState title="Loading" body="Fetching generated event data." />}
      {status === "error" && (
        <EmptyState title="Could not load data" body="Check that the generated JSON files are available." />
      )}
      {status === "ready" && groupedEvents.length === 0 && (
        <EmptyState title="No events in range" body="Try another venue filter or update the generated data." />
      )}

      <EventList groupedEvents={groupedEvents} />
      <MonthPager months={monthOptions} value={monthId} onChange={changeMonth} />
    </main>
  );
}
