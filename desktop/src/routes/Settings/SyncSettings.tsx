import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { pollDeviceAuth } from "tauri-plugin-data";
import {
  syncAuthStateAtom,
  syncDevicesAtom,
  syncUserInfoAtom,
  useSyncActions,
  useSyncConfig,
  useSyncStatus,
} from "@/atom/syncAtom";
import useMessage from "@/hooks/useMessage";
import openUrl from "@/utils/openUrl";

export default function SyncSettings() {
  const { config, update: updateConfig } = useSyncConfig();
  const { status } = useSyncStatus();
  const authState = useAtomValue(syncAuthStateAtom);
  const userInfo = useAtomValue(syncUserInfoAtom);
  const devices = useAtomValue(syncDevicesAtom);
  const { refreshAll, startAuth, logout, push, pull } = useSyncActions();
  const message = useMessage();

  const [serverUrl, setServerUrl] = useState(config.serverUrl ?? "");
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isAuthPending, setIsAuthPending] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    refreshAll().catch(() => {});
  }, [refreshAll]);

  useEffect(() => {
    setServerUrl(config.serverUrl ?? "");
  }, [config.serverUrl]);

  const onSaveServer = useCallback(async () => {
    await updateConfig({ serverUrl: serverUrl.trim() || null });
    message.success({ message: "Server URL saved" });
  }, [serverUrl, updateConfig, message]);

  const onStartLogin = useCallback(async () => {
    try {
      const session = await startAuth();
      setIsAuthPending(true);
      await openUrl(session.authorizeUrl);

      pollTimerRef.current = setInterval(async () => {
        try {
          const result = await pollDeviceAuth(session.sessionId);
          if (result.status === "approved") {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
            setIsAuthPending(false);
            await refreshAll();
            message.success({ message: "Logged in successfully" });
          } else if (result.status === "rejected") {
            clearInterval(pollTimerRef.current!);
            pollTimerRef.current = null;
            setIsAuthPending(false);
            message.error({ message: "Login rejected" });
          }
        } catch {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          setIsAuthPending(false);
        }
      }, 3000);
    } catch (err) {
      message.error({ message: `Login failed: ${String(err)}` });
    }
  }, [startAuth, refreshAll, message]);

  const onCancelLogin = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsAuthPending(false);
  }, []);

  const onLogout = useCallback(async () => {
    await logout();
    message.success({ message: "Logged out" });
  }, [logout, message]);

  const onPush = useCallback(async () => {
    setIsPushing(true);
    try {
      const result = await push();
      message.success({
        message: `Pushed ${result.accepted} change(s)`,
      });
    } catch (err) {
      message.error({ message: `Push failed: ${String(err)}` });
    } finally {
      setIsPushing(false);
    }
  }, [push, message]);

  const onPull = useCallback(async () => {
    setIsPulling(true);
    try {
      const result = await pull();
      message.success({
        message: `Pulled ${result.applied} change(s)`,
      });
    } catch (err) {
      message.error({ message: `Pull failed: ${String(err)}` });
    } finally {
      setIsPulling(false);
    }
  }, [pull, message]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const isLoggedIn = authState?.isLoggedIn ?? false;

  return (
    <List>
      {/* Server URL */}
      <ListItem>
        <ListItemText
          primary="Sync Server URL"
          secondary="Enter the URL of your Shell360 sync server"
        />
      </ListItem>
      <ListItem>
        <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
          <TextField
            size="small"
            fullWidth
            placeholder="https://sync.example.com"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
          <Button variant="contained" size="small" onClick={onSaveServer}>
            Save
          </Button>
        </Stack>
      </ListItem>

      <Divider />

      {/* Auth */}
      <ListItem>
        <ListItemText
          primary="Account"
          secondary={
            isLoggedIn
              ? `Logged in as ${userInfo?.name ?? "unknown"}`
              : "Not logged in"
          }
        />
        {isLoggedIn ? (
          <IconButton onClick={onLogout}>
            <Icon className="icon-logout" />
          </IconButton>
        ) : isAuthPending ? (
          <Stack direction="row" alignItems="center" spacing={1}>
            <CircularProgress size={20} />
            <Button size="small" onClick={onCancelLogin}>
              Cancel
            </Button>
          </Stack>
        ) : (
          <Button
            variant="outlined"
            size="small"
            disabled={!config.serverUrl}
            onClick={onStartLogin}
          >
            Login
          </Button>
        )}
      </ListItem>

      {isAuthPending && (
        <ListItem>
          <Alert severity="info" sx={{ width: "100%" }}>
            A browser window has been opened. Please authorize the device and
            return here.
          </Alert>
        </ListItem>
      )}

      <Divider />

      {/* Sync actions */}
      <ListItem>
        <ListItemText
          primary="Sync"
          secondary={
            status
              ? `${status.pendingChangesCount} pending · seq ${status.lastPullSeq}`
              : undefined
          }
        />
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            disabled={!isLoggedIn || isPushing}
            onClick={onPush}
            startIcon={
              isPushing ? (
                <CircularProgress size={14} />
              ) : (
                <Icon className="icon-cloud-upload" />
              )
            }
          >
            Push
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!isLoggedIn || isPulling}
            onClick={onPull}
            startIcon={
              isPulling ? (
                <CircularProgress size={14} />
              ) : (
                <Icon className="icon-cloud-download" />
              )
            }
          >
            Pull
          </Button>
        </Stack>
      </ListItem>

      {/* Devices */}
      {isLoggedIn && devices.length > 0 && (
        <>
          <Divider />
          <ListItem>
            <ListItemText primary="Devices" />
          </ListItem>
          {devices.map((device) => (
            <ListItem key={device.deviceId} sx={{ pl: 3 }}>
              <ListItemText
                primary={device.deviceName}
                secondary={
                  <Typography variant="caption" sx={{ opacity: 0.6 }}>
                    {device.deviceId}
                  </Typography>
                }
              />
              {device.deviceId !== authState?.deviceId && (
                <IconButton
                  size="small"
                  onClick={async () => {
                    const { revokeSyncDevice } = await import(
                      "tauri-plugin-data"
                    );
                    await revokeSyncDevice(device.deviceId);
                    await refreshAll();
                  }}
                >
                  <Icon className="icon-delete" />
                </IconButton>
              )}
            </ListItem>
          ))}
        </>
      )}

      {/* Status info */}
      {status && (
        <>
          <Divider />
          <ListItem>
            <Box sx={{ width: "100%", opacity: 0.6 }}>
              <Typography variant="caption">
                Device ID: {authState?.deviceId ?? "—"}
              </Typography>
            </Box>
          </ListItem>
        </>
      )}
    </List>
  );
}
