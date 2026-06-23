import { Check, Copy, Share2 } from "lucide-react";
import React from "react";

type FavoriteShareProps = {
  shareUrl: string;
  disabled: boolean;
};

export function FavoriteShare({ shareUrl, disabled }: FavoriteShareProps) {
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

  return (
    <section className="controls favorite-share" aria-label="favorite share">
      <label>Share</label>
      <div className="favorite-share-actions">
        <button type="button" disabled={disabled || !shareUrl} onClick={copyShareUrl}>
          {status === "copied" ? <Check size={16} /> : <Share2 size={16} />}
          {status === "copied" ? "Copied" : "Copy link"}
        </button>
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
