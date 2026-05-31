import type { TalkEvent } from "../types";
import { DaySection } from "./DaySection";

type EventListProps = {
  groupedEvents: [string, TalkEvent[]][];
};

export function EventList({ groupedEvents }: EventListProps) {
  return (
    <div className="day-list">
      {groupedEvents.map(([date, events]) => (
        <DaySection key={date} date={date} events={events} />
      ))}
    </div>
  );
}
