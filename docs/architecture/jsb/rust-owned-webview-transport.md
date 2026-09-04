# Rust JSB 直连 WebView 通道技术方案

> 状态：已落地（Rust + Android + iOS 代码 + HarmonyOS 代码已完成；Android 构建、iOS/Xcode 与 HarmonyOS 真机验证未在当前环境执行）  
> 适用范围：Android、iOS、HarmonyOS 原生 WebView 宿主  
> 目标：由 Rust `jsb-core` 直接管理 JSB 协议与通道收发，同时保持 `jsb-core` 为零业务逻辑的通用框架。

## 1. 背景

迁移前的移动端 JSB 已将协议状态和业务调度收敛到 Rust，但 Rust 与 WebView 之间采用“计算输出、平台执行”的两段式模型（该模型已随本方案删除）：

```text
WebView MessagePort
  -> 平台层接收文本或二进制
  -> NativeJsbEngine / jsb_engine_* 调用 jsb-core
  -> Vec<EngineOutput>
  -> Kotlin / Swift / ArkTS 遍历并解释 EngineOutput
  -> 平台层写回 MessagePort
```

该模型存在以下问题：

1. `Engine` 是实现视角的抽象，与 TypeScript `jsb` 库的 `JSB`、`invoke`、`emit`、`JSBChannel` 术语不一致。
2. `EngineOutput` 不是前端业务返回值，而是要求平台继续执行的中间指令，容易产生误解。
3. 三个平台都需要维护输出类型转换、序列化和 `executeOutputs` 分支。
4. Rust 只负责“算出下一步”，并未真正接管 JSB 通道的发送生命周期。
5. HostCall 混在核心输出中，但在 FFI 层又被 callback 消费，核心输出与平台可见输出并不等价。

本方案删除输出列表模式。`jsb-core` 通过平台注入的通用传输接口直接收发 WebView 消息，通过注入的调用接口将具体方法交给 `shell360-runtime` 实现。

## 2. 设计原则

### 2.1 `jsb-core` 只实现 JSB 框架

`jsb-core` 负责：

- JSB Channel 生命周期；
- `invoke.request` 解析、校验和 request ID 生命周期；
- `invoke.response` 序列化和发送；
- `emit` 消息序列化和发送；
- 文本与二进制帧的大小限制；
- client ID 生命周期；
- pending invoke 的完成、拒绝和取消；
- 调用外部注入的通用方法处理接口；
- 调用外部注入的 WebView 传输接口。

`jsb-core` 不负责：

- `ssh.*`、`data.*`、`fs.*`、`dialog.*` 等具体方法；
- SSH shell、SFTP 或数据库实现；
- `(clientId, sshShellId) -> dataChannelId` 等业务绑定；
- scoped URI、staging path 或文件策略；
- 剪贴板、生物识别、系统栏、打开 URL 等具体平台原语；
- Android、iOS、HarmonyOS WebView API 的具体调用。

`jsb-core` 中不得出现业务方法名、业务 ID、宿主原语名或按业务方法分支的逻辑。

### 2.2 Rust 接管 JSB，不接管平台 WebView API

Rust 负责决定何时打开、发送、失败和关闭 JSB Channel，但具体 WebView API 仍由平台实现。

平台向 Rust 提供最小传输能力，Rust 不使用 `cfg(android)`、`cfg(ios)` 或 `cfg(harmonyos)` 直接依赖平台 SDK。这样 `jsb-core` 仍可独立测试和复用。

### 2.3 TypeScript `jsb` 是协议术语来源

Rust 与 TypeScript 使用相同的核心概念：

| TypeScript `jsb` | Rust `jsb-core` | 含义 |
| --- | --- | --- |
| `JSB` | `Jsb` | JSB 实例 |
| `JSBChannel` | Channel 状态（`jsb.rs` 内部结构，不公开） | 文本或二进制通道 |
| `JSBInvokeRequest` | `JsbInvokeRequest`（`id`/`method`/`params_json`） | `invoke.request` 消息 |
| `JSBInvokeResponse` | 无公开类型；`jsb.rs` 内部序列化响应/错误帧 | `invoke.response` 消息 |
| `JSBEmitMessage` | 无公开类型；`emit(message_json)` 只寻址 control channel | 主动事件消息 |
| `JSBErrorPayload` | `JsbErrorPayload`（`code`/`message`/`details`） | 协议错误结构 |
| `invoke()` | `JsbHandler::invoke(..)` + `JsbInvokeCompletion` | JSB 方法调用语义 |
| `openChannel()` | `open_channel()` | 打开 Channel |
| `closeChannel()` | `close_channel()` | 关闭 Channel |

