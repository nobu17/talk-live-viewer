import { Radio, Star } from "lucide-react";
import React from "react";
import { RemoteImage } from "../../../components/RemoteImage";
import type { TalkEvent } from "../types";
import { getEventSummary, shouldCollapseSummary } from "../utils/summary";

type EventCardProps = {
  event: TalkEvent;
  isFavorite: boolean;
  onToggleFavorite: (event: TalkEvent) => void;
};

export function EventCard({ event, isFavorite, onToggleFavorite }: EventCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const people = event.performers.slice(0, 4).join(" / ");
  const summary = getEventSummary(event);
  const hasExpandableSummary = shouldCollapseSummary(summary);
  const officialUrl = event.detailUrl ?? event.sourceUrl;
  const streamingLabel = event.isStreaming === true ? "配信あり" : event.isStreaming === false ? "配信なし" : "配信不明";
  const streamingClassName =
    event.isStreaming === true ? "badge live" : event.isStreaming === false ? "badge muted" : "badge unknown";

  return (
    <article className="event-card">
      <a className="thumb-link" href={officialUrl} target="_blank" rel="noreferrer" aria-label={`${event.title} 公式ページ`}>
        {event.imageUrl ? <RemoteImage className="thumb" src={event.imageUrl} alt="" /> : <NoImageThumb />}
      </a>
      <div className="event-body">
        <div className="meta-row">
          <span>{event.venueName}</span>
          <span className={streamingClassName}>
            <Radio size={14} />
            {streamingLabel}
          </span>
          <button
            className="favorite-button"
            type="button"
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-pressed={isFavorite}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => onToggleFavorite(event)}
          >
            <Star size={17} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        </div>
        <h2>
          <a href={officialUrl} target="_blank" rel="noreferrer">
            {event.title}
          </a>
        </h2>
        {summary && <p className={expanded ? "event-summary expanded" : "event-summary"}>{summary}</p>}
        {hasExpandableSummary && (
          <button className="summary-toggle" type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? "閉じる" : "もっと見る"}
          </button>
        )}
        {people && <p className="performers">{people}</p>}
      </div>
    </article>
  );
}

function NoImageThumb() {
  return (
    <div className="thumb no-image-thumb" aria-hidden="true">
      <span>No Image</span>
    </div>
  );
}
