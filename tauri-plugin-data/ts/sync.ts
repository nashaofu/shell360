import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type { Host } from "./host";
import type { Key } from "./key";
import type { PortForwarding } from "./portForwarding";

export interface ExportSyncSnapshotOpts extends Record<string, unknown> {
  schemaVersion: string;
  includeHosts: boolean;
  includeKeys: boolean;
  includePortForwardings: boolean;
}

export interface SyncSnapshotCounts {
  hostCount: number;
  keyCount: number;
  portForwardingCount: number;
}

export interface SyncSnapshotPayload {
  hosts: Host[];
  keys: Key[];
  portForwardings: PortForwarding[];
}

export interface SyncSnapshotPlain {
  schemaVersion: string;
  snapshotVersion: string;
  createdAt: string;
  createdByDeviceId: string;
  appVersion: string;
  counts: SyncSnapshotCounts;
  payload: SyncSnapshotPayload;
}

export interface SyncSnapshotValidation {
  isValid: boolean;
  schemaCompatible: boolean;
  hostCount: number;
  keyCount: number;
  portForwardingCount: number;
  missingKeyRefs: string[];
  missingHostRefs: string[];
  warnings: string[];
}

export interface SyncDisplayError {
  code?: string;
  type?: string;
  message: string;
  retryable?: boolean;
  requestId?: string;
}

export interface SyncSessionState {
  isInitialized: boolean;
  isUnlocked: boolean;
  deviceId?: string;
  syncAccountId?: string;
  lastSyncAt?: string;
  lastRemoteSnapshotVersion?: string;
  lastError?: SyncDisplayError;
}

export interface SyncSecretInitResult {
  isInitialized: boolean;
  deviceId: string;
  keyDerivation: string;
  cipherAlg: string;
}

export interface SyncSecretUnlockResult {
  isUnlocked: boolean;
  deviceId: string;
  sessionExpiresAt?: string;
}

export interface SyncSecretRotateResult {
  isUnlocked: boolean;
  rotatedAt: string;
}

export interface SyncSimpleResult {
  success: boolean;
}

export enum SyncImportMode {
  ReplaceLocal = "replaceLocal",
  MergeByImportMapping = "mergeByImportMapping",
}

export interface ImportSyncSnapshotOpts extends Record<string, unknown> {
  snapshot: SyncSnapshotPlain;
  mode: SyncImportMode;
}

export interface SyncImportResult {
  importedHosts: number;
  importedKeys: number;
  importedPortForwardings: number;
  skippedItems: string[];
  warnings: string[];
}

export interface SyncKdfParams {
  algorithm: string;
  salt: string;
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

export interface EncryptedSyncEnvelope {
  snapshotVersion: string;
  schemaVersion: string;
  cipherSuite: string;
  kdf: SyncKdfParams;
  nonce: string;
  ciphertext: string;
  payloadSha256: string;
}

export interface InitSyncSecretOpts extends Record<string, unknown> {
  password: string;
  confirmPassword: string;
}

export interface UnlockSyncSecretOpts extends Record<string, unknown> {
  password: string;
}

export interface RotateSyncSecretOpts extends Record<string, unknown> {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function exportSyncSnapshot(
  opts: ExportSyncSnapshotOpts,
): Promise<SyncSnapshotPlain> {
  return invoke<SyncSnapshotPlain>("plugin:data|export_sync_snapshot", {
    opts,
  });
}

export async function validateSyncSnapshot(
  snapshot: SyncSnapshotPlain,
): Promise<SyncSnapshotValidation> {
  return invoke<SyncSnapshotValidation>("plugin:data|validate_sync_snapshot", {
    snapshot,
  });
}

export async function importSyncSnapshot(
  opts: ImportSyncSnapshotOpts,
): Promise<SyncImportResult> {
  return invoke<SyncImportResult>("plugin:data|import_sync_snapshot", {
    opts,
  });
}

export async function encryptSyncSnapshot(
  snapshot: SyncSnapshotPlain,
): Promise<EncryptedSyncEnvelope> {
  return invoke<EncryptedSyncEnvelope>("plugin:data|encrypt_sync_snapshot", {
    snapshot,
  });
}

export async function decryptSyncSnapshot(
  envelope: EncryptedSyncEnvelope,
): Promise<SyncSnapshotPlain> {
  return invoke<SyncSnapshotPlain>("plugin:data|decrypt_sync_snapshot", {
    envelope,
  });
}

export async function initSyncSecret(
  opts: InitSyncSecretOpts,
): Promise<SyncSecretInitResult> {
  return invoke<SyncSecretInitResult>("plugin:data|init_sync_secret", opts);
}

export async function unlockSyncSecret(
  opts: UnlockSyncSecretOpts,
): Promise<SyncSecretUnlockResult> {
  return invoke<SyncSecretUnlockResult>("plugin:data|unlock_sync_secret", opts);
}

export async function rotateSyncSecret(
  opts: RotateSyncSecretOpts,
): Promise<SyncSecretRotateResult> {
  return invoke<SyncSecretRotateResult>("plugin:data|rotate_sync_secret", opts);
}

export async function clearSyncSession(): Promise<SyncSimpleResult> {
  return invoke<SyncSimpleResult>("plugin:data|clear_sync_session");
}

export async function checkSyncSession(): Promise<SyncSessionState> {
  return invoke<SyncSessionState>("plugin:data|check_sync_session");
}

export async function onSyncSessionChange(
  callback: (state: SyncSessionState) => unknown,
): Promise<UnlistenFn> {
  const unlisten = await listen<SyncSessionState>(
    "sync://session_change",
    (event) => {
      callback(event.payload);
    },
  );

  return unlisten;
}