Rust 遵循 Rust 命名约定使用 `Jsb`，TypeScript 继续使用 `JSB`。

## 3. 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│ bridge (TypeScript)                                          │
│ ssh/data/fs/... 的类型安全业务 API                           │
└──────────────────────────────┬───────────────────────────────┘
                               │ jsb.invoke(method, data)
┌──────────────────────────────▼───────────────────────────────┐
│ jsb (TypeScript，纯框架)                                     │
│ JSB · JSBChannel · invoke.request/response · emit            │
└──────────────────────────────┬───────────────────────────────┘
                               │ MessagePort string/ArrayBuffer
┌──────────────────────────────▼───────────────────────────────┐
│ 平台 WebView Transport（薄适配）                             │
│ Android WebMessagePort / iOS WKScriptMessage / ArkWeb Port   │
└──────────────────────────────┬───────────────────────────────┘
                               │ receive_text / receive_binary
┌──────────────────────────────▼───────────────────────────────┐
│ jsb-core (Rust，纯框架)                                      │
│ Jsb · 协议 · Channel · pending invoke · JsbTransport         │
└───────────────┬──────────────────────────────┬───────────────┘
                │ JsbHandler::invoke           │ transport.send_*
                ▼                              ▼
┌──────────────────────────────┐   ┌───────────────────────────┐
│ shell360-runtime             │   │ 平台 WebView Transport    │
│ 方法表与全部业务实现         │   │ 直接把响应写回 MessagePort│
└───────────────┬──────────────┘   └───────────────────────────┘
                │ 必要的平台能力
                ▼
┌──────────────────────────────┐
│ Shell360 HostServices        │
│ 各平台系统能力实现           │
└──────────────────────────────┘
```

关键变化是：`jsb-core` 的入口返回 `Result<(), JsbError>`，响应由 Rust 直接通过 `JsbTransport` 发出，不再返回 `EngineOutput`、`JsbOutput` 或 `JsbOperation`。

## 4. 核心接口设计

以下代码用于说明职责和方向，最终签名可根据 UniFFI、N-API 和线程模型调整。

### 4.1 `JsbTransport`

`JsbTransport` 是 `jsb-core` 操作 WebView JSB Channel 的唯一出口：

```rust
pub trait JsbTransport: Send + Sync {
  fn open_channel(
    &self,
    channel_id: &str,
    control_message: &str,
  ) -> Result<(), JsbTransportError>;

  fn fail_channel(
    &self,
    channel_id: &str,
    control_message: &str,
  ) -> Result<(), JsbTransportError>;

  fn send_text(
    &self,
    channel_id: &str,
    message: &str,
  ) -> Result<(), JsbTransportError>;

  fn send_binary(
    &self,
    channel_id: &str,
    data: &[u8],
  ) -> Result<(), JsbTransportError>;

  fn close_channel(
    &self,
    channel_id: &str,
  ) -> Result<(), JsbTransportError>;
}
```

接口只包含通用 Channel 操作，不包含 Shell360 方法、SSH 或平台业务能力。

### 4.2 `JsbHandler`

`JsbHandler` 是 `jsb-core` 调用具体 JSB 方法实现的唯一入口：

```rust
pub trait JsbHandler: Send + Sync {
  fn invoke(
    &self,
    context: JsbInvokeContext,
    request: JsbInvokeRequest,
    completion: Arc<dyn JsbInvokeCompletion>,
  );

  fn receive_binary(
    &self,
    context: JsbChannelContext,
    data: Vec<u8>,
  ) -> Result<(), JsbHandlerError>;

  fn close_channel(&self, context: JsbChannelContext);

