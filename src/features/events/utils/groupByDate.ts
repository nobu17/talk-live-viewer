import type { TalkEvent } from "../types";

export function groupByDate(events: TalkEvent[]) {
  const groups = new Map<string, TalkEvent[]>();

  for (const event of events) {
    groups.set(event.date, [...(groups.get(event.date) ?? []), event]);
  }

  return [...groups.entries()];
}
