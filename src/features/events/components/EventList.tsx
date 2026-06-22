import type { TalkEvent } from "../types";
import { DaySection } from "./DaySection";

type EventListProps = {
  groupedEvents: [string, TalkEvent[]][];
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (event: TalkEvent) => void;
};

export function EventList({ groupedEvents, isFavorite, onToggleFavorite }: EventListProps) {
  return (
    <div className="day-list">
      {groupedEvents.map(([date, events]) => (
        <DaySection
          key={date}
          date={date}
          events={events}
          isFavorite={isFavorite}
          onToggleFavorite={onToggleFavorite}
        />
      ))}
    </div>
  );
}
