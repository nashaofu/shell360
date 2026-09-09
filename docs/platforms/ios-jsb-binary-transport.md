# iOS JSB 原生二进制传输方案

> 状态：iOS 宿主代码已实现，等待 macOS/Xcode 编译与 iOS 运行时验证。

## 1. 目标与边界

本方案只调整 `ios/` 下的 WKWebView 宿主适配，不修改：

- `packages/jsb` 前端库及其 `JSBChannel<ArrayBuffer>` 公共接口；
- `crates/jsb-core` 的通道协议和生命周期；
- `crates/shell360-ffi` 的 UniFFI 接口；
- `crates/shell360-runtime` 的 SSH/SFTP 业务实现；
- Android、HarmonyOS 和 Desktop 的传输实现。

目标是删除 iOS JSB 数据通道的 Base64 编解码，让 WebKit 与 Swift 之间直接交换原始二进制：

- JS → Native：`WKURLSchemeHandler` 读取 `fetch` 请求的二进制 body；
- Native → JS：Swift 将二进制帧入队并通知页面，页面通过自定义 Scheme GET 请求取回原始响应；
- 文本、invoke、emit、Channel open/close 仍使用现有 `WKScriptMessageHandler` 控制路径。

## 2. 总体结构

```text
JSBChannel<ArrayBuffer>
  │
  ├─ JS → Native
  │    POST shell360-binary://channel/v1/{channelId}/send
  │    body: ArrayBuffer
  │         │
  │         ▼
  │    IosBinarySchemeHandler
  │         │ Data
  │         ▼
  │    NativeJsb.receiveBinary
  │         ▼
  │    jsb-core / shell360-runtime
  │
  └─ Native → JS
       IosJsbTransport.sendBinary(Data)
            │
            ▼
       IosBinaryChannelStore
            │
            ├─ evaluateJavaScript: notifyBinary(channelId)
            ▼
       GET shell360-binary://channel/v1/{channelId}/receive
            │ application/octet-stream
            ▼
       response.arrayBuffer()
            │
            ▼
       页面内 MessagePort
```

页面内部仍由 `JavaScriptBridge.swift` 注入的适配器创建 `MessageChannel`。因此
`packages/jsb` 看到的依然是标准 `MessagePort` 和 `ArrayBuffer`，无需感知 iOS URL Scheme。

## 3. 传输接口

自定义 Scheme 固定为：

```text
shell360-binary
```

### 3.1 JS → Native

```http
POST shell360-binary://channel/v1/{channelId}/send
Content-Type: application/octet-stream

<raw binary body>
```

处理流程：

1. iOS 注入脚本监听页面内 `MessagePort`；
2. 对 `ArrayBuffer` 或 `ArrayBufferView` 取得精确字节区间；
3. 同一 Channel 的 POST 使用 Promise 链串行发送，保持帧顺序；
4. `IosBinarySchemeHandler` 从 `URLRequest.httpBody` 或 `httpBodyStream` 读取 `Data`；
5. 调用现有 `NativeJsb.receiveBinary(channelId:bytes:)` 进入 Rust；
6. 成功返回 `204`，失败返回对应状态码并在页面端触发 `messageerror`。

Channel 关闭操作会等待已进入发送链的 POST 完成，再通过文本控制路径发送
`channel.close`，避免关闭消息越过尚未处理的二进制帧。

### 3.2 Native → JS

Rust 继续调用现有 `JsbTransport.sendBinary(channelId:data:)`。iOS 适配器执行：

1. 将 `Data` 放入 `IosBinaryChannelStore` 对应 Channel 的 FIFO 队列；
2. 队列从空变为非空时，通过 `evaluateJavaScript` 调用
   `window.__JSB__.notifyBinary(channelId)`；
3. 页面收到通知后发起 GET：

```http
GET shell360-binary://channel/v1/{channelId}/receive
```

4. Handler 每次从 FIFO 取出一个完整帧，以 `application/octet-stream` 返回；
5. 页面调用 `response.arrayBuffer()`，再将 buffer 转移给对应 MessagePort；
6. 页面连续 GET，直到收到 `204`，表示当前队列已排空。

通知只表示“队列中可能有数据”，不携带二进制内容。多个通知可以合并；接收循环使用重入保护，
避免同一 Channel 同时启动多个 drain。

## 4. 控制路径保持不变

以下消息仍通过 `window.webkit.messageHandlers.shell360Native` 传递字符串：

- `channel.open`；
- `channel.close`；
- `invoke.request` / `invoke.response`；
- `emit`；
- `channel.opened` / `channel.open.failed` / `channel.closed`。

自定义 Scheme 只承载 data Channel 的原始二进制，不承载 JSON invoke 消息，也不增加业务方法。

## 5. iOS 组件职责

### `JavaScriptBridge.swift`

- 保持 `window.__JSB__.openChannel/closeChannel` 接口；
- 维护页面内 MessageChannel；
- 将二进制上行转换为自定义 Scheme POST；
- 响应 Native 的 `notifyBinary` 并循环 GET；
- 将响应的 `ArrayBuffer` 转移到 MessagePort；
- 不再包含 `btoa`、`atob` 或 Base64 信封。

### `IosBinarySchemeHandler.swift`

- 实现 `WKURLSchemeHandler`；
- 只接受 `shell360-binary://channel/v1/...`；
- 处理 `POST send`、`GET receive` 和 `OPTIONS`；
- 读取请求 body，并以原始 `Data` 返回响应；
- 校验路由、请求方法和帧大小；
- 将上行数据交给现有 `NativeJsb.receiveBinary`。

### `IosBinaryChannelStore.swift`

