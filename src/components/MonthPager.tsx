import type { MonthOption } from "../features/events/utils/months";

type MonthPagerProps = {
  months: MonthOption[];
  value: string;
  onChange: (monthId: string) => void;
};

export function MonthPager({ months, value, onChange }: MonthPagerProps) {
  const currentIndex = months.findIndex((month) => month.id === value);
  if (value === "all" || currentIndex === -1) {
    return null;
  }

  const previousMonth = months[currentIndex - 1];
  const nextMonth = months[currentIndex + 1];
  const currentMonth = months[currentIndex];

  return (
    <nav className="month-pager" aria-label="month navigation">
      <button type="button" onClick={() => previousMonth && onChange(previousMonth.id)} disabled={!previousMonth}>
        前の月
      </button>
      <span>{currentMonth.label}</span>
      <button type="button" onClick={() => nextMonth && onChange(nextMonth.id)} disabled={!nextMonth}>
        次の月
      </button>
    </nav>
  );
}
