import { Check, Copy, Share2, Trash2 } from "lucide-react";
import React from "react";

type FavoriteShareProps = {
  shareUrl: string;
  disabled: boolean;
  favoriteCount: number;
  onClear: () => void;
};

export function FavoriteShare({ shareUrl, disabled, favoriteCount, onClear }: FavoriteShareProps) {
  const [status, setStatus] = React.useState<"idle" | "copied" | "manual">("idle");

  const copyShareUrl = React.useCallback(async () => {
    if (!shareUrl || disabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("manual");
    }
  }, [disabled, shareUrl]);

  const clearFavorites = React.useCallback(() => {
    if (disabled) {
      return;
    }
    const confirmed = window.confirm(`お気に入り${favoriteCount}件をすべて削除しますか？この操作は元に戻せません。`);
    if (confirmed) {
      onClear();
      setStatus("idle");
    }
  }, [disabled, favoriteCount, onClear]);

  return (
    <section className="controls favorite-share" aria-label="お気に入りの共有">
      <label>共有</label>
      <div className="favorite-share-actions">
        <div className="favorite-share-buttons">
          <button type="button" disabled={disabled || !shareUrl} onClick={copyShareUrl}>
            {status === "copied" ? <Check size={16} /> : <Share2 size={16} />}
            {status === "copied" ? "コピー済み" : "リンクをコピー"}
          </button>
          <button className="danger-button" type="button" disabled={disabled} onClick={clearFavorites}>
            <Trash2 size={16} />
            クリア
          </button>
        </div>
        {status === "manual" && (
          <label className="share-url-field">
            <Copy size={16} />
            <input value={shareUrl} readOnly onFocus={(event) => event.target.select()} />
          </label>
        )}
      </div>
    </section>
  );
}
