# Shell360 Cloud Sync API Design

## Goals

- Provide official cloud sync for Hosts, Keys, and Port Forwardings in the first release.
- Store only encrypted snapshots and minimal metadata on the server.
- Use snapshot-level sync first, without record-level automatic merge.
- Resolve conflicts at the snapshot version level with explicit user action.

## Encryption Boundary

- Local storage encryption remains handled by CryptoManager.
- Cloud sync encryption uses a separate sync secret.
- The client encrypts SyncSnapshotPlain into EncryptedSyncEnvelope before upload.
- The server may see only account/device/version metadata, cipher suite, payload size/hash, and record counts.
- The server must not see host names, addresses, usernames, private key bodies, or port forwarding details.

## Client Flow

1. Export a local plaintext snapshot with export_sync_snapshot.
2. Derive a sync key from the sync secret and encrypt the snapshot.
3. Upload the encrypted envelope with baseSnapshotVersion.
4. If the remote head changed, the server returns HTTP 409.
5. The client fetches the latest encrypted snapshot and lets the user decide whether to overwrite local or remote state.

## Core Models

### RemoteSnapshotMeta

```json
{
  "snapshotVersion": "2026-03-22T10:20:30.123Z",
  "baseSnapshotVersion": "2026-03-21T09:00:00.000Z",
  "schemaVersion": "1.0",
  "createdAt": "2026-03-22T10:20:30.123Z",
  "createdByDeviceId": "device-123",
  "cipherSuite": "xchacha20poly1305+argon2id",
  "payloadSize": 32768,
  "payloadSha256": "base64-sha256",
  "recordCounts": {
    "hostCount": 10,
    "keyCount": 4,
    "portForwardingCount": 6
  }
}
```

### EncryptedSyncEnvelope

```json
{
  "snapshotVersion": "2026-03-22T10:20:30.123Z",
  "schemaVersion": "1.0",
  "cipherSuite": "xchacha20poly1305+argon2id",
  "kdf": {
    "algorithm": "argon2id",
    "salt": "base64",
    "memoryCost": 19456,
    "timeCost": 2,
    "parallelism": 1
  },
  "nonce": "base64",
  "ciphertext": "base64",
  "payloadSha256": "base64-sha256"
}
```

## Headers

- Authorization: Bearer access_token
- X-Device-Id: locally generated sync_device_id
- Idempotency-Key: required for upload and restore write operations
- If-Match: optional optimistic concurrency guard against the current remote head

## HTTP Endpoints

### POST /v1/sync/auth/login

Authenticate a sync account.

### POST /v1/sync/auth/refresh

Refresh the access token.

### POST /v1/sync/devices

Register or update a device.

### GET /v1/sync/snapshots/head

Return the latest snapshot metadata only.

### GET /v1/sync/snapshots/{snapshotVersion}

Return a specific encrypted snapshot and its metadata.

### GET /v1/sync/snapshots

Return paginated snapshot history.

Query parameters:

- page: optional, minimum value is 1, defaults to 1
- pageSize: optional, clamped to 1..100, defaults to 20

Response shape:

```json
{
  "items": [
    {
      "snapshotVersion": "2026-03-22T10:20:30.123Z",
      "baseSnapshotVersion": "2026-03-21T09:00:00.000Z",
      "schemaVersion": "1.0",
      "createdAt": "2026-03-22T10:20:30.123Z",
      "createdByDeviceId": "device-123",
      "cipherSuite": "xchacha20poly1305+argon2id",
      "payloadSize": 32768,
      "payloadSha256": "base64-sha256",
      "recordCounts": {
        "hostCount": 10,
        "keyCount": 4,
        "portForwardingCount": 6
      }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 37,
  "hasMore": true
}
```

### POST /v1/sync/snapshots

Upload a new encrypted snapshot and attempt to advance the remote head.

Expected request shape:

```json
{
  "requestId": "req_123",
  "baseSnapshotVersion": "2026-03-21T09:00:00.000Z",
  "meta": {
    "snapshotVersion": "2026-03-22T10:20:30.123Z",
    "baseSnapshotVersion": "2026-03-21T09:00:00.000Z",
    "schemaVersion": "1.0",
    "createdAt": "2026-03-22T10:20:30.123Z",
    "createdByDeviceId": "device-123",
    "cipherSuite": "xchacha20poly1305+argon2id",
    "payloadSize": 32768,
    "payloadSha256": "base64-sha256",
    "recordCounts": {
      "hostCount": 10,
      "keyCount": 4,
      "portForwardingCount": 6
    }
  },
  "envelope": {
    "snapshotVersion": "2026-03-22T10:20:30.123Z",
    "schemaVersion": "1.0",
    "cipherSuite": "xchacha20poly1305+argon2id",
    "kdf": {
      "algorithm": "argon2id",
      "salt": "base64",
      "memoryCost": 19456,
      "timeCost": 2,
      "parallelism": 1
    },
    "nonce": "base64",
    "ciphertext": "base64",
    "payloadSha256": "base64-sha256"
  }
}
```

On conflict, return HTTP 409 with the latest remote head metadata.

### POST /v1/sync/snapshots/restore

Record a client restore action for audit and status display.

## Conflict Model

- no_remote_head: upload directly
- fast_forward_upload: baseSnapshotVersion matches remote head
- remote_ahead_local_clean: fetch and restore remote snapshot
- both_changed: explicit overwrite decision required, no automatic merge in phase 1

The first release should expose only two user decisions:

- Overwrite remote with a newly exported snapshot
- Overwrite local by restoring the latest remote snapshot

## Error Codes

- SYNC_UNAUTHORIZED
- SYNC_DEVICE_REVOKED
- SYNC_SCHEMA_MISMATCH
- SYNC_REQUEST_CONFLICT
- SYNC_PAYLOAD_TOO_LARGE
- SYNC_RATE_LIMITED
- SYNC_SNAPSHOT_NOT_FOUND

Common error body:

```json
{
  "code": "SYNC_REQUEST_CONFLICT",
  "message": "Remote snapshot head has changed",
  "retryable": false,
  "requestId": "req_123"
}
```

## Phase 1 Scope

- Manual upload and download only
- Snapshot storage and head management only
- No record-level diff or merge yet
- Excludes SSH history, logs, transient sessions, and UI preferences