  fn release_client(&self, client_id: String);
}
```

其中上下文只包含 JSB 通用标识：

```rust
pub struct JsbInvokeContext {
  pub client_id: String,
  pub channel_id: String,
}

pub struct JsbChannelContext {
  pub client_id: String,
  pub channel_id: String,
}

pub struct JsbInvokeRequest {
  pub id: String,
  pub method: String,
  pub params_json: String, // 已序列化的请求 data，缺省为 "null"
}

pub struct JsbHandlerError {
  pub code: String,
  pub message: String,
}
```

上下文中不得增加 `ssh_shell_id`、`ssh_sftp_id` 等业务字段。`receive_binary`
的错误只用于通道拆除诊断：二进制帧没有 request id 可以回复，业务错误由
`shell360-runtime` 通过关闭 SSH/通道等业务手段处理。

### 4.3 异步完成接口

具体方法可能同步完成，也可能等待 Rust 异步任务或平台能力。`jsb-core` 通过 completion 保持 pending request 生命周期：

```rust
pub trait JsbInvokeCompletion: Send + Sync {
  fn resolve(&self, data_json: String);
  fn reject(&self, error: JsbErrorPayload);
}
```

completion 由 `jsb-core` 创建，内部绑定：

- `client_id`；
- `channel_id`；
- request ID；
- 请求是否仍处于 pending；
- 对应 `JsbTransport`。

`resolve` 或 `reject` 只能成功一次。Channel 已关闭、client 已释放或请求已取消时，后续完成必须安全忽略并释放资源。

该接口让 `jsb-core` 不需要理解 Shell360 当前的 HostCall continuation。平台原语协调可以在 `shell360-runtime`、`shell360-ffi` 和平台 `HostServices` 中完成，最终只调用 completion。

### 4.4 `Jsb`

```rust
pub struct Jsb {
  transport: Arc<dyn JsbTransport>,
  handler: Arc<dyn JsbHandler>,
  methods: HashSet<String>,
  // Channel、client 和 pending invoke 状态
}

impl Jsb {
  pub fn new(
    transport: Arc<dyn JsbTransport>,
    handler: Arc<dyn JsbHandler>,
    methods: impl IntoIterator<Item = impl Into<String>>,
  ) -> Self;

  pub fn client_id(&self) -> Option<String>;

  pub fn open_channel(&self, channel_id: String) -> Result<(), JsbError>;

  pub fn close_channel(&self, channel_id: String) -> Result<(), JsbError>;

  pub fn channel_open_failed(
    &self,
    channel_id: String,
    reason: String,
  ) -> Result<(), JsbError>;

  pub fn receive_text(
    &self,
    channel_id: String,
    text: String,
  ) -> Result<(), JsbError>;

  pub fn receive_binary(
    &self,
    channel_id: String,
    data: Vec<u8>,
  ) -> Result<(), JsbError>;

  /// `message` 是已序列化的 `emit` 信封 JSON；core 只校验并寻址 control
  /// Channel，不构造业务事件。
  pub fn emit(&self, message: String) -> Result<(), JsbError>;

  pub fn send_binary(
    &self,
    channel_id: String,
    data: Vec<u8>,
  ) -> Result<(), JsbError>;

  /// 取消全部 pending invoke，通知 handler 释放 client，并要求 transport
  /// 关闭所有 Channel。锁外完成全部回调。
  pub fn shutdown(&self) -> Result<(), JsbError>;
}
```

`JsbError` 只覆盖无法作为帧投递的传输/状态失败（`NotConnected`、
`MessageTooLarge`、`Transport(JsbTransportError)`、`LockPoisoned`）；协议错误
（非法 JSON、未注册方法、重复 request id 等）一律作为 `invoke.response` 错误帧
通过 transport 发回页面，不作为入口错误返回。

文本帧在锁内解析并分类，随后在锁外调用 handler/transport，必要时再次短暂持锁
提交结果；completion 内部用 `AtomicBool` 保证 `resolve`/`reject`/`cancel` 只有
一个生效。

## 5. 消息流

### 5.1 普通 invoke

```text
TS JSB.invoke("app.getVersion")
  -> JSBChannel.postMessage(invoke.request)
  -> 平台 MessagePort callback
  -> NativeJsb.receiveText(channelId, text)
  -> Jsb::receive_text
  -> 解析 JsbInvokeRequest
  -> Jsb::invoke
  -> Shell360JsbHandler::invoke
  -> completion.resolve(data)
  -> Jsb 构造 invoke.response
  -> JsbTransport::send_text
  -> MessagePort.postMessage
  -> TS Promise resolve
