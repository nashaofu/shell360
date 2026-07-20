import { useSyncExternalStore } from "react";

function subscribe(query: string) {
  return (onStoreChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onStoreChange);
    return () => mql.removeEventListener("change", onStoreChange);
  };
}

function getSnapshot(query: string) {
  return () => window.matchMedia(query).matches;
}

export default function useMediaQuery(query: string) {
  return useSyncExternalStore(
    subscribe(query),
    getSnapshot(query),
    () => false,
  );
}