- 维护 `channelId -> FIFO<Data>`；
- 使用锁保护 Rust 回调线程、WebKit 请求线程和主线程之间的并发访问；
- 管理 Channel open、close 和全量清理；
- 限制单帧和单 Channel 排队容量；
- 队列从空变为非空时决定是否需要通知页面。

### `WebViewContainer.swift`

- 在创建 WKWebView 时注册 `IosBinarySchemeHandler`；
- 将 Store 同时交给 Scheme Handler 和 `IosJsbTransport`；
- Channel 打开时创建队列，关闭或导航时清理队列；
- WebView 销毁时解除 NativeJsb 引用并清理全部数据。

### `IosJsbTransport`

- 文本继续通过主线程 `evaluateJavaScript` 投递；
- 二进制不再构造 JSON/Base64 信封；
- 二进制帧写入 Store 后只向页面发送就绪通知；
- 队列拒绝帧时通过现有 UniFFI `FfiError` 向 Rust 返回失败。

## 6. 顺序、并发与背压

### 顺序

- JS → Native：每个 Channel 独立 Promise 链，单 Channel 串行、跨 Channel 可并行；
- Native → JS：每个 Channel 独立 FIFO，一次 GET 返回一个完整帧；
- Channel close 等待当前 JS 上行发送链完成。

### 并发

- Store 使用 `NSLock`，不假设 `WKURLSchemeHandler` 回调线程；
- `WKWebView.evaluateJavaScript` 始终切换到主线程；
- Rust 回调只负责入队，不等待页面完成 GET。

### 限制

- 单帧最大值：10 MiB，与 JSB 默认二进制帧限制一致；
- 单 Channel 最大排队字节：20 MiB；
- 超限、Channel 已关闭或队列已满时拒绝帧，不静默丢弃。

## 7. 生命周期

### 打开

1. 页面调用现有 `openChannel(channelId)`；
2. iOS 创建页面内 MessageChannel；
3. Swift 注册对应二进制队列；
4. Swift 调用现有 `NativeJsb.openChannel`。

### 关闭

1. 页面停止接收并关闭 MessagePort；
2. 等待该 Channel 已排队的 POST 完成；
3. 发送原有 `channel.close` 控制消息；
4. Swift 删除二进制队列并调用 `NativeJsb.closeChannel`。

### 导航与销毁

- provisional navigation 开始时关闭所有已打开 Channel；
- WebView dismantle 时解除 Scheme Handler 的 NativeJsb 引用；
- 清空所有二进制队列；
- 释放 Transport、HostServices 和 WebView 引用。

## 8. 状态码

| 状态码 | 含义 |
| --- | --- |
| `200` | GET 成功返回一个二进制帧 |
| `204` | POST 已处理，或 GET 时队列暂时为空 |
| `404` | 路由无效或 Channel 不存在 |
| `405` | 请求方法与端点不匹配 |
| `413` | 请求体超过 10 MiB 或无法安全读取 |
| `500` | `NativeJsb.receiveBinary` 处理失败 |
| `503` | NativeJsb 尚未挂载或已经释放 |

响应统一设置 `Cache-Control: no-store`，避免 WebKit 缓存二进制 Channel 数据。

## 9. 安全约束

- 只注册 `shell360-binary` 自定义 Scheme；
- Host 必须为 `channel`，版本必须为 `v1`；
- action 只能是 `send` 或 `receive`；
- Channel 必须先通过现有控制路径打开；
- URL 不接受本地文件路径和任意资源定位；
- 单帧大小在进入 Rust 前再次限制；
- 自定义 Scheme 不加入外部导航 allowlist。

## 10. 验证计划

### 已完成的静态验证

- iOS 目录已无 `btoa`、`atob`、`base64EncodedString` 和 `Data(base64Encoded:)`；
- 注入 JavaScript 已通过语法解析；
- 当前修改未触及 `packages/jsb`、`crates/jsb-core`、`crates/shell360-ffi` 或
  `crates/shell360-runtime`；
- `git diff --check` 通过。

### macOS/Xcode 必测

1. Debug 模拟器编译；
2. Release device archive 编译；
3. `fetch` POST 的 `ArrayBuffer` 能从 `httpBody` 或 `httpBodyStream` 完整读取；
4. GET 的 `application/octet-stream` 能被 `response.arrayBuffer()` 原样接收；
5. 0 字节、1 字节、1 MiB 和 10 MiB 帧逐字节一致；
6. 同一 Channel 连续帧不乱序；
7. 多 SSH 会话互不串流；
8. 页面刷新、Channel 重开和 WebView 销毁后无旧数据泄漏；
9. 前后台切换后可以继续收发；
10. 高频 SSH 输出下队列有界且无静默丢帧。

### 验收标准

- iOS JSB 二进制路径完全不使用 Base64；
- 前端继续收到 `ArrayBuffer`，无调用方改动；
- Rust 继续收到和发送 `Vec<u8>`，无接口改动；
- 单 Channel 帧顺序稳定；
- Channel 关闭和页面导航可以完整释放队列；
- Xcode 构建、模拟器和真机链路分别留下验证证据。

## 11. 风险与回退

主要风险是目标 iOS/WebKit 版本对自定义 Scheme `fetch`、POST body 和二进制响应的实际行为。
Windows 静态检查不能替代这部分验证。

如果 Xcode 或真机证明 WebKit 不稳定支持该路径，应回退本次 iOS 宿主改动，再评估本地 WebSocket；
不能通过修改 `packages/jsb` 或 Rust 业务接口绕过平台问题，也不应重新把 Base64 扩散到公共协议。