```

### 5.2 Rust 主动事件

```text
shell360-runtime event sink
  -> NativeJsb.emit(event_json) / Jsb::emit(message)
  -> 校验并定位 control channel
  -> JsbTransport::send_text
  -> TS JSB.on/once listener
```

`jsb-core` 只认识通用 `emit` 信封，不认识具体事件名。

### 5.3 二进制 Channel

前端到 Rust：

```text
JSBChannel<ArrayBuffer>.postMessage
  -> 平台 MessagePort callback
  -> Jsb::receive_binary(channelId, bytes)
  -> JsbHandler::receive_binary(JsbChannelContext { client_id, channel_id }, data)
  -> shell360-runtime 根据自己的业务绑定处理
```

Rust 到前端：

```text
shell360-runtime 查找业务对象对应的 channelId
  -> Jsb::send_binary(channelId, bytes)
  -> 校验 Channel 和帧大小
  -> JsbTransport::send_binary
  -> JSBChannel<ArrayBuffer> message
```

`(clientId, sshShellId) -> dataChannelId` 继续由 `shell360-runtime` 管理；`jsb-core` 只校验通用 `channelId`。

### 5.4 平台能力与异步完成

```text
JsbHandler::invoke
  -> shell360-runtime 判断需要平台能力
  -> Shell360 HostServices callback
  -> Kotlin / Swift / ArkTS 执行系统能力
  -> shell360-runtime 恢复业务调用
  -> completion.resolve/reject
  -> jsb-core 直接发送 invoke.response
```

HostCall、continuation、staging 等均不是 JSB 协议概念，不进入 `jsb-core` 公共模型。

## 6. 平台适配

### 6.1 Android

保留一个薄的 `JsbPortBridge` 或改名为 `AndroidJsbTransport`，负责：

- 创建和转交 `WebMessagePortCompat`；
- 保存 `channelId -> WebMessagePortCompat` 的平台句柄；
- 将 string/ArrayBuffer 原样送入 `NativeJsb.receiveText/receiveBinary`；
- 实现 Rust `JsbTransport` callback；
- 在主线程调用 WebView/MessagePort API；
- 关闭和释放端口。

删除：

- `NativeEngineOutput` / `NativeEngineOutputKind`；
- `dispatchOutputs` / `executeOutputs` / `executeOutput`；
- 对输出 kind 的 `when` 分支。

### 6.2 iOS

保留 WKWebView 传输适配器，负责：

- document-start JSB 注入；
- WKScriptMessage 收发；
- string/binary 信封适配；
- 实现 `JsbTransport` callback；
- 确保 WebKit 调用位于主线程。

Base64 仅可存在于 iOS WKScriptMessage 二进制传输适配器内部，不进入 `jsb-core`、公开 invoke JSON 或其他平台。

删除 Swift 对 `NativeEngineOutput` 的遍历和解释。

### 6.3 HarmonyOS

保留 `MessagePortBridge` 或改名为 `HarmonyJsbTransport`，负责：

- ArkWeb MessagePort 创建和转交；
- string/ArrayBuffer 收发；
- 实现 N-API 传输 callback；
- 在正确的 ArkUI 线程执行 WebView 操作；
- 端口释放。

OHRS 不再把 Rust 输出序列化成 JSON 数组，删除 `serialize_engine_outputs`。ArkTS 不再解析和执行输出数组。

## 7. FFI 设计与线程约束

### 7.1 UniFFI（`shell360-ffi`，Kotlin/Swift）

最终生成的绑定表面：

```text
interface FfiEventSink {            // 业务事件 sink（运行时构造时注入）
  onEvent(eventJson: String)
  onSshShellData(clientId, sshShellId, data: ByteArray)
}

