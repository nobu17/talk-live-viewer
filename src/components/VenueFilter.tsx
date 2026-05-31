import type { Venue } from "../features/events/types";

type VenueFilterProps = {
  venues: Venue[];
  value: string;
  onChange: (venueId: string) => void;
};

export function VenueFilter({ venues, value, onChange }: VenueFilterProps) {
  return (
    <section className="controls" aria-label="venue filter">
      <label htmlFor="venue-filter">会場</label>
      <select id="venue-filter" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">すべての会場</option>
        {venues.map((venue) => (
          <option key={venue.id} value={venue.id}>
            {venue.name}
          </option>
        ))}
      </select>
    </section>
  );
}
