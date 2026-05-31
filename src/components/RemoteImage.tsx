import React from "react";

type RemoteImageProps = {
  src?: string;
  alt?: string;
  className?: string;
};

export function RemoteImage({ src, alt = "", className }: RemoteImageProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed || !isAllowedImageUrl(src)) {
    return null;
  }

  return <img className={className} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function isAllowedImageUrl(src: string) {
  try {
    const url = new URL(src);
    return (
      url.hostname.endsWith("loft-prj.co.jp") ||
      url.hostname.endsWith("lateral-osaka.com") ||
      url.hostname.endsWith("bookandbeer.com") ||
      url.hostname.endsWith("dommune.com") ||
      url.hostname.endsWith("pundit.jp")
    );
  } catch {
    return false;
  }
}
