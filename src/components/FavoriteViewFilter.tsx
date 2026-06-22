type FavoriteView = "all" | "favorites";

type FavoriteViewFilterProps = {
  value: FavoriteView;
  favoriteCount: number;
  onChange: (value: FavoriteView) => void;
};

export function FavoriteViewFilter({ value, favoriteCount, onChange }: FavoriteViewFilterProps) {
  return (
    <section className="controls" aria-label="favorite view filter">
      <label>View</label>
      <div className="segmented-control">
        <button
          type="button"
          className={value === "all" ? "active" : undefined}
          aria-pressed={value === "all"}
          onClick={() => onChange("all")}
        >
          All
        </button>
        <button
          type="button"
          className={value === "favorites" ? "active" : undefined}
          aria-pressed={value === "favorites"}
          onClick={() => onChange("favorites")}
        >
          Favorites {favoriteCount}
        </button>
      </div>
    </section>
  );
}
