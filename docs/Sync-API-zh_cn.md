# Shell360 云同步 API 设计

## 目标

- 提供官方云同步能力，首期只覆盖 Hosts、Keys、Port Forwardings。
- 服务端只存储密文快照与必要元数据，不持有解密能力。
- 首期采用快照级同步，不做记录级自动合并。
- 冲突以快照版本为单位处理，由客户端做显式覆盖决策。

## 加密边界

- 本地存储加密：继续由 tauri-plugin-data 的 CryptoManager 负责。
- 云同步加密：单独使用 sync secret，将 SyncSnapshotPlain 加密为 EncryptedSyncEnvelope。
- 服务端可见字段：accountId、deviceId、snapshotVersion、baseSnapshotVersion、schemaVersion、cipherSuite、payloadSize、payloadSha256、recordCounts、createdAt。
- 服务端不可见字段：主机名、地址、用户名、私钥内容、端口转发详细配置。

## 客户端同步流程

1. 客户端调用 export_sync_snapshot 导出本地明文快照。
2. 客户端用 sync secret 派生同步密钥并加密，生成 EncryptedSyncEnvelope。
3. 上传时带上 baseSnapshotVersion，服务端据此检测并发覆盖。
4. 若 baseSnapshotVersion 落后于服务端 head，返回 409 冲突。
5. 客户端拉取最新密文快照，解密后提示用户选择覆盖本地或稍后处理。

## 核心对象

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

## 鉴权与请求头

- Authorization: Bearer access_token
- X-Device-Id: 本地生成的 sync_device_id
- Idempotency-Key: 上传、恢复等写操作必带
- If-Match: 可选，用于要求服务端当前 head 必须等于指定版本

## HTTP 接口

### POST /v1/sync/auth/login

用途：同步账号登录。

请求体：

```json
{
  "loginId": "user@example.com",
  "credential": "opaque-token-or-password",
  "deviceName": "Windows Desktop",
  "platform": "windows",
  "appVersion": "0.1.0"
}
```

响应体：

```json
{
  "accountId": "acc_123",
  "accessToken": "token",
  "refreshToken": "token",
  "expiresAt": "2026-03-22T12:20:30.123Z"
}
```

### POST /v1/sync/auth/refresh

用途：刷新 access token。

### POST /v1/sync/devices

用途：注册或更新当前设备信息。

请求体：

```json
{
  "deviceId": "device-123",
  "deviceName": "Windows Desktop",
  "platform": "windows",
  "appVersion": "0.1.0",
  "deviceFingerprint": "optional-hash"
}
```

### GET /v1/sync/snapshots/head

用途：查询当前最新快照元数据，不返回密文。

响应体：

```json
{
  "head": {
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
}
```

### GET /v1/sync/snapshots/{snapshotVersion}

用途：按版本获取密文快照。

响应体：

```json
{
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

### GET /v1/sync/snapshots

用途：获取快照历史列表。

查询参数：

- page：可选，最小值为 1，默认 1
- pageSize：可选，会被限制在 1..100，默认 20

响应体：

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

用途：上传一个新的密文快照，并尝试推进 head。

请求体：

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

成功响应：

```json
{
  "accepted": true,
  "head": {
    "snapshotVersion": "2026-03-22T10:20:30.123Z"
  }
}
```

冲突响应：HTTP 409

```json
{
  "code": "SYNC_REQUEST_CONFLICT",
  "message": "Remote snapshot head has changed",
  "latest": {
    "snapshotVersion": "2026-03-22T11:00:00.000Z",
    "createdByDeviceId": "device-456",
    "createdAt": "2026-03-22T11:00:00.000Z"
  }
}
```

### POST /v1/sync/snapshots/restore

用途：记录一次用户侧恢复行为，便于审计与设备同步状态展示。

请求体：

```json
{
  "requestId": "req_restore_123",
  "snapshotVersion": "2026-03-22T10:20:30.123Z",
  "restoredAt": "2026-03-22T12:20:30.123Z"
}
```

## 冲突模型

- no_remote_head：远端为空，可直接上传。
- fast_forward_upload：本地 baseSnapshotVersion 等于远端 head，可直接上传。
- remote_ahead_local_clean：远端领先且本地无新变更，提示下载恢复。
- both_changed：本地导出基线落后于远端 head，必须弹显式确认，不自动合并。

首期客户端建议只支持两种决策：

- 覆盖远端：重新基于最新远端 head 作为 base，再上传新快照。
- 覆盖本地：下载远端 latest，解密后本地 replace restore。

## 错误码

- SYNC_UNAUTHORIZED
- SYNC_DEVICE_REVOKED
- SYNC_SCHEMA_MISMATCH
- SYNC_REQUEST_CONFLICT
- SYNC_PAYLOAD_TOO_LARGE
- SYNC_RATE_LIMITED
- SYNC_SNAPSHOT_NOT_FOUND

错误体：

```json
{
  "code": "SYNC_REQUEST_CONFLICT",
  "message": "Remote snapshot head has changed",
  "retryable": false,
  "requestId": "req_123"
}
```

## 首期实现边界

- 手动上传/下载，不承诺后台自动同步。
- 服务端只做快照存储和 head 管理，不做记录级 diff。
- 不在首期范围：SSH 历史、临时会话、日志、UI 偏好。
