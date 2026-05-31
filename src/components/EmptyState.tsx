import { MapPin } from "lucide-react";

type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <MapPin size={28} />
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}
