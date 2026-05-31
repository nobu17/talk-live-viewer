import type { MonthOption } from "../features/events/utils/months";

type MonthFilterProps = {
  months: MonthOption[];
  value: string;
  onChange: (monthId: string) => void;
};

export function MonthFilter({ months, value, onChange }: MonthFilterProps) {
  return (
    <section className="controls" aria-label="month filter">
      <label htmlFor="month-filter">月</label>
      <select id="month-filter" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">すべての月</option>
        {months.map((month) => (
          <option key={month.id} value={month.id}>
            {month.label}
          </option>
        ))}
      </select>
    </section>
  );
}
