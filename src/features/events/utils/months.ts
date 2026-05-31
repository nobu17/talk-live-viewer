import type { TalkEvent } from "../types";

export type MonthOption = {
  id: string;
  label: string;
};

const monthFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
});

export function getAvailableMonths(events: TalkEvent[]): MonthOption[] {
  const monthIds = [...new Set(events.map((event) => event.date.slice(0, 7)))].sort();

  return monthIds.map((id) => ({
    id,
    label: monthFormatter.format(new Date(`${id}-01T00:00:00`)),
  }));
}
