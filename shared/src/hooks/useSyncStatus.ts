import { useMemoizedFn } from "ahooks";
import { useEffect } from "react";
import { checkSyncSession, onSyncSessionChange } from "tauri-plugin-data";

import { useSWR } from "./useSWR";

export function useSyncStatus() {
  const { data, loading, error, refresh } = useSWR(
    "checkSyncSession",
    checkSyncSession,
  );

  const refreshSyncStatus = useMemoizedFn(async () => refresh());

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    onSyncSessionChange(() => {
      if (!disposed) {
        void refreshSyncStatus();
      }
    }).then((unlisten) => {
      cleanup = unlisten;
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [refreshSyncStatus]);

  return {
    data,
    loading,
    error,
    refresh: refreshSyncStatus,
  };
}
