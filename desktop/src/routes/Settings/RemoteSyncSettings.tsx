import {
  Box,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { getVersion } from "@tauri-apps/api/app";
import { LazyStore } from "@tauri-apps/plugin-store";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type RemoteSnapshotMeta,
  useRemoteSyncHistory,
  type RemoteSyncPendingUploadConflict,
  useRemoteSyncOperations,
  useRemoteSync,
  useRemoteSyncState,
  useSync,
} from "shared";

import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";

import RemoteSyncConfig from "./RemoteSyncConfig";
import RemoteSyncConflictDialog from "./RemoteSyncConflictDialog";
import RemoteSyncHistory from "./RemoteSyncHistory";
import RemoteSyncLogin from "./RemoteSyncLogin";

const store = new LazyStore("config.json");

function getRemoteSyncStoreKey(key: string) {
  return `sync_remote_${
    key === "baseUrl"
      ? "base_url"
      : key === "accountId"
        ? "account_id"
        : key === "accessToken"
          ? "access_token"
          : key === "refreshToken"
            ? "refresh_token"
            : key === "lastRemoteResult"
              ? "last_result"
              : key === "lastRemoteSnapshotVersion"
                ? "last_snapshot_version"
                : key === "lastRemoteResultAt"
                  ? "last_result_at"
                  : "expires_at"
  }`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

function formatSnapshotSummaryLines(snapshot?: Partial<RemoteSnapshotMeta>) {
  if (!snapshot?.snapshotVersion) {
    return ["Remote snapshot information is unavailable."];
  }

  return [
    `Remote Version: ${snapshot.snapshotVersion}`,
    `Created At: ${snapshot.createdAt ? dayjs(snapshot.createdAt).format("YYYY-MM-DD HH:mm:ss") : "N/A"}`,
    `Created By Device: ${snapshot.createdByDeviceId ?? "N/A"}`,
    `Hosts: ${snapshot.recordCounts?.hostCount ?? "N/A"}`,
    `Keys: ${snapshot.recordCounts?.keyCount ?? "N/A"}`,
    `Port Forwardings: ${snapshot.recordCounts?.portForwardingCount ?? "N/A"}`,
  ];
}

export default function RemoteSyncSettings() {
  const message = useMessage();
  const modal = useModal();
  const {
    sessionState,
    exportAndValidateSnapshot,
    encryptSnapshot,
    decryptEnvelope,
    importSnapshot,
  } = useSync();
  const [version, setVersion] = useState("0.0.0");
  const [configOpen, setConfigOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [restoringSnapshotVersion, setRestoringSnapshotVersion] = useState<
    string | undefined
  >();
  const [conflictUpload, setConflictUpload] =
    useState<RemoteSyncPendingUploadConflict>();
  const [conflictLoading, setConflictLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const remoteSyncStateStorage = useMemo(
    () => ({
      load: async () => {
        const [
          baseUrl,
          accountId,
          accessToken,
          refreshToken,
          expiresAt,
          lastRemoteResult,
          lastRemoteSnapshotVersion,
          lastRemoteResultAt,
        ] = await Promise.all([
          store.get<string>("sync_remote_base_url"),
          store.get<string>("sync_remote_account_id"),
          store.get<string>("sync_remote_access_token"),
          store.get<string>("sync_remote_refresh_token"),
          store.get<string>("sync_remote_expires_at"),
          store.get<string>("sync_remote_last_result"),
          store.get<string>("sync_remote_last_snapshot_version"),
          store.get<string>("sync_remote_last_result_at"),
        ]);

        return {
          baseUrl: baseUrl || "",
          accountId: accountId || "",
          accessToken: accessToken || "",
          refreshToken: refreshToken || "",
          expiresAt: expiresAt || "",
          lastRemoteResult: lastRemoteResult || "",
          lastRemoteSnapshotVersion: lastRemoteSnapshotVersion || "",
          lastRemoteResultAt: lastRemoteResultAt || "",
        };
      },
      write: async (values: Record<string, unknown>) => {
        await Promise.all(
          Object.entries(values).map(([key, value]) =>
            store.set(getRemoteSyncStoreKey(key), String(value ?? "")),
          ),
        );
      },
      remove: async (keys: string[]) => {
        await Promise.all(
          keys.map((key) => store.delete(getRemoteSyncStoreKey(key))),
        );
      },
    }),
    [],
  );
  const {
    state: config,
    stateRef: configRef,
    refreshState: refreshConfig,
    saveBaseUrl,
    persistAuth,
    persistRemoteResult,
    clearAuthState,
  } = useRemoteSyncState(remoteSyncStateStorage);

  const remoteSync = useRemoteSync({
    baseUrl: config.baseUrl,
    enabled: Boolean(config.baseUrl),
    getAccessToken: () => config.accessToken || undefined,
    getRefreshToken: () => configRef.current.refreshToken || undefined,
    getDeviceId: () => sessionState?.deviceId,
    onAuthRefresh: async (response) => {
      await persistAuth(response);
    },
    onAuthExpired: async () => {
      await clearAuthState();
    },
  });
  const remoteHistory = useRemoteSyncHistory({
    enabled: Boolean(config.baseUrl),
    isAuthenticated: Boolean(config.accessToken),
    listSnapshots: remoteSync.listSnapshots,
  });
  const remoteOperations = useRemoteSyncOperations({
    enabled: Boolean(config.baseUrl),
    isAuthenticated: Boolean(config.accessToken),
    headSnapshotVersion: remoteSync.head?.snapshotVersion,
    exportAndValidateSnapshot,
    encryptSnapshot,
    decryptEnvelope,
    importSnapshot,
    fetchSnapshot: remoteSync.fetchSnapshot,
    uploadSnapshot: remoteSync.uploadSnapshot,
    recordRestore: remoteSync.recordRestore,
    persistRemoteResult,
  });

  useEffect(() => {
    getVersion().then((appVersion) => {
      setVersion(appVersion);
    });
  }, []);

  const authState = useMemo(() => {
    if (!config.accessToken) {
      return "No token";
    }

    if (!config.expiresAt) {
      return "Configured";
    }

    return `Expires at ${dayjs(config.expiresAt).format("YYYY-MM-DD HH:mm:ss")}`;
  }, [config.accessToken, config.expiresAt]);

  const remoteHeadCreatedAt = remoteSync.head?.createdAt
    ? dayjs(remoteSync.head.createdAt).format("YYYY-MM-DD HH:mm:ss")
    : "N/A";
  const lastRemoteResultAt = config.lastRemoteResultAt
    ? dayjs(config.lastRemoteResultAt).format("YYYY-MM-DD HH:mm:ss")
    : "N/A";

  const onSaveConfig = useCallback(
    async (baseUrl: string) => {
      await saveBaseUrl(baseUrl);
      await refreshConfig();
      setConfigOpen(false);
    },
    [refreshConfig, saveBaseUrl],
  );

  const onLogin = useCallback(
    async ({
      loginId,
      credential,
    }: {
      loginId: string;
      credential: string;
    }) => {
      if (!config.baseUrl) {
        throw new Error("Please configure remote sync base URL first");
      }

      const response = await remoteSync.login({
        loginId,
        credential,
        deviceName: `Shell360 ${import.meta.env.TAURI_ENV_PLATFORM}`,
        platform: import.meta.env.TAURI_ENV_PLATFORM,
        appVersion: version,
      });

      await persistAuth(response);

      await refreshConfig();
      setLoginOpen(false);
      await remoteSync.refreshHead();
    },
    [config.baseUrl, persistAuth, refreshConfig, remoteSync, version],
  );

  const onRefreshHead = useCallback(async () => {
    if (!config.baseUrl) {
      message.error({
        message: "Please configure remote sync base URL first",
      });
      return;
    }

    try {
      await remoteSync.refreshHead();
      message.success({
        message: "Refresh remote head successful",
      });
    } catch (error) {
      message.error({
        message: `Refresh remote head failed: ${getErrorMessage(error)}`,
      });
    }
  }, [config.baseUrl, message, remoteSync]);

  const onOpenHistory = useCallback(async () => {
    if (!config.baseUrl) {
      message.error({
        message: "Please configure remote sync base URL first",
      });
      return;
    }

    if (!config.accessToken) {
      message.error({
        message: "Please login to remote sync first",
      });
      return;
    }

    setHistoryOpen(true);

    try {
      await remoteHistory.refresh();
    } catch (error) {
      message.error({
        message: `Load remote snapshot history failed: ${getErrorMessage(error)}`,
      });
    }
  }, [config.accessToken, config.baseUrl, message, remoteHistory]);

  const onRefreshHistory = useCallback(async () => {
    try {
      await remoteHistory.refresh();
      message.success({
        message: "Refresh remote snapshot history successful",
      });
    } catch (error) {
      message.error({
        message: `Refresh remote snapshot history failed: ${getErrorMessage(error)}`,
      });
    }
  }, [message, remoteHistory]);

  const onLoadMoreHistory = useCallback(async () => {
    try {
      await remoteHistory.loadMore();
    } catch (error) {
      message.error({
        message: `Load more remote snapshot history failed: ${getErrorMessage(error)}`,
      });
    }
  }, [message, remoteHistory]);

  const onRegisterDevice = useCallback(async () => {
    if (!config.baseUrl) {
      message.error({
        message: "Please configure remote sync base URL first",
      });
      return;
    }

    if (!config.accessToken) {
      message.error({
        message: "Please login to remote sync first",
      });
      return;
    }

    if (!sessionState?.deviceId) {
      message.error({
        message: "Local sync device ID is not ready",
      });
      return;
    }

    try {
      await remoteSync.registerDevice({
        deviceId: sessionState.deviceId,
        deviceName: `Shell360 ${import.meta.env.TAURI_ENV_PLATFORM}`,
        platform: import.meta.env.TAURI_ENV_PLATFORM,
        appVersion: version,
      });
      message.success({
        message: "Register remote sync device successful",
      });
    } catch (error) {
      message.error({
        message: `Register remote sync device failed: ${getErrorMessage(error)}`,
      });
    }
  }, [
    config.accessToken,
    config.baseUrl,
    message,
    remoteSync,
    sessionState?.deviceId,
    version,
  ]);

  const onUploadSnapshot = useCallback(async () => {
    try {
      const result = await remoteOperations.uploadCurrentSnapshot();

      if (result.status === "validationFailed") {
        const { validation } = result;

        modal.error({
          title: "Snapshot Validation Failed",
          content: (
            <Box sx={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {[
                `Valid: ${validation.isValid ? "Yes" : "No"}`,
                `Schema Compatible: ${validation.schemaCompatible ? "Yes" : "No"}`,
                validation.missingKeyRefs.length > 0
                  ? `Missing Key Refs: ${validation.missingKeyRefs.join(", ")}`
                  : "Missing Key Refs: None",
                validation.missingHostRefs.length > 0
                  ? `Missing Host Refs: ${validation.missingHostRefs.join(", ")}`
                  : "Missing Host Refs: None",
              ].join("\n")}
            </Box>
          ),
        });
        return;
      }

      if (result.status === "conflict") {
        setConflictUpload({
          latest: result.latest,
          snapshot: result.snapshot,
          envelope: result.envelope,
        });
        return;
      }

      message.success({
        message: "Upload remote sync snapshot successful",
      });
    } catch (error) {
      message.error({
        message: `Upload remote sync snapshot failed: ${getErrorMessage(error)}`,
      });
    }
  }, [message, modal, remoteOperations]);

  const onRestoreLatestSnapshot = useCallback(async () => {
    if (!config.baseUrl) {
      message.error({
        message: "Please configure remote sync base URL first",
      });
      return;
    }

    if (!config.accessToken) {
      message.error({
        message: "Please login to remote sync first",
      });
      return;
    }

    try {
      const head = remoteSync.head ?? (await remoteSync.refreshHead());

      if (!head?.snapshotVersion) {
        message.error({
          message: "Remote sync head is empty",
        });
        return;
      }

      const shouldContinue = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: "Restore Latest Remote Snapshot",
          content: (
            <Box sx={{ whiteSpace: "pre-wrap" }}>
              {[
                "This will replace the current local Hosts, Keys and Port Forwardings.",
                `Remote Version: ${head.snapshotVersion}`,
                `Hosts: ${head.recordCounts.hostCount}`,
                `Keys: ${head.recordCounts.keyCount}`,
                `Port Forwardings: ${head.recordCounts.portForwardingCount}`,
              ].join("\n")}
            </Box>
          ),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!shouldContinue) {
        return;
      }

      const result = await remoteOperations.restoreSnapshot(
        head.snapshotVersion,
        {
          successResult: "Restore latest remote successful",
          failurePrefix: "Restore latest remote failed",
        },
      );

      message.success({
        message: `Restore latest remote snapshot successful: ${result.importedHosts} hosts, ${result.importedKeys} keys, ${result.importedPortForwardings} port forwardings`,
      });
    } catch (error) {
      message.error({
        message: `Restore latest remote snapshot failed: ${getErrorMessage(error)}`,
      });
    }
  }, [
    config.accessToken,
    config.baseUrl,
    message,
    modal,
    remoteOperations,
    remoteSync,
  ]);

  const onRestoreHistorySnapshot = useCallback(
    async (snapshot: RemoteSnapshotMeta) => {
      const shouldContinue = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: "Restore Remote Snapshot Version",
          content: (
            <Box sx={{ whiteSpace: "pre-wrap" }}>
              {[
                "This will replace the current local Hosts, Keys and Port Forwardings.",
                ...formatSnapshotSummaryLines(snapshot),
              ].join("\n")}
            </Box>
          ),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!shouldContinue) {
        return;
      }

      setRestoringSnapshotVersion(snapshot.snapshotVersion);

      try {
        const result = await remoteOperations.restoreSnapshot(
          snapshot.snapshotVersion,
          {
            successResult: "Restore remote version successful",
            failurePrefix: "Restore remote version failed",
          },
        );
        message.success({
          message: `Restore remote snapshot successful: ${result.importedHosts} hosts, ${result.importedKeys} keys, ${result.importedPortForwardings} port forwardings`,
        });
        await remoteHistory.refresh();
        setHistoryOpen(false);
      } catch (error) {
        message.error({
          message: `Restore remote snapshot failed: ${getErrorMessage(error)}`,
        });
      } finally {
        setRestoringSnapshotVersion(undefined);
      }
    },
    [message, modal, remoteHistory, remoteOperations],
  );

  const onRestoreConflictRemote = useCallback(async () => {
    if (!conflictUpload?.latest.snapshotVersion) {
      return;
    }

    setConflictLoading(true);

    try {
      const result = await remoteOperations.restoreSnapshot(
        conflictUpload.latest.snapshotVersion,
        {
          successResult: "Restore conflicting remote successful",
          failurePrefix: "Restore conflicting remote failed",
        },
      );
      message.success({
        message: `Restored conflicting remote snapshot: ${result.importedHosts} hosts, ${result.importedKeys} keys, ${result.importedPortForwardings} port forwardings`,
      });
      setConflictUpload(undefined);
    } catch (error) {
      message.error({
        message: `Restore conflicting remote snapshot failed: ${getErrorMessage(error)}`,
      });
    } finally {
      setConflictLoading(false);
    }
  }, [conflictUpload, message, remoteOperations]);

  const onOverwriteConflictRemote = useCallback(async () => {
    if (!conflictUpload?.latest.snapshotVersion) {
      return;
    }

    setConflictLoading(true);

    try {
      const result =
        await remoteOperations.overwriteRemoteSnapshot(conflictUpload);

      if (result.status === "conflict") {
        setConflictUpload((current) =>
          current
            ? {
                ...current,
                latest: result.latest,
              }
            : current,
        );
        message.warning({
          message:
            "Remote head changed again. Conflict information has been refreshed.",
        });
        return;
      }

      message.success({
        message: "Overwrite remote snapshot successful",
      });
      setConflictUpload(undefined);
    } catch (error) {
      message.error({
        message: `Overwrite remote snapshot failed: ${getErrorMessage(error)}`,
      });
    } finally {
      setConflictLoading(false);
    }
  }, [conflictUpload, message, remoteOperations]);

  const onClearAuth = useCallback(async () => {
    await clearAuthState();
    await refreshConfig();
    message.success({
      message: "Clear remote sync auth successful",
    });
  }, [clearAuthState, message, refreshConfig]);

  return (
    <>
      <List>
        <ListItem>
          <ListItemText
            primary="Remote Sync Base URL"
            secondary={config.baseUrl || "Not configured"}
          />
          <IconButton onClick={() => setConfigOpen(true)}>
            <Icon className="icon-settings" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Remote Sync Account"
            secondary={config.accountId || "Not logged in"}
          />
          <IconButton onClick={() => setLoginOpen(true)}>
            <Icon className="icon-arrow-right" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText primary="Remote Auth Status" secondary={authState} />
          {config.accessToken ? (
            <IconButton onClick={onClearAuth}>
              <Icon className="icon-arrow-left" />
            </IconButton>
          ) : null}
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Remote Head Version"
            secondary={remoteSync.head?.snapshotVersion ?? "N/A"}
          />
          <IconButton onClick={onRefreshHead}>
            <Icon className="icon-arrow-path" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Remote Head Created At"
            secondary={remoteHeadCreatedAt}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Remote Head Device"
            secondary={remoteSync.head?.createdByDeviceId ?? "N/A"}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Remote Head Counts"
            secondary={
              remoteSync.head
                ? `hosts ${remoteSync.head.recordCounts.hostCount}, keys ${remoteSync.head.recordCounts.keyCount}, port forwardings ${remoteSync.head.recordCounts.portForwardingCount}`
                : "N/A"
            }
          />
          <IconButton onClick={onRegisterDevice}>
            <Icon className="icon-key" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Upload Current Snapshot"
            secondary="Encrypt the current local snapshot and upload it to remote"
          />
          <IconButton onClick={onUploadSnapshot}>
            <Icon className="icon-file-upload" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Restore Latest Remote Snapshot"
            secondary="Download, decrypt and replace local data using the latest remote snapshot"
          />
          <IconButton onClick={onRestoreLatestSnapshot}>
            <Icon className="icon-file-download" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Remote Snapshot History"
            secondary="Browse recent remote snapshots and restore a specific version"
          />
          <IconButton onClick={onOpenHistory}>
            <Icon className="icon-time" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Last Remote Result"
            secondary={config.lastRemoteResult || "N/A"}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Last Remote Snapshot Version"
            secondary={config.lastRemoteSnapshotVersion || "N/A"}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Last Remote Result At"
            secondary={lastRemoteResultAt}
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Remote Sync Status"
            secondary={
              remoteSync.headError
                ? getErrorMessage(remoteSync.headError)
                : remoteSync.headLoading
                  ? "Loading..."
                  : "Ready"
            }
          />
        </ListItem>
      </List>

      <RemoteSyncConfig
        open={configOpen}
        baseUrl={config.baseUrl}
        onCancel={() => setConfigOpen(false)}
        onOk={onSaveConfig}
      />
      <RemoteSyncLogin
        open={loginOpen}
        onCancel={() => setLoginOpen(false)}
        onOk={onLogin}
      />
      <RemoteSyncHistory
        open={historyOpen}
        loading={remoteHistory.loading}
        loadingMore={remoteHistory.loadingMore}
        snapshots={remoteHistory.snapshots}
        total={remoteHistory.total}
        canLoadMore={remoteHistory.canLoadMore}
        restoringSnapshotVersion={restoringSnapshotVersion}
        onCancel={() => setHistoryOpen(false)}
        onRefresh={onRefreshHistory}
        onLoadMore={onLoadMoreHistory}
        onRestore={onRestoreHistorySnapshot}
      />
      <RemoteSyncConflictDialog
        open={Boolean(conflictUpload)}
        latest={conflictUpload?.latest}
        loading={conflictLoading}
        summaryLines={formatSnapshotSummaryLines(conflictUpload?.latest)}
        onCancel={() => setConflictUpload(undefined)}
        onRestoreRemote={onRestoreConflictRemote}
        onOverwriteRemote={onOverwriteConflictRemote}
      />
    </>
  );
}
