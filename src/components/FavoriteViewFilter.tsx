type FavoriteView = "all" | "favorites";

type FavoriteViewFilterProps = {
  value: FavoriteView;
  favoriteCount: number;
  onChange: (value: FavoriteView) => void;
};

export function FavoriteViewFilter({ value, favoriteCount, onChange }: FavoriteViewFilterProps) {
  return (
    <section className="controls" aria-label="favorite view filter">
      <label>表示</label>
      <div className="segmented-control">
        <button
          type="button"
          className={value === "all" ? "active" : undefined}
          aria-pressed={value === "all"}
          onClick={() => onChange("all")}
        >
          すべて
        </button>
        <button
          type="button"
          className={value === "favorites" ? "active" : undefined}
          aria-pressed={value === "favorites"}
          onClick={() => onChange("favorites")}
        >
          お気に入り {favoriteCount}
        </button>
      </div>
    </section>
  );
}
