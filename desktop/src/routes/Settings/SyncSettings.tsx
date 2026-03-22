import {
  Box,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import { useSync } from "shared";

import useMessage from "@/hooks/useMessage";
import useModal from "@/hooks/useModal";

import InitSyncSecret from "./InitSyncSecret";
import RotateSyncSecret from "./RotateSyncSecret";
import UnlockSyncSecret from "./UnlockSyncSecret";

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
}

export default function SyncSettings() {
  const {
    sessionState,
    sessionLoading,
    sessionError,
    refreshSession,
    exportAndValidateSnapshot,
    clearSession,
    validateSnapshot,
    importSnapshot,
  } = useSync();
  const message = useMessage();
  const modal = useModal();
  const [initOpen, setInitOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);

  const onRefreshSession = useCallback(async () => {
    try {
      await refreshSession();
      message.success({
        message: "Refresh sync session successful",
      });
    } catch (err) {
      message.error({
        message: `Refresh sync session failed: ${String(err)}`,
      });
    }
  }, [message, refreshSession]);

  const onValidateSnapshot = useCallback(async () => {
    try {
      const { snapshot, validation } = await exportAndValidateSnapshot();
      modal.info({
        title: "Sync Snapshot Validation",
        content: (
          <Box sx={{ whiteSpace: "pre-wrap" }}>
            {[
              `Schema Version: ${snapshot.schemaVersion}`,
              `Hosts: ${validation.hostCount}`,
              `Keys: ${validation.keyCount}`,
              `Port Forwardings: ${validation.portForwardingCount}`,
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
    } catch (err) {
      message.error({
        message: `Validate sync snapshot failed: ${String(err)}`,
      });
    }
  }, [exportAndValidateSnapshot, message, modal]);

  const onExportSnapshot = useCallback(async () => {
    try {
      const { snapshot, validation } = await exportAndValidateSnapshot();

      if (!validation.isValid || !validation.schemaCompatible) {
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

      const path = await save({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
          {
            name: "*",
            extensions: ["*"],
          },
        ],
        defaultPath: `shell360-sync-snapshot-${snapshot.snapshotVersion}.json`,
      });

      if (!path) {
        return;
      }

      await writeTextFile(path, JSON.stringify(snapshot, null, 2));
      message.success({
        message: "Export sync snapshot successful",
      });
    } catch (err) {
      message.error({
        message: `Export sync snapshot failed: ${getErrorMessage(err)}`,
      });
    }
  }, [exportAndValidateSnapshot, message, modal]);

  const onClearSession = useCallback(async () => {
    try {
      await clearSession();
      message.success({
        message: "Clear sync session successful",
      });
    } catch (err) {
      message.error({
        message: `Clear sync session failed: ${getErrorMessage(err)}`,
      });
    }
  }, [clearSession, message]);

  const onRestoreSnapshot = useCallback(async () => {
    try {
      const file = await open({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
          {
            name: "*",
            extensions: ["*"],
          },
        ],
        multiple: false,
        directory: false,
        defaultPath: "shell360-sync-snapshot.json",
      });

      if (!file) {
        return;
      }

      const data = await readTextFile(file);
      const snapshot = JSON.parse(data);
      const validation = await validateSnapshot(snapshot);

      if (!validation.isValid || !validation.schemaCompatible) {
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

      const shouldContinue = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: "Restore Sync Snapshot",
          content: (
            <Box sx={{ whiteSpace: "pre-wrap" }}>
              {[
                "This will replace the current local Hosts, Keys and Port Forwardings.",
                `Hosts: ${validation.hostCount}`,
                `Keys: ${validation.keyCount}`,
                `Port Forwardings: ${validation.portForwardingCount}`,
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

      const result = await importSnapshot(snapshot);
      message.success({
        message: `Restore sync snapshot successful: ${result.importedHosts} hosts, ${result.importedKeys} keys, ${result.importedPortForwardings} port forwardings`,
      });
    } catch (err) {
      message.error({
        message: `Restore sync snapshot failed: ${getErrorMessage(err)}`,
      });
    }
  }, [importSnapshot, message, modal, validateSnapshot]);

  const lastSyncAt = sessionState?.lastSyncAt
    ? dayjs(sessionState.lastSyncAt).format("YYYY-MM-DD HH:mm:ss")
    : "N/A";

  return (
    <>
      <List>
        <ListItem>
          <ListItemText
            primary="Sync Secret Initialized"
            secondary={
              sessionLoading
                ? "Loading..."
                : sessionState?.isInitialized
                  ? "Yes"
                  : "No"
            }
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Sync Session Unlocked"
            secondary={
              sessionLoading
                ? "Loading..."
                : sessionState?.isUnlocked
                  ? "Yes"
                  : "No"
            }
          />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Sync Device ID"
            secondary={sessionState?.deviceId ?? "N/A"}
          />
        </ListItem>
        <ListItem>
          <ListItemText primary="Last Sync At" secondary={lastSyncAt} />
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Last Sync Error"
            secondary={
              sessionError
                ? getErrorMessage(sessionError)
                : (sessionState?.lastError?.message ?? "None")
            }
          />
        </ListItem>
        {!sessionState?.isInitialized ? (
          <ListItem>
            <ListItemText
              primary="Initialize Sync Secret"
              secondary="Create a local password for encrypted snapshot sync"
            />
            <IconButton onClick={() => setInitOpen(true)}>
              <Icon className="icon-key" />
            </IconButton>
          </ListItem>
        ) : null}
        {sessionState?.isInitialized && !sessionState?.isUnlocked ? (
          <ListItem>
            <ListItemText
              primary="Unlock Sync Secret"
              secondary="Unlock the sync session before export or restore"
            />
            <IconButton onClick={() => setUnlockOpen(true)}>
              <Icon className="icon-arrow-right" />
            </IconButton>
          </ListItem>
        ) : null}
        {sessionState?.isInitialized ? (
          <ListItem>
            <ListItemText
              primary="Rotate Sync Secret"
              secondary="Change the password used for sync snapshot encryption"
            />
            <IconButton onClick={() => setRotateOpen(true)}>
              <Icon className="icon-key" />
            </IconButton>
          </ListItem>
        ) : null}
        {sessionState?.isUnlocked ? (
          <ListItem>
            <ListItemText
              primary="Clear Sync Session"
              secondary="Lock the current sync session on this device"
            />
            <IconButton onClick={onClearSession}>
              <Icon className="icon-arrow-left" />
            </IconButton>
          </ListItem>
        ) : null}
        <ListItem>
          <ListItemText primary="Refresh Sync Session" />
          <IconButton onClick={onRefreshSession}>
            <Icon className="icon-arrow-path" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Export Sync Snapshot"
            secondary="Save the current snapshot to a local JSON file"
          />
          <IconButton onClick={onExportSnapshot}>
            <Icon className="icon-file-download" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText primary="Validate Local Sync Snapshot" />
          <IconButton onClick={onValidateSnapshot}>
            <Icon className="icon-success-circle" />
          </IconButton>
        </ListItem>
        <ListItem>
          <ListItemText
            primary="Restore Sync Snapshot"
            secondary="Replace local Hosts, Keys and Port Forwardings from a snapshot file"
          />
          <IconButton onClick={onRestoreSnapshot}>
            <Icon className="icon-file-upload" />
          </IconButton>
        </ListItem>
      </List>

      <InitSyncSecret
        open={initOpen}
        onCancel={() => setInitOpen(false)}
        onOk={() => setInitOpen(false)}
      />
      <UnlockSyncSecret
        open={unlockOpen}
        onCancel={() => setUnlockOpen(false)}
        onOk={() => setUnlockOpen(false)}
      />
      <RotateSyncSecret
        open={rotateOpen}
        onCancel={() => setRotateOpen(false)}
        onOk={() => setRotateOpen(false)}
      />
    </>
  );
}
