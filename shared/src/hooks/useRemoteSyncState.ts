import { useCallback, useEffect, useRef, useState } from "react";

import type { SyncRefreshResponse } from "../utils/syncRemote";

export interface RemoteSyncStoredState {
  baseUrl: string;
  accountId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  lastRemoteResult: string;
  lastRemoteSnapshotVersion: string;
  lastRemoteResultAt: string;
}

export interface RemoteSyncStateStorage {
  load: () => Promise<Partial<RemoteSyncStoredState>>;
  write: (values: Partial<RemoteSyncStoredState>) => Promise<void>;
  remove: (keys: Array<keyof RemoteSyncStoredState>) => Promise<void>;
}

const DEFAULT_REMOTE_SYNC_STATE: RemoteSyncStoredState = {
  baseUrl: "",
  accountId: "",
  accessToken: "",
  refreshToken: "",
  expiresAt: "",
  lastRemoteResult: "",
  lastRemoteSnapshotVersion: "",
  lastRemoteResultAt: "",
};

export function useRemoteSyncState(storage: RemoteSyncStateStorage) {
  const [state, setState] = useState<RemoteSyncStoredState>(
    DEFAULT_REMOTE_SYNC_STATE,
  );
  const stateRef = useRef(state);
  const storageRef = useRef(storage);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    storageRef.current = storage;
  }, [storage]);

  const refreshState = useCallback(async () => {
    const loaded = await storageRef.current.load();
    const nextState = {
      ...DEFAULT_REMOTE_SYNC_STATE,
      ...loaded,
    };
    setState(nextState);
    return nextState;
  }, []);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const updateState = useCallback(
    async (values: Partial<RemoteSyncStoredState>) => {
      await storageRef.current.write(values);
      setState((current) => ({
        ...current,
        ...values,
      }));
    },
    [],
  );

  const saveBaseUrl = useCallback(
    async (baseUrl: string) => {
      await updateState({ baseUrl });
    },
    [updateState],
  );

  const persistAuth = useCallback(
    async (response: SyncRefreshResponse & { accountId?: string }) => {
      const nextAccountId = response.accountId ?? stateRef.current.accountId;

      await updateState({
        accountId: nextAccountId,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken ?? stateRef.current.refreshToken,
        expiresAt: response.expiresAt,
      });
    },
    [updateState],
  );

  const persistRemoteResult = useCallback(
    async ({
      result,
      snapshotVersion,
    }: {
      result: string;
      snapshotVersion?: string;
    }) => {
      await updateState({
        lastRemoteResult: result,
        lastRemoteSnapshotVersion: snapshotVersion ?? "",
        lastRemoteResultAt: new Date().toISOString(),
      });
    },
    [updateState],
  );

  const clearAuthState = useCallback(async () => {
    const keys: Array<keyof RemoteSyncStoredState> = [
      "accountId",
      "accessToken",
      "refreshToken",
      "expiresAt",
      "lastRemoteResult",
      "lastRemoteSnapshotVersion",
      "lastRemoteResultAt",
    ];

    await storageRef.current.remove(keys);
    setState((current) => ({
      ...current,
      accountId: "",
      accessToken: "",
      refreshToken: "",
      expiresAt: "",
      lastRemoteResult: "",
      lastRemoteSnapshotVersion: "",
      lastRemoteResultAt: "",
    }));
  }, []);

  return {
    state,
    stateRef,
    refreshState,
    updateState,
    saveBaseUrl,
    persistAuth,
    persistRemoteResult,
    clearAuthState,
  };
}
