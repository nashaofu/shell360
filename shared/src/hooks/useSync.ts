import { useMemoizedFn } from "ahooks";
import {
  checkSyncSession,
  clearSyncSession,
  decryptSyncSnapshot,
  type EncryptedSyncEnvelope,
  type ExportSyncSnapshotOpts,
  encryptSyncSnapshot,
  exportSyncSnapshot,
  type ImportSyncSnapshotOpts,
  type InitSyncSecretOpts,
  importSyncSnapshot,
  initSyncSecret,
  type RotateSyncSecretOpts,
  rotateSyncSecret,
  SyncImportMode,
  type SyncSnapshotPlain,
  type UnlockSyncSecretOpts,
  unlockSyncSecret,
  validateSyncSnapshot,
} from "tauri-plugin-data";

import { useHosts } from "./useHosts";
import { useKeys } from "./useKeys";
import { usePortForwardings } from "./usePortForwardings";
import { useSyncStatus } from "./useSyncStatus";

const DEFAULT_EXPORT_SYNC_SNAPSHOT_OPTS: ExportSyncSnapshotOpts = {
  schemaVersion: "1.0",
  includeHosts: true,
  includeKeys: true,
  includePortForwardings: true,
};

export function useSync() {
  const syncStatus = useSyncStatus();
  const { refresh: refreshHosts } = useHosts();
  const { refresh: refreshKeys } = useKeys();
  const { refresh: refreshPortForwardings } = usePortForwardings();

  const refreshAll = useMemoizedFn(async () => {
    await Promise.all([
      syncStatus.refresh(),
      refreshHosts(),
      refreshKeys(),
      refreshPortForwardings(),
    ]);
  });

  const exportSnapshot = useMemoizedFn(
    async (opts: Partial<ExportSyncSnapshotOpts> = {}) => {
      return exportSyncSnapshot({
        ...DEFAULT_EXPORT_SYNC_SNAPSHOT_OPTS,
        ...opts,
      });
    },
  );

  const validateSnapshot = useMemoizedFn(
    async (snapshot: SyncSnapshotPlain) => {
      return validateSyncSnapshot(snapshot);
    },
  );

  const importSnapshot = useMemoizedFn(
    async (
      snapshot: SyncSnapshotPlain,
      mode: SyncImportMode = SyncImportMode.ReplaceLocal,
    ) => {
      const result = await importSyncSnapshot({
        snapshot,
        mode,
      } satisfies ImportSyncSnapshotOpts);
      await refreshAll();
      return result;
    },
  );

  const encryptSnapshot = useMemoizedFn(
    async (snapshot: SyncSnapshotPlain): Promise<EncryptedSyncEnvelope> => {
      return encryptSyncSnapshot(snapshot);
    },
  );

  const decryptEnvelope = useMemoizedFn(
    async (envelope: EncryptedSyncEnvelope): Promise<SyncSnapshotPlain> => {
      return decryptSyncSnapshot(envelope);
    },
  );

  const exportAndValidateSnapshot = useMemoizedFn(async () => {
    const snapshot = await exportSnapshot();
    const validation = await validateSnapshot(snapshot);

    return {
      snapshot,
      validation,
    };
  });

  const exportEncryptedSnapshot = useMemoizedFn(
    async (opts: Partial<ExportSyncSnapshotOpts> = {}) => {
      const snapshot = await exportSnapshot(opts);
      return encryptSnapshot(snapshot);
    },
  );

  const refreshSession = useMemoizedFn(async () => {
    return checkSyncSession();
  });

  const initSecret = useMemoizedFn(async (opts: InitSyncSecretOpts) => {
    const result = await initSyncSecret(opts);
    await syncStatus.refresh();
    return result;
  });

  const unlockSecret = useMemoizedFn(async (opts: UnlockSyncSecretOpts) => {
    const result = await unlockSyncSecret(opts);
    await syncStatus.refresh();
    return result;
  });

  const rotateSecret = useMemoizedFn(async (opts: RotateSyncSecretOpts) => {
    const result = await rotateSyncSecret(opts);
    await syncStatus.refresh();
    return result;
  });

  const clearSession = useMemoizedFn(async () => {
    const result = await clearSyncSession();
    await syncStatus.refresh();
    return result;
  });

  return {
    sessionState: syncStatus.data,
    sessionLoading: syncStatus.loading,
    sessionError: syncStatus.error,
    refreshSession,
    refreshAll,
    exportSnapshot,
    validateSnapshot,
    exportAndValidateSnapshot,
    exportEncryptedSnapshot,
    importSnapshot,
    encryptSnapshot,
    decryptEnvelope,
    initSecret,
    unlockSecret,
    rotateSecret,
    clearSession,
  };
}