interface HostServices {           // 平台能力异步边界
  onHostCall(callId, primitive, paramsJson)
}

interface JsbTransport {           // Rust -> WebView，infallible
  openChannel(channelId, controlMessage)
  failChannel(channelId, controlMessage)
  sendText(channelId, message)
  sendBinary(channelId, data: ByteArray)
  closeChannel(channelId)
}

object Shell360Runtime {
  constructor(appDataDir, cacheDir, eventSink)
  shutdown()
}

object NativeJsb {
  constructor(runtime, transport, hostServices)
  openChannel / closeChannel / channelOpenFailed
  receiveText / receiveBinary
  emit / sendBinary / pushShellBinary
  completeHostCall(callId, resultJson)   // infallible
  shutdown() / registeredMethods(): List<String>
}
```

`JsbTransport` callback 在 UniFFI 边界声明为 infallible：平台端口失败由平台
自行恢复（回写 `channelOpenFailed` 或关闭 Channel），FFI 内部的
`FfiJsbTransport` 适配器始终返回 `Ok`。除 `completeHostCall` 外，
`NativeJsb` 所有入口返回 `Result<Unit, FfiError>`，不返回输出集合。
旧的直连入口（`invoke`/`invokeKeygen`/`invokeData`/`invokeSsh`/
`releaseClient`/`sendSshShellData`/`healthCheck` 等）已从绑定中删除。

### 7.2 OHRS / N-API（`shell360_ohrs`，ArkTS）

最终导出：

```text
initializeRuntime(appDataDir, cacheDir) / shutdown()
attachEventCallback / attachSshShellDataCallback
attachHostCallCallback / attachJsbTransportCallback
initializeJsb()

interface JsbTransportEvent {       // #[napi(object)]
  op: "openChannel" | "failChannel" | "sendText" | "sendBinary" | "closeChannel"
  channelId: string
  text?: string
  data?: number[]                   // 二进制保持二进制，不经 JSON/Base64
}

