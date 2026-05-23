import { atom, useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import {
  type SyncAuthState,
  type SyncConfig,
  type SyncDevice,
  type SyncStatus,
  type SyncUserInfo,
  getSyncAuthState,
  getSyncConfig,
  getSyncDevices,
  getSyncStatus,
  getSyncUserInfo,
  logoutSync,
  setSyncConfig,
  startDeviceAuth,
  triggerSyncPull,
  triggerSyncPush,
} from "tauri-plugin-data";

// ── Atoms ─────────────────────────────────────────────────────────────────────

export const syncConfigAtom = atom<SyncConfig>({ serverUrl: null });

syncConfigAtom.onMount = (set) => {
  getSyncConfig().then(set).catch(() => {});
};

export const syncAuthStateAtom = atom<SyncAuthState | null>(null);

syncAuthStateAtom.onMount = (set) => {
  getSyncAuthState().then(set).catch(() => {});
};

export const syncStatusAtom = atom<SyncStatus | null>(null);

syncStatusAtom.onMount = (set) => {
  getSyncStatus().then(set).catch(() => {});
};

export const syncUserInfoAtom = atom<SyncUserInfo | null>(null);
export const syncDevicesAtom = atom<SyncDevice[]>([]);

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useSyncConfig() {
  const [config, setConfig] = useAtom(syncConfigAtom);

  const update = useCallback(
    async (newConfig: SyncConfig) => {
      await setSyncConfig(newConfig);
      setConfig(newConfig);
    },
    [setConfig],
  );

  return { config, update };
}

export function useSyncStatus() {
  const [status, setStatus] = useAtom(syncStatusAtom);

  const refresh = useCallback(async () => {
    const s = await getSyncStatus();
    setStatus(s);
    return s;
  }, [setStatus]);

  return { status, refresh };
}

export function useSyncActions() {
  const setAuthState = useSetAtom(syncAuthStateAtom);
  const setStatus = useSetAtom(syncStatusAtom);
  const setUserInfo = useSetAtom(syncUserInfoAtom);
  const setDevices = useSetAtom(syncDevicesAtom);

  const refreshAll = useCallback(async () => {
    const [authState, status] = await Promise.all([
      getSyncAuthState(),
      getSyncStatus(),
    ]);
    setAuthState(authState);
    setStatus(status);

    if (authState.isLoggedIn) {
      const [userInfo, devices] = await Promise.all([
        getSyncUserInfo().catch(() => null),
        getSyncDevices().catch(() => []),
      ]);
      setUserInfo(userInfo);
      setDevices(devices);
    }
  }, [setAuthState, setStatus, setUserInfo, setDevices]);

  const startAuth = useCallback(async () => {
    const session = await startDeviceAuth();
    return session;
  }, []);

  const logout = useCallback(async () => {
    await logoutSync();
    setAuthState(null);
    setUserInfo(null);
    setDevices([]);
  }, [setAuthState, setUserInfo, setDevices]);

  const push = useCallback(async () => {
    const result = await triggerSyncPush();
    const status = await getSyncStatus();
    setStatus(status);
    return result;
  }, [setStatus]);

  const pull = useCallback(async () => {
    const result = await triggerSyncPull();
    const status = await getSyncStatus();
    setStatus(status);
    return result;
  }, [setStatus]);

  return { refreshAll, startAuth, logout, push, pull };
}
