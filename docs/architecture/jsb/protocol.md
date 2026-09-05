# JSB 协议规范

> 状态：**现行协议**。本文是 JSB 线协议（帧信封、帧序列、错误码、方法表）的参考规范。
> 协议权威来源是代码：帧信封在 `crates/jsb-core/src/protocol.rs`，方法表在
> `shell360-runtime::methods::method_specs()`（70 个，测试断言数量），协议黄金样例在
> `crates/jsb-core/tests/fixtures/current_protocol.json`。

JSB 在页面与宿主之间使用两类 Channel：

- **control Channel**：传输文本控制帧与 `invoke`/`emit` JSON 信封。
- **data Channel**：传输原始 `ArrayBuffer` 二进制（如 SSH shell 数据），不经 JSON。

页面通过 `window.__JSB__.openChannel(channelId)` / `closeChannel(channelId)` 管理 Channel，
`channelId` 为 RFC 4122 UUID 字符串。

## 1. 帧信封格式

### 1.1 Channel 控制帧（宿主 → 页面，经窗口消息）

```json
{"source":"jsb.channel","type":"channel.opened","channelId":"..."}
{"source":"jsb.channel","type":"channel.closed","channelId":"..."}
{"source":"jsb.channel","type":"channel.open.failed","channelId":"...","error":{"code":"JSB_CHANNEL_OPEN_FAILED","message":"..."}}
```

### 1.2 invoke 请求（页面 → 宿主）

```json
{"type":"invoke.request","id":"...","method":"bridge.health","data":null}
```

`id`、`method` 为非空字符串；无参数请求 `data` 为 `null`（不省略）。

### 1.3 invoke 响应（宿主 → 页面）

成功：

```json
{"type":"invoke.response","id":"...","data":{"status":"ok"}}
```

失败：

```json
{"type":"invoke.response","id":"...","error":{"code":"...","message":"...","details":null}}
```

`details` 可选；`jsb-core::reject` 对缺省 `details` 序列化为 `null`。

### 1.4 emit 事件（宿主 → 页面）

```json
{"type":"emit","event":"data.authedChange","payload":true}
```

可选路由字段：`targetId`、`clientId`、`sequence`。`emit` 只发送到 control Channel。

### 1.5 二进制 Channel

data Channel 双向承载原始 `ArrayBuffer`，不经 JSON/Base64。iOS 是唯一例外：其
WKScriptMessage 适配器在传输层用 version-1 信封包裹并以 Base64 编码，但对页面的
MessagePort 仍呈现 `ArrayBuffer`（见 §6）。

## 2. 帧序列

正常路径：

1. 页面调用 `window.__JSB__.openChannel(channelId)`（UUID）。
2. 宿主转交一个 web port，并在窗口上投递控制串 `channel.opened`。
3. 页面向 port 写入 invoke 请求（`invoke.request`）。
4. 宿主在同一 port 写回响应（`invoke.response`）。
5. 宿主可随时写入事件（`emit`）。
6. shell data Channel 双向承载原始 `ArrayBuffer`。
7. 页面调用 `closeChannel(channelId)`：Android / HarmonyOS 关闭原生端口；iOS 向 WK handler
   发送 `{version:1,kind:"channel.close",channelId,payload:""}`。
8. 当 Rust 或原生 transport 主动关闭活跃 Channel 时，适配器先投递 `channel.closed` 再释放
   端口；TypeScript 通道随后拒绝 pending 工作并释放本地资源。

打开失败时，窗口控制串为 `channel.open.failed`，携带 `error` 信封。

## 3. 错误模型

错误分三层：

1. **协议错误**：非法 JSON、缺少 ID、重复请求、消息过大、方法不可用。由 `jsb-core` 构造
   `invoke.response` 错误帧并直接发回前端。
2. **方法错误**：由 `JsbHandler` 或 completion 返回 `JsbErrorPayload`，`jsb-core` 只负责封装响应。
3. **Transport 错误**：WebView port 不存在、线程调度失败或发送失败。转换为
   `JsbTransportError`，触发 Channel 清理和 pending 请求取消，不伪装为具体业务错误。

### 3.1 框架错误码（`jsb-core`）

```text
JSB_INVALID_MESSAGE
JSB_MESSAGE_TOO_LARGE
JSB_DUPLICATE_REQUEST
JSB_NOT_CONNECTED
JSB_UNSUPPORTED
JSB_CHANNEL_INVALID_ID
JSB_CHANNEL_OPEN_FAILED
```

