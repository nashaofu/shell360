import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  RemoteSnapshotMeta,
  SyncSnapshotHistoryResponse,
} from "../utils/syncRemote";

export interface UseRemoteSyncHistoryOptions {
  enabled?: boolean;
  isAuthenticated?: boolean;
  pageSize?: number;
  listSnapshots: (
    page?: number,
    pageSize?: number,
  ) => Promise<SyncSnapshotHistoryResponse>;
}

const DEFAULT_PAGE_SIZE = 20;

export function useRemoteSyncHistory({
  enabled = true,
  isAuthenticated = true,
  pageSize = DEFAULT_PAGE_SIZE,
  listSnapshots,
}: UseRemoteSyncHistoryOptions) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [snapshots, setSnapshots] = useState<RemoteSnapshotMeta[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const reset = useCallback(() => {
    setLoading(false);
    setLoadingMore(false);
    setSnapshots([]);
    setPage(0);
    setTotal(0);
    setHasMore(false);
  }, []);

  const ensureReady = useCallback(() => {
    if (!enabled) {
      throw new Error("Please configure remote sync base URL first");
    }

    if (!isAuthenticated) {
      throw new Error("Please login to remote sync first");
    }
  }, [enabled, isAuthenticated]);

  const loadPage = useCallback(
    async ({
      nextPage,
      append = false,
    }: {
      nextPage: number;
      append?: boolean;
    }) => {
      ensureReady();

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const response = await listSnapshots(nextPage, pageSize);
        const resolvedPage = response.page ?? nextPage;
        const resolvedTotal = response.total ?? response.items.length;
        const resolvedHasMore =
          response.hasMore ?? resolvedPage * pageSize < resolvedTotal;

        setPage(resolvedPage);
        setTotal(resolvedTotal);
        setHasMore(resolvedHasMore);
        setSnapshots((current) => {
          if (!append) {
            return response.items;
          }

          const merged = new Map(
            current.map((snapshot) => [snapshot.snapshotVersion, snapshot]),
          );

          response.items.forEach((snapshot) => {
            merged.set(snapshot.snapshotVersion, snapshot);
          });

          return Array.from(merged.values());
        });

        return response;
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [ensureReady, listSnapshots, pageSize],
  );

  const refresh = useCallback(async () => {
    return loadPage({ nextPage: 1 });
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    const nextPage = page + 1;

    if (nextPage <= 1) {
      return loadPage({ nextPage: 1 });
    }

    return loadPage({
      nextPage,
      append: true,
    });
  }, [loadPage, page]);

  const canLoadMore = useMemo(() => {
    if (loading || loadingMore) {
      return false;
    }

    if (hasMore) {
      return true;
    }

    if (total <= 0) {
      return false;
    }

    return snapshots.length < total;
  }, [hasMore, loading, loadingMore, snapshots.length, total]);

  useEffect(() => {
    if (!enabled || !isAuthenticated) {
      reset();
    }
  }, [enabled, isAuthenticated, reset]);

  return {
    loading,
    loadingMore,
    snapshots,
    page,
    total,
    hasMore,
    canLoadMore,
    refresh,
    loadMore,
    reset,
  };
}
