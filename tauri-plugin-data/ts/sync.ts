import { invoke } from "@tauri-apps/api/core";

export interface SyncConfig {
  serverUrl: string | null;
}

export interface SyncAuthState {
  isLoggedIn: boolean;
  deviceId: string;
}

export interface DeviceAuthSession {
  sessionId: string;
  authorizeUrl: string;
}

export interface DeviceAuthStatus {
  status: "pending" | "approved" | "rejected";
  accessToken?: string;
  refreshToken?: string;
}

export interface SyncStatus {
  isLoggedIn: boolean;
  serverUrl: string | null;
  lastPullSeq: number;
  pendingChangesCount: number;
}

export interface SyncPushResult {
  accepted: number;
  deduplicated: number;
}

export interface SyncPullResult {
  applied: number;
  currentSeq: number;
}

export interface SyncUserInfo {
  id: number;
  name: string;
}

export interface SyncDevice {
  deviceId: string;
  deviceName: string;
}

export function getSyncConfig(): Promise<SyncConfig> {
  return invoke<SyncConfig>("plugin:data|get_sync_config");
}

export function setSyncConfig(config: SyncConfig): Promise<void> {
  return invoke<void>("plugin:data|set_sync_config", { config });
}

export function getSyncAuthState(): Promise<SyncAuthState> {
  return invoke<SyncAuthState>("plugin:data|get_sync_auth_state");
}

export function startDeviceAuth(): Promise<DeviceAuthSession> {
  return invoke<DeviceAuthSession>("plugin:data|start_device_auth");
}

export function pollDeviceAuth(sessionId: string): Promise<DeviceAuthStatus> {
  return invoke<DeviceAuthStatus>("plugin:data|poll_device_auth", { sessionId });
}

export function logoutSync(): Promise<void> {
  return invoke<void>("plugin:data|logout_sync");
}

export function getSyncStatus(): Promise<SyncStatus> {
  return invoke<SyncStatus>("plugin:data|get_sync_status");
}

export function triggerSyncPush(): Promise<SyncPushResult> {
  return invoke<SyncPushResult>("plugin:data|trigger_sync_push");
}

export function triggerSyncPull(): Promise<SyncPullResult> {
  return invoke<SyncPullResult>("plugin:data|trigger_sync_pull");
}

export function getOAuthProviders(): Promise<string[]> {
  return invoke<string[]>("plugin:data|get_oauth_providers");
}

export function getSyncUserInfo(): Promise<SyncUserInfo> {
  return invoke<SyncUserInfo>("plugin:data|get_sync_user_info");
}

export function getSyncDevices(): Promise<SyncDevice[]> {
  return invoke<SyncDevice[]>("plugin:data|get_sync_devices");
}

export function revokeSyncDevice(deviceId: string): Promise<void> {
  return invoke<void>("plugin:data|revoke_sync_device", { deviceId });
}

export function initialSyncPush(): Promise<void> {
  return invoke<void>("plugin:data|initial_sync_push");
}

export function rebuildFromDoc(): Promise<void> {
  return invoke<void>("plugin:data|rebuild_from_doc");
}