业务/宿主错误码（`BRIDGE_*` 等）由 `shell360-runtime` 产生，与框架码共用同一错误信封。

## 4. 帧大小限制

默认文本帧上限 **1 MiB**、二进制帧上限 **10 MiB**；各平台可在打开首个 Channel 前覆盖实例
限制。超限返回 `JSB_MESSAGE_TOO_LARGE`。大文件应优先使用文件传输接口（SFTP），不经 Bridge。

## 5. 方法表

方法表唯一来源是 `shell360-runtime::methods::method_specs()`。三端共享的方法族：

- `bridge.health`、`core.healthCheck`；
- `app.getVersion`、`app.setSystemBarsAppearance`、`app.backToBackground`；
- `machineUid.getMachineUid`；
- `clipboard.readText`、`clipboard.writeText`；
- `core.openUrl`；
- `dialog.open`、`dialog.save`；
- `fs.readTextFile`、`fs.writeTextFile`；
- `window.close`；
- `keygen.generate`；
- 24 个 `data.*` 方法；
- 7 个 `ssh.session.*` 方法；
- `ssh.shell.open`、`ssh.shell.send`、`ssh.shell.resize`、`ssh.shell.close`；
- 14 个 `ssh.sftp.*` 方法；
- 6 个 `ssh.portForwarding.*` 方法。

完整方法清单：

```text
bridge.health
core.healthCheck
app.getVersion
app.setSystemBarsAppearance
app.backToBackground
machineUid.getMachineUid
clipboard.readText
clipboard.writeText
core.openUrl
dialog.open
dialog.save
fs.readTextFile
fs.writeTextFile
window.close
keygen.generate
data.checkIsEnableCrypto
data.checkIsInitCrypto
data.checkIsAuthed
data.initCryptoKey
data.initCryptoPassword
data.loadCryptoByPassword
data.initCryptoBiometric
data.loadCryptoByBiometric
data.changeCryptoPassword
data.changeCryptoEnable
data.resetCrypto
data.rotateCryptoKey
data.getHosts
data.addHost
data.updateHost
data.deleteHost
data.getKeys
data.addKey
data.updateKey
data.deleteKey
data.getPortForwardings
data.addPortForwarding
data.updatePortForwarding
data.deletePortForwarding
ssh.session.connect
ssh.session.authenticatePassword
ssh.session.authenticatePublicKey
ssh.session.authenticateCertificate
ssh.session.authenticateKeyboardInteractive
ssh.session.authenticateAgent
ssh.session.disconnect
ssh.shell.open
ssh.shell.send
ssh.shell.resize
ssh.shell.close
ssh.sftp.open
ssh.sftp.close
ssh.sftp.readDir
ssh.sftp.createFile
ssh.sftp.createDir
ssh.sftp.removeFile
ssh.sftp.removeDir
ssh.sftp.rename
ssh.sftp.exists
ssh.sftp.canonicalize
ssh.sftp.readTextFile
ssh.sftp.writeTextFile
ssh.sftp.uploadFile
ssh.sftp.downloadFile
ssh.portForwarding.openLocal
ssh.portForwarding.closeLocal
ssh.portForwarding.openRemote
ssh.portForwarding.closeRemote
ssh.portForwarding.openDynamic
ssh.portForwarding.closeDynamic
```

业务方法名不进入 `jsb-core`；`jsb-core` 构造时只接收允许调用的方法名集合。

## 6. iOS 传输适配

iOS 没有跨 WK 边界的 MessagePort，`JavaScriptBridge.swift` 注入的适配器在**页面内部**自建
`MessageChannel`，Swift 只经 `WKScriptMessage` 中转：

- 文本信封与 Android/HarmonyOS 一致。
- 二进制在 WKScriptMessage 层用 version-1 信封（`version`/`kind`/`channelId`/`payload`）包裹，
  `payload` 为 Base64；对页面 MessagePort 仍呈现 `ArrayBuffer`。
- Base64 与 version/kind 信封仅限 iOS 适配器内部，不进入 `jsb-core` 或公开 invoke JSON。

P0 时期 iOS 与 Android 的若干行为差异（如 UUID 校验、open 失败路径）已在统一迁移中对齐，历史
漂移记录见 `history.md`。