jsbOpenChannel / jsbCloseChannel / jsbChannelOpenFailed
jsbReceiveText / jsbReceiveBinary
jsbCompleteHostCall
jsbEmit / jsbSendBinary / jsbPushShellBinary
```

`attachJsbTransportCallback` 注册 ThreadsafeFunction；Rust 端
`OhrsJsbTransport` 实现 `shell360_ffi::JsbTransport`，把每个操作包成
`JsbTransportEvent` 经 ThreadsafeFunction 投递，ArkTS 在 JS 线程串行执行
WebView 操作。旧的 `invoke`/`release_client`/`send_ssh_shell_data`/
`health_check` 直连导出已删除。

### 7.3 禁止锁内跨 FFI 回调

`Jsb` 状态需要同步保护，但不得在持有状态锁时调用：

- `JsbTransport`；
- `JsbHandler`；
- `JsbInvokeCompletion` 的外部业务逻辑；
- 任意 UniFFI 或 N-API callback。

推荐流程：

1. 短暂持锁读取或更新 JSB 状态；
2. 释放锁；
3. 调用 handler 或 transport；
4. 必要时再次短暂持锁提交结果。

这样避免平台回调重入、主线程切换和 completion 同步完成造成死锁。

### 7.4 顺序保证

同一 `channelId` 上必须保持以下顺序：

- `channel.opened` 先于该 Channel 的普通消息；
- 同一次处理产生的响应和后置事件顺序可预测；
- `close_channel` 后不再发送文本或二进制；
- completion 与 Channel close 竞争时最多发送一次最终响应；
- Transport 线程切换不能重排同一 Channel 的消息。

如果平台 callback 本身不能保证顺序，应在平台 transport 中使用单线程队列或主线程队列串行执行。

## 8. 错误模型

错误分为三层：

1. **协议错误**：非法 JSON、缺少 ID、重复请求、消息过大、方法不可用。由 `jsb-core` 构造 `JsbInvokeResponse::Error` 并直接发回前端。
2. **方法错误**：由 `JsbHandler` 或 completion 返回 `JsbErrorPayload`，`jsb-core` 只负责封装响应。
3. **Transport 错误**：WebView port 不存在、线程调度失败或发送失败。转换为 `JsbTransportError`，触发 Channel 清理和 pending 请求取消；不能伪装为具体业务错误。

错误码来源仍由 Shell360 Rust 业务层维护。`jsb-core` 只维护通用 JSB 框架错误码，例如：

```text
JSB_INVALID_MESSAGE
JSB_MESSAGE_TOO_LARGE
JSB_DUPLICATE_REQUEST
JSB_NOT_CONNECTED
JSB_UNSUPPORTED
JSB_CHANNEL_INVALID_ID
JSB_CHANNEL_OPEN_FAILED
```

## 9. crate 与模块边界

建议的 `jsb-core` 结构：

```text
crates/jsb-core/src/
├── lib.rs          # 公开导出（无业务名、无 cfg(platform)、无 uniffi/napi 依赖）
├── jsb.rs          # Jsb 状态、公开入口与短锁调度
├── protocol.rs     # invoke/emit/channel 信封序列化与 JsbErrorPayload
├── handler.rs      # JsbHandler、JsbInvokeCompletion 与通用上下文
└── transport.rs    # JsbTransport 与 JsbTransportError
```

`jsb-core` 的 Cargo 依赖保持通用，不依赖：

- `shell360-runtime`；
- `shell360-ssh`；
- `shell360-store`；
- UniFFI；
- napi-ohos；
- Android、iOS 或 HarmonyOS SDK。

依赖方向：

```text
shell360-runtime -> jsb-core
shell360-ffi     -> jsb-core + shell360-runtime
shell360_ohrs    -> jsb-core + shell360-runtime
jsb-core         -> 通用 serde/uuid 等基础依赖
```

## 10. 命名调整

删除所有 JSB 领域中的 `Engine` 和输出列表命名（已全部落地）：

| 迁移前 | 迁移后 |
| --- | --- |
| `JsbEngine` | `Jsb` |
| `NativeJsbEngine` | `NativeJsb` |
| `EngineErrorPayload` | `JsbErrorPayload` |
| `EngineOutput` | 删除 |
| `NativeEngineOutput` | 删除 |
| `NativeEngineOutputKind` | 删除 |
| `engine.rs` | `jsb.rs` |
| `initialize_jsb_engine` | `initialize_jsb` |
| `jsb_engine_*` | `jsb_*` |
| `createJsbEngine` | `createJsb` |
| 局部变量 `engine` | `jsb` |

不得为了替换名称而新增同义的 `JsbOutput`、`JsbOperation` 或 `JsbCommand`。目标模型没有需要平台解释的返回列表。依赖库中无关的 `base64::Engine`（SSH shell 发送路径）不在改名范围内。

## 11. 分阶段迁移

### 阶段 A：建立直连接口，不改业务路由

1. 在 `jsb-core` 增加 `JsbTransport`、`JsbHandler` 和 completion 抽象。
2. 将 `JsbEngine` 重命名为 `Jsb`。
3. 保持现有协议、方法允许集、错误 JSON 和事件格式不变。
4. 为内存 Transport 编写完整单元测试。
5. 暂不删除旧输出模式，使用测试或 feature 隔离验证新路径。

验收：纯 Rust 测试能证明 `receive_text -> handler -> completion -> transport.send_text` 完整闭环。

### 阶段 B：迁移 Android

1. UniFFI 增加 `JsbTransport` callback 和 `NativeJsb`。
2. Android `JsbPortBridge` 实现 transport。
3. 删除 Android `executeOutputs` 路径。
4. 重新生成 UniFFI Kotlin bindings。
5. 验证 control、emit、HostServices、SSH binary 和关闭生命周期。

Android 先作为单平台试点；本阶段不同时改 iOS/HarmonyOS 的宿主实现。

### 阶段 C：迁移 iOS

1. 重新生成 Swift bindings。
2. WKWebView adapter 实现 transport。
3. 删除 Swift 输出解释逻辑。
4. 验证 iOS string/binary 回环及主线程约束。

### 阶段 D：迁移 HarmonyOS

1. OHRS 注册 transport callback。
2. ArkTS MessagePortBridge 改为 callback 驱动。
3. 删除输出 JSON 数组序列化与解释。
4. 验证 string/ArrayBuffer、HostServices 与生命周期。

### 阶段 E：清理旧模型

三端全部迁移后：

1. 删除 `EngineOutput`、`NativeEngineOutput` 及 kind；
2. 删除 `InvokeFlow::Delegate`、`HostAction`、`HostCallResult` 等已被 runtime completion 替代的核心机制；
3. 删除 `complete_host_call` 的 JSB core API；
4. 清理 `engine` 命名、旧 N-API 导出和生成绑定；
5. 更新现有 ADR、layering 和 unification 文档。

阶段 E 不得早于三端迁移完成，避免维护两套不完整路径。

### 落地状态

- 阶段 A（`jsb-core` 直连接口与纯 Rust 测试）：已完成。28 个单元测试 + golden 协议测试全部通过。
- 阶段 B（Android）：代码已完成，`JsbPortBridge` 实现 `JsbTransport`，`executeOutputs`/`NativeEngineOutput` 已删除；已通过宿主 bindgen 生成 Kotlin 绑定并核对 `NativeJsb`/`JsbTransport` API（绑定由 Gradle 任务在构建时重新生成，禁止手改）。Gradle 构建与 instrumented 测试因当前环境无 Android SDK 未执行。
- 阶段 C（iOS）：代码已完成，`IosJsbTransport` 在 `DispatchQueue.main` 上投递，Base64 仅存在于 WKScriptMessage 二进制适配器；Swift 输出解释已删除。Swift 绑定在 macOS 上由 `scripts/ios/commands/build-native.ts` 重新生成，Xcode 编译与真机验证因当前环境为 Windows 未执行。
- 阶段 D（HarmonyOS）：代码已完成，`OhrsJsbTransport`（Rust）+ `JsbTransportEvent` ThreadsafeFunction + `MessagePortBridge.ets` callback 驱动，输出 JSON 数组已删除。`cargo check -p shell360_ohrs` 通过；hvigor/ohpm 构建与真机验证因当前环境限制未执行。
- 阶段 E（清理）：已完成。`EngineOutput`/`NativeEngineOutput`/kind、旧 `invoke`/`release_client`/`send_ssh_shell_data` 直连导出均已删除；`complete_host_call` 不再存在于 `jsb-core`（仅作为 `shell360-runtime` 的 RuntimeInvoker 与 FFI `NativeJsb` 平台入口存在）；全仓搜索确认 JSB 领域无 `JsbEngine`/`EngineOutput`/`NativeEngineOutput`/`jsb_engine_*`/`executeOutputs` 残留。

## 12. 兼容性要求

本重构不得改变：

- `window.__JSB__`；
- `JSB -> JSBChannel -> window.__JSB__` 的前端结构；
- `invoke.request` / `invoke.response` / `emit` JSON 格式；
- Channel control message 格式；
- 错误码、错误 message 和 details 结构；
- string control Channel 与独立 binary Channel 的分离；
- iOS Base64 仅限 WKScriptMessage 适配器的约束；
- `bridge/*` 对业务代码暴露的接口；
- 现有具体方法名和方法返回值；
- Shell360 runtime 对 SSH、SFTP、data 等业务的所有权。

该方案是内部架构迁移，不要求前端 JSB 调用方改代码。

## 13. 测试与验证

### 13.1 `jsb-core` 单元测试

使用 `FakeTransport` 和 `FakeHandler` 覆盖：

- Channel open/open failed/close；
- UUID 校验；
- 普通 invoke 成功和失败；
- 异步 completion；
- completion 只能完成一次；
- 重复 request ID；
- malformed JSON；
- 未注册方法；
- 文本和二进制 1 MiB 限制；
- emit 只发送到 control Channel；
- Channel 关闭时取消 pending invoke；
- close 与 completion 并发；
- Transport 失败后的资源释放；
- binary 数据不经过 JSON 或 Base64。

保留并更新 current protocol golden test，证明线上协议字节不变。

### 13.2 平台静态与构建验证

- Rust：受影响 crate 执行格式化、测试和 Clippy；
- UniFFI：重新生成 Kotlin/Swift bindings，并证明旧类型不存在；
- Android：Kotlin 编译和 debug/release 构建；
- iOS：在 macOS/Xcode 环境编译；
- HarmonyOS：OHRS、HAR/HAP 和 ArkTS 构建；
- TypeScript：`jsb`、`bridge`、`mobile` 类型检查与 Biome。

### 13.3 真机验证

每个平台至少验证：

1. WebView 初始化和 control Channel 打开；
2. 一个纯 Rust invoke；
3. 一个需要平台能力的异步 invoke；
4. Rust 主动 emit；
5. SSH shell 双向原始二进制；
6. 多个并行 Channel；
7. 页面销毁、应用退后台和 runtime shutdown；
8. Transport 失败时有可诊断日志且不崩溃。

构建通过不能替代真机字节链路验证。

## 14. 可观测性

建议在 FFI/平台 transport 边界保留结构化诊断信息：

```text
platform
direction: webview->rust | rust->webview
channelId
messageType: text | binary | open | close | failed
byteLength
requestId（仅可安全解析时）
errorCode
```

不得记录密码、密钥、终端正文、文件内容或完整业务参数。未绑定 Channel、发送到已关闭 Channel、线程调度失败和 Transport callback 丢失不能静默忽略。

## 15. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| Rust 持锁调用平台 callback | 重入或死锁 | 严格禁止锁内跨 FFI 调用 |
| callback 线程不符合 WebView 要求 | 崩溃或消息丢失 | 平台 transport 显式切换 UI 主线程 |
| completion 与 Channel close 竞争 | 重复响应或泄漏 | pending token 原子完成并做一次性消费 |
| transport callback 生命周期短于 `Jsb` | use-after-free 或发送失败 | 平台 owner 显式管理 attach/detach/shutdown |
| 三端同时迁移导致回归面过大 | 难以定位问题 | Android 试点后按平台逐个迁移 |
| HostCall 过早从 core 删除 | 现有平台能力中断 | completion 路径稳定且三端迁移后再清理 |
| 接口名称对齐但协议行为漂移 | 前端兼容性回归 | golden test 固定线上 JSON 和 Channel control 字节 |

## 16. 完成标准

满足以下条件后，本方案视为落地完成：

- `jsb-core` 中不存在 Shell360 业务方法名和业务类型；
- `jsb-core` 通过 `JsbTransport` 直接发送响应、事件和二进制；
- `Jsb` 的消息入口只返回 `Result<(), JsbError>`；
- 三端不再解释 Rust 输出列表；
- `EngineOutput`、`NativeEngineOutput` 和对应 kind 已删除；
- JSB 领域代码中不再使用 `Engine` 命名；
- `shell360-runtime` 继续拥有全部具体 JSB 方法实现和业务 Channel 绑定；
- 前端 `jsb` 公共 API 与线上消息格式不变；
- Rust、Android、iOS、HarmonyOS 构建验证通过；
- 三端完成 control、invoke、emit 和 binary 真机验证。

## 17. 不在本方案范围内

- 重写 TypeScript `jsb` 公共 API；
- 改写 `bridge` 的业务接口；
- 将平台 WebView SDK 封装进 `jsb-core`；
- 将 SSH、SFTP、data 或 HostServices 业务实现迁入 `jsb-core`；
- 引入跨语言协议 schema 或生成 fixtures；
- 改变 Tauri 桌面端通信机制；
- 以 loopback server 替代 WebView MessagePort。

## 18. 决策摘要

1. `jsb-core` 是纯 JSB 框架，不是 Shell360 业务后端。
2. Rust 通过注入的 `JsbTransport` 直接控制 JSB Channel 收发。
3. 具体 JSB 方法通过 `JsbHandler` 注入，由 `shell360-runtime` 实现。
4. 异步方法通过 `JsbInvokeCompletion` 完成，最终响应由 `jsb-core` 发送。
5. 平台只保留 WebView MessagePort/WKScriptMessage/ArkWeb Port 的薄适配。
6. 删除平台解释的输出列表，因此不再需要任何 `EngineOutput` 替代类型。
7. 迁移按 Android、iOS、HarmonyOS 逐平台推进，协议和前端 API 保持不变。
