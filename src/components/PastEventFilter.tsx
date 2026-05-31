type PastEventFilterProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function PastEventFilter({ checked, onChange }: PastEventFilterProps) {
  return (
    <section className="controls checkbox-control" aria-label="past event filter">
      <label htmlFor="past-event-filter">過去</label>
      <label className="checkbox-label" htmlFor="past-event-filter">
        <input
          id="past-event-filter"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>過去を非表示</span>
      </label>
    </section>
  );
}
