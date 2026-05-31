import { CalendarDays } from "lucide-react";
import { formatDateTime } from "../features/events/utils/date";

type AppHeaderProps = {
  fetchedAt?: string;
};

export function AppHeader({ fetchedAt }: AppHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">トークライブの予定ビューア</p>
        <h1>Talk Live Viewer</h1>
      </div>
      <div className="freshness">
        <CalendarDays size={18} />
        <span>{fetchedAt ? `更新: ${formatDateTime(fetchedAt)}` : "静的データ待機中"}</span>
      </div>
    </header>
  );
}
