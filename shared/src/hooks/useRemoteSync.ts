import { useMemoizedFn } from "ahooks";
import {
  createSyncRemoteClient,
  type SyncApiConfig,
  type SyncLoginRequest,
  type SyncRefreshRequest,
  type SyncRegisterDeviceRequest,
  type SyncSnapshotRestoreRequest,
  type SyncSnapshotUploadRequest,
} from "../utils/syncRemote";
import { useSWR } from "./useSWR";

export interface UseRemoteSyncOptions extends SyncApiConfig {
  enabled?: boolean;
  swrKeyPrefix?: string;
}

export function useRemoteSync(options: UseRemoteSyncOptions) {
  const { enabled = true, swrKeyPrefix = "syncRemote", ...config } = options;
  const client = createSyncRemoteClient(config);
  const isEnabled = enabled && Boolean(config.baseUrl);

  const headState = useSWR(
    `${swrKeyPrefix}:head:${config.baseUrl || "disabled"}`,
    async () => {
      if (!isEnabled) {
        return undefined;
      }

      const response = await client.getSnapshotHead();
      return response.head;
    },
  );

  const refreshHead = useMemoizedFn(async () => {
    return headState.refresh();
  });

  const login = useMemoizedFn(async (requestBody: SyncLoginRequest) => {
    return client.login(requestBody);
  });

  const refreshAuth = useMemoizedFn(async (requestBody: SyncRefreshRequest) => {
    return client.refresh(requestBody);
  });

  const registerDevice = useMemoizedFn(
    async (requestBody: SyncRegisterDeviceRequest) => {
      return client.registerDevice(requestBody);
    },
  );

  const fetchSnapshot = useMemoizedFn(async (snapshotVersion: string) => {
    return client.getSnapshot(snapshotVersion);
  });

  const listSnapshots = useMemoizedFn(async (page = 1, pageSize = 20) => {
    return client.listSnapshots(page, pageSize);
  });

  const uploadSnapshot = useMemoizedFn(
    async (requestBody: SyncSnapshotUploadRequest) => {
      const response = await client.uploadSnapshot(requestBody);
      await refreshHead();
      return response;
    },
  );

  const recordRestore = useMemoizedFn(
    async (requestBody: SyncSnapshotRestoreRequest) => {
      const response = await client.recordRestore(requestBody);
      await refreshHead();
      return response;
    },
  );

  return {
    enabled: isEnabled,
    head: headState.data,
    headLoading: headState.loading,
    headError: headState.error,
    refreshHead,
    login,
    refreshAuth,
    registerDevice,
    fetchSnapshot,
    listSnapshots,
    uploadSnapshot,
    recordRestore,
    client,
  };
}
