export type Venue = {
  id: string;
  name: string;
  scheduleUrl: string;
  accessUrl?: string;
  provider?: "loft" | "lateral" | "bookandbeer" | "dommune" | "pundit";
};

export type TicketLink = {
  label: string;
  url: string;
};

export type TalkEvent = {
  id: string;
  venueId: string;
  venueName: string;
  sourceUrl: string;
  detailUrl?: string;
  title: string;
  date: string;
  weekday?: string;
  openTime?: string;
  startTime?: string;
  isStreaming?: boolean;
  performers: string[];
  ticketLinks: TicketLink[];
  priceText?: string;
  description?: string;
  imageUrl?: string;
  fetchedAt: string;
};
