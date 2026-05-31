import type { TalkEvent } from "../types";
import { dateFormatter } from "../utils/date";
import { EventCard } from "./EventCard";

type DaySectionProps = {
  date: string;
  events: TalkEvent[];
};

export function DaySection({ date, events }: DaySectionProps) {
  return (
    <section className="day-section">
      <div className="date-rail">
        <time dateTime={date}>{dateFormatter.format(new Date(`${date}T00:00:00`))}</time>
        <span>{events.length}件</span>
      </div>
      <div className="event-list">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}
