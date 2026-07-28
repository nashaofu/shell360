# P0：Bridge 消息协议

## 目标

建立 React WebView 与 Android 原生层之间稳定、可扩展、可供未来 iOS 复用的
请求、响应和事件协议，并通过 `bridge/native` 实现现有 `BridgeBackend`。

## 依赖

- [01-android-webview-host.md](./01-android-webview-host.md)

## 协议

请求：

```json
{
  "id": "request-uuid",
  "clientId": "page-uuid",
  "method": "ssh.session.connect",
  "params": {}
}
```

成功响应：

```json
{
  "id": "request-uuid",
  "result": {}
}
```

失败响应：

```json
{
  "id": "request-uuid",
  "error": {
    "code": "SSH_CONNECT_FAILED",
    "message": "Connection refused",
    "details": {}
  }
}
```

事件：

```json
{
  "event": "ssh.shell.data",
  "targetId": "shell-uuid",
  "sequence": 1,
  "payload": {}
}
```

## TypeScript 结构

```text
bridge/src/native/
├── transport.ts
├── error.ts
├── ssh.ts
├── data.ts
├── platform.ts
└── index.ts
```

`NativeTransport` 负责：

- 请求 ID、Promise 和超时管理。
- 响应和事件分发。
- 页面级 `clientId`。
- 页面销毁时拒绝未完成请求。
- Native Bridge 不存在时给出明确启动错误。

各领域适配器只负责把 `BridgeBackend` 方法映射成协议命令，不直接访问 Android
全局对象。

## Android 结构

```text
android/app/src/main/java/com/nashaofu/shell360/bridge/
├── BridgeMessage.kt
├── BridgeError.kt
├── WebViewBridge.kt
├── BridgeRouter.kt
├── RustBridge.kt
└── PlatformBridge.kt
```

- 使用 `WebViewCompat.addWebMessageListener`。
- 仅注册一个 `shell360Native` 消息对象。
- `BridgeRouter` 使用显式命令白名单，不使用反射。
- Rust 命令交给 `RustBridge`，Android 能力交给 `PlatformBridge`。
- 响应和事件必须切回 WebView 主线程发送。

## 生命周期

- 每次页面加载生成新的 `clientId`。
- Native 记录当前页面 generation，丢弃旧页面的响应。
- 页面 reload 或 HMR 后释放旧 `clientId` 拥有的 Session、SFTP 和监听器。
- App 级 Rust 服务不随 Activity 配置变化重复初始化。
- Bridge 初始化完成后发送 `bridge.ready`，前端收到后再渲染依赖 Native 的业务。

## 数据和性能

- 普通调用使用 JSON。
- 第一阶段终端二进制数据使用 Base64。
- Shell 数据按最多 16ms 或 32KB 合并后发送。
- 事件队列必须有界，不能无限占用内存。
- 文件内容不经过 Bridge，只传 file token 和进度事件。
- 单条请求和响应设置大小上限。

## 错误规范

错误码按领域命名：

```text
BRIDGE_*
SSH_*
SFTP_*
DATA_*
CRYPTO_*
FILE_*
PLATFORM_*
```

错误必须保留稳定 `code`，UI 展示使用 `message`，仅调试信息放入 `details`。
Rust panic、Kotlin exception 和 JSON 解析错误都必须转换成协议错误，不能使 WebView
调用永久 pending。

## 实施步骤

1. 定义 TypeScript 和 Kotlin 消息模型。
2. 实现 echo、错误和超时测试命令。
3. 实现 `NativeTransport`。
4. 增加 `bridge/native` Backend 组装入口。
5. 实现页面 reload 和资源释放协议。
6. 增加来源校验、大小限制和命令白名单。

## 验收标准

- 并发请求能够根据 ID 正确返回。
- Native 异常能够在 TypeScript 侧变成带错误码的 Error。
- 页面 reload 后没有遗留 pending Promise 和旧事件。
- 非受信来源无法调用 Bridge。
- 协议模型不包含 Android 或 Tauri 专属类型。
