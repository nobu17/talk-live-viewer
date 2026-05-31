import type { TalkEvent } from "../types";
import { daysAgoIso, todayIso } from "./date";

export const archiveLookbackDays = 14;

export function getVisibleEvents(events: TalkEvent[], venueId: string, monthId = "all", hidePastEvents = false) {
  const firstVisibleDate = hidePastEvents ? todayIso() : daysAgoIso(archiveLookbackDays);

  return events
    .filter((event) => event.date >= firstVisibleDate)
    .filter((event) => venueId === "all" || event.venueId === venueId)
    .filter((event) => monthId === "all" || event.date.startsWith(monthId))
    .sort((a, b) => `${a.date} ${a.startTime ?? ""}`.localeCompare(`${b.date} ${b.startTime ?? ""}`));
}
