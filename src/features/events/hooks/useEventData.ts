import React from "react";
import type { TalkEvent, Venue } from "../types";

export type DataStatus = "loading" | "ready" | "error";

export function useEventData() {
  const [events, setEvents] = React.useState<TalkEvent[]>([]);
  const [venues, setVenues] = React.useState<Venue[]>([]);
  const [status, setStatus] = React.useState<DataStatus>("loading");

  React.useEffect(() => {
    Promise.all([
      fetch("./data/events.json").then((response) => response.json()),
      fetch("./data/venues.json").then((response) => response.json()),
    ])
      .then(([eventData, venueData]) => {
        setEvents(Array.isArray(eventData) ? eventData : []);
        setVenues(Array.isArray(venueData) ? venueData : []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return { events, venues, status };
}
