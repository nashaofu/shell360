import { useCallback } from "react";

import type {
  SyncImportResult,
  SyncSnapshotPlain,
  SyncSnapshotValidation,
} from "tauri-plugin-data";

import {
  SyncRemoteApiError,
  type EncryptedSyncEnvelope,
  type RemoteSnapshotMeta,
  type SyncSnapshotRestoreRequest,
  type SyncSnapshotResponse,
  type SyncSnapshotUploadRequest,
} from "../utils/syncRemote";

export interface RemoteSyncPendingUploadConflict {
  latest: Partial<RemoteSnapshotMeta> & {
    snapshotVersion: string;
  };
  snapshot: SyncSnapshotPlain;
  envelope: EncryptedSyncEnvelope;
}

export interface RestoreRemoteSnapshotLabels {
  successResult: string;
  failurePrefix: string;
}

export interface UseRemoteSyncOperationsOptions {
  enabled?: boolean;
  isAuthenticated?: boolean;
  headSnapshotVersion?: string;
  exportAndValidateSnapshot: () => Promise<{
    snapshot: SyncSnapshotPlain;
    validation: SyncSnapshotValidation;
  }>;
  encryptSnapshot: (
    snapshot: SyncSnapshotPlain,
  ) => Promise<EncryptedSyncEnvelope>;
  decryptEnvelope: (
    envelope: EncryptedSyncEnvelope,
  ) => Promise<SyncSnapshotPlain>;
  importSnapshot: (snapshot: SyncSnapshotPlain) => Promise<SyncImportResult>;
  fetchSnapshot: (snapshotVersion: string) => Promise<SyncSnapshotResponse>;
  uploadSnapshot: (requestBody: SyncSnapshotUploadRequest) => Promise<unknown>;
  recordRestore: (requestBody: SyncSnapshotRestoreRequest) => Promise<unknown>;
  persistRemoteResult: ({
    result,
    snapshotVersion,
  }: {
    result: string;
    snapshotVersion?: string;
  }) => Promise<void>;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

function getConflictLatest(
  error: unknown,
): Partial<RemoteSnapshotMeta> | undefined {
  if (
    error instanceof SyncRemoteApiError &&
    error.code === "SYNC_REQUEST_CONFLICT" &&
    error.latest?.snapshotVersion
  ) {
    return error.latest;
  }

  return undefined;
}

function buildRemoteSnapshotMeta({
  snapshot,
  envelope,
  baseSnapshotVersion,
}: {
  snapshot: SyncSnapshotPlain;
  envelope: EncryptedSyncEnvelope;
  baseSnapshotVersion?: string;
}): RemoteSnapshotMeta {
  return {
    snapshotVersion: envelope.snapshotVersion,
    baseSnapshotVersion,
    schemaVersion: envelope.schemaVersion,
    createdAt: snapshot.createdAt,
    createdByDeviceId: snapshot.createdByDeviceId,
    cipherSuite: envelope.cipherSuite,
    payloadSize: envelope.ciphertext.length,
    payloadSha256: envelope.payloadSha256,
    recordCounts: {
      hostCount: snapshot.counts.hostCount,
      keyCount: snapshot.counts.keyCount,
      portForwardingCount: snapshot.counts.portForwardingCount,
    },
  };
}

export function useRemoteSyncOperations({
  enabled = true,
  isAuthenticated = true,
  headSnapshotVersion,
  exportAndValidateSnapshot,
  encryptSnapshot,
  decryptEnvelope,
  importSnapshot,
  fetchSnapshot,
  uploadSnapshot,
  recordRestore,
  persistRemoteResult,
}: UseRemoteSyncOperationsOptions) {
  const ensureReady = useCallback(() => {
    if (!enabled) {
      throw new Error("Please configure remote sync base URL first");
    }

    if (!isAuthenticated) {
      throw new Error("Please login to remote sync first");
    }
  }, [enabled, isAuthenticated]);

  const uploadPreparedSnapshot = useCallback(
    async ({
      snapshot,
      envelope,
      baseSnapshotVersion,
    }: {
      snapshot: SyncSnapshotPlain;
      envelope: EncryptedSyncEnvelope;
      baseSnapshotVersion?: string;
    }) => {
      await uploadSnapshot({
        requestId: crypto.randomUUID(),
        baseSnapshotVersion,
        meta: buildRemoteSnapshotMeta({
          snapshot,
          envelope,
          baseSnapshotVersion,
        }),
        envelope,
      });
    },
    [uploadSnapshot],
  );

  const uploadCurrentSnapshot = useCallback(async () => {
    ensureReady();

    const { snapshot, validation } = await exportAndValidateSnapshot();

    if (!validation.isValid || !validation.schemaCompatible) {
      return {
        status: "validationFailed" as const,
        snapshot,
        validation,
      };
    }

    const envelope = await encryptSnapshot(snapshot);

    try {
      await uploadPreparedSnapshot({
        snapshot,
        envelope,
        baseSnapshotVersion: headSnapshotVersion,
      });

      await persistRemoteResult({
        result: "Upload successful",
        snapshotVersion: envelope.snapshotVersion,
      });

      return {
        status: "success" as const,
        snapshot,
        envelope,
      };
    } catch (error) {
      const latest = getConflictLatest(error);

      if (latest?.snapshotVersion) {
        return {
          status: "conflict" as const,
          latest: {
            ...latest,
            snapshotVersion: latest.snapshotVersion,
          },
          snapshot,
          envelope,
        };
      }

      await persistRemoteResult({
        result: `Upload failed: ${getErrorMessage(error)}`,
        snapshotVersion: envelope.snapshotVersion,
      });

      throw error;
    }
  }, [
    encryptSnapshot,
    ensureReady,
    exportAndValidateSnapshot,
    headSnapshotVersion,
    persistRemoteResult,
    uploadPreparedSnapshot,
  ]);

  const restoreSnapshot = useCallback(
    async (snapshotVersion: string, labels: RestoreRemoteSnapshotLabels) => {
      ensureReady();

      try {
        const response = await fetchSnapshot(snapshotVersion);
        const snapshot = await decryptEnvelope(response.envelope);
        const result = await importSnapshot(snapshot);

        await recordRestore({
          requestId: crypto.randomUUID(),
          snapshotVersion,
          restoredAt: new Date().toISOString(),
        });

        await persistRemoteResult({
          result: labels.successResult,
          snapshotVersion,
        });

        return result;
      } catch (error) {
        await persistRemoteResult({
          result: `${labels.failurePrefix}: ${getErrorMessage(error)}`,
          snapshotVersion,
        });
        throw error;
      }
    },
    [
      decryptEnvelope,
      ensureReady,
      fetchSnapshot,
      importSnapshot,
      persistRemoteResult,
      recordRestore,
    ],
  );

  const overwriteRemoteSnapshot = useCallback(
    async (conflictUpload: RemoteSyncPendingUploadConflict) => {
      try {
        await uploadPreparedSnapshot({
          snapshot: conflictUpload.snapshot,
          envelope: conflictUpload.envelope,
          baseSnapshotVersion: conflictUpload.latest.snapshotVersion,
        });

        await persistRemoteResult({
          result: "Overwrite remote successful",
          snapshotVersion: conflictUpload.envelope.snapshotVersion,
        });

        return {
          status: "success" as const,
        };
      } catch (error) {
        const latest = getConflictLatest(error);

        if (latest?.snapshotVersion) {
          return {
            status: "conflict" as const,
            latest: {
              ...latest,
              snapshotVersion: latest.snapshotVersion,
            },
          };
        }

        await persistRemoteResult({
          result: `Overwrite remote failed: ${getErrorMessage(error)}`,
          snapshotVersion: conflictUpload.envelope.snapshotVersion,
        });

        throw error;
      }
    },
    [persistRemoteResult, uploadPreparedSnapshot],
  );

  return {
    ensureReady,
    uploadCurrentSnapshot,
    restoreSnapshot,
    overwriteRemoteSnapshot,
  };
}
