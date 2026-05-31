import React from "react";

export function useHashRoute() {
  const [selectedEventId, setSelectedEventId] = React.useState<string | undefined>(getEventIdFromHash);

  React.useEffect(() => {
    const onHashChange = () => setSelectedEventId(getEventIdFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const goToList = React.useCallback(() => {
    window.location.hash = "/";
  }, []);

  return { selectedEventId, goToList };
}

function getEventIdFromHash() {
  const hash = window.location.hash.replace(/^#/, "");
  const match = hash.match(/^\/events\/(.+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}
