import { ExternalLink, Star, Ticket } from "lucide-react";
import { RemoteImage } from "../../../components/RemoteImage";
import type { TalkEvent } from "../types";
import { dateFormatter } from "../utils/date";

type EventDetailProps = {
  event: TalkEvent;
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: (event: TalkEvent) => void;
};

export function EventDetail({ event, onBack, isFavorite, onToggleFavorite }: EventDetailProps) {
  return (
    <main className="detail-shell">
      <button className="back-button" type="button" onClick={onBack}>
        一覧へ戻る
      </button>
      <article className="detail-layout">
        <RemoteImage className="detail-image" src={event.imageUrl} alt="" />
        <div className="detail-content">
          <div className="detail-heading-row">
            <p className="eyebrow">{event.venueName}</p>
            <button
              className="favorite-button detail-favorite-button"
              type="button"
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={isFavorite}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => onToggleFavorite(event)}
            >
              <Star size={20} fill={isFavorite ? "currentColor" : "none"} />
            </button>
          </div>
          <h1>{event.title}</h1>
          <div className="detail-meta">
            <span>{dateFormatter.format(new Date(`${event.date}T00:00:00`))}</span>
            {event.openTime && <span>OPEN {event.openTime}</span>}
            {event.startTime && <span>START {event.startTime}</span>}
          </div>
          {event.performers.length > 0 && (
            <section>
              <h2>出演</h2>
              <p>{event.performers.join(" / ")}</p>
            </section>
          )}
          {event.priceText && (
            <section>
              <h2>料金</h2>
              <p className="preserve">{event.priceText}</p>
            </section>
          )}
          {event.description && (
            <section>
              <h2>詳細</h2>
              <p className="preserve">{event.description}</p>
            </section>
          )}
          <div className="link-list">
            {event.ticketLinks.map((ticket) => (
              <a key={ticket.url} href={ticket.url} target="_blank" rel="noreferrer">
                <Ticket size={16} />
                {ticket.label}
              </a>
            ))}
            <a href={event.detailUrl ?? event.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              公式ページ
            </a>
          </div>
        </div>
      </article>
    </main>
  );
}
