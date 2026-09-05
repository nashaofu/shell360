# JSB 架构设计

> 状态：**现行架构，已落地**。Rust 侧分层与 Android / iOS / HarmonyOS 三端宿主迁移均已完成
> （部分平台的构建与真机验证受环境限制未全部执行，见 `README.md`）。
>
> 核心约束：**`jsb`（TS）与 `jsb-core`（Rust）都是纯框架，不含任何业务逻辑**；业务调用收敛到
> `bridge`（TS）与业务后端 `shell360-runtime`（Rust）；各端 JSB 对接层统一基于 `jsb-core`
> 封装，不各自实现协议。
>
> 帧协议与错误码见 `protocol.md`；设计决策见 `adr/`；历史演进见 `history.md`。

`jsb-core::Jsb` 通过注入的 `JsbTransport` 直接收发 WebView Channel，入口只返回
`Result<(), JsbError>`；具体方法由 `shell360-runtime` 通过 `JsbHandler` 实现。平台不再解释
Rust 输出列表。

## 1. 分层架构

```
┌────────────────────────────────────────────────────────────────┐
│  bridge (TS)          业务调用层：基于 jsb 封装                │
│  ssh.ts / data.ts / fs.ts / dialog.ts / clipboard-manager.ts … │
│  → jsb.invoke("ssh.session.connect", params)                   │
└──────────────────────────────┬─────────────────────────────────┘
                               │ 泛型 invoke(method, data) 调用
┌──────────────────────────────▼─────────────────────────────────┐
│  jsb (TS)              JSB 核心（纯框架，零业务）              │
│  JSB.invoke/on/once/off · JSBChannel · protocol · error        │
│  channel_registry · types —— 不含任何方法名 / 业务类型         │
└──────────────────────────────┬─────────────────────────────────┘
                               │ 传输适配（MessagePort / WKScriptMessage）
┌──────────────────────────────▼─────────────────────────────────┐
│  各端对接层（薄适配：实现 JsbTransport + HostServices）        │
│  Android: JsbPortBridge + PlatformHostServices (Kotlin)       │
│  iOS:     IosJsbTransport + IosHostServices (Swift)           │
│  Harmony: MessagePortBridge + HarmonyHostServices (ArkTS)     │
└──────────────────────────────┬─────────────────────────────────┘
                               │ FFI（UniFFI / NAPI）
┌──────────────────────────────▼─────────────────────────────────┐
│  shell360-ffi / shell360_ohrs   FFI 边界（仅绑定，无业务）     │
│  NativeJsb 包装 jsb-core · JsbTransport callback interface     │
│  HostServices callback · Transport callback · 无输出列表      │
└───────────────┬──────────────────────────────┬─────────────────┘
                │                              │
┌───────────────▼─────────────────┐  ┌─────────▼───────────────────┐
│  jsb-core (Rust) 纯 JSB 框架    │  │  shell360-runtime (Rust)    │
│  Jsb：通道/pending/信封/事件    │  │  业务后端（唯一业务实现）   │
│  帧上限/UUID · 短锁后回调       │  │  Shell360Runtime：keygen /  │
│  trait JsbTransport（出）       │  │  data / ssh 调度            │
│  trait JsbHandler（入）         │  │  方法表（70 个 MethodSpec） │
│  不含方法名/原语名/业务编排     │  │  impl JsbHandler + HostCall │
│  不依赖 uniffi/napi/平台 SDK    │  │  shell 二进制绑定/staging   │
└─────────────────────────────────┘  └─────────────────────────────┘
```

分层职责：

| 层 | 语言 | 职责 | 是否含业务 |
| --- | --- | --- | --- |
| `bridge` | TS | 业务调用，`jsb.invoke` 的类型安全封装 | ✅ 业务 |
| `jsb` | TS | JSB 协议/通道/事件的纯框架 | ❌ 纯框架 |
| 各端对接 | Kotlin/Swift/ArkTS | 传输适配 + `HostServices` 系统原语 | 系统原语，非 JSB 业务 |
| `shell360-ffi` / `shell360_ohrs` | Rust | UniFFI / NAPI 绑定，包装 `jsb-core` | ❌ 仅绑定 |
| `jsb-core` | Rust | JSB 引擎纯框架 | ❌ 纯框架 |
| `shell360-runtime` | Rust | 业务调度 + 方法表 | ✅ 业务 |

各端对接现状：

- `shell360-ffi`：**仅绑定层** —— `NativeJsb` 包装 `jsb-core::Jsb`（构造时注入
  `FfiJsbTransport` 适配器 + `RuntimeInvoker` + `shell360_runtime::method_specs()` 方法名）；
  UniFFI 暴露 `JsbTransport`/`HostServices` callback interface；所有入口返回
  `Result<(), FfiError>`。业务运行时 `Shell360Runtime` 在 `shell360-runtime`，此处只保留
  `#[uniffi::Object]` 薄包装（构造 + `shutdown()`）。
- `shell360_ohrs`：`jsb_*` NAPI 入口（`jsbOpenChannel`/`jsbReceiveText`/…）全部返回
  `Result<()>`；Rust 端 `OhrsJsbTransport` 实现 `shell360_ffi::JsbTransport`，经
  `JsbTransportEvent` ThreadsafeFunction 驱动 ArkTS。
- Android（Kotlin）、iOS（Swift）与 HarmonyOS（ArkTS）：三端只做两件事——实现
  `JsbTransport`（WebView 端口操作，UI 线程）与 `HostServices`（系统原语）；不解释任何 Rust
  输出列表，不手写逐方法 handler。

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
平台向 Rust 提供最小传输能力，Rust 不使用 `cfg(android)`、`cfg(ios)` 或 `cfg(harmonyos)`
直接依赖平台 SDK。这样 `jsb-core` 仍可独立测试和复用。

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

## 3. 核心接口

以下签名是现行接口的参考，具体以 `crates/jsb-core` 源码为准。

### 3.1 `JsbTransport`

`JsbTransport` 是 `jsb-core` 操作 WebView JSB Channel 的唯一出口：

```rust
pub trait JsbTransport: Send + Sync {
  fn open_channel(&self, channel_id: &str, control_message: &str)
    -> Result<(), JsbTransportError>;
  fn fail_channel(&self, channel_id: &str, control_message: &str)
    -> Result<(), JsbTransportError>;
  fn send_text(&self, channel_id: &str, message: &str)
    -> Result<(), JsbTransportError>;
  fn send_binary(&self, channel_id: &str, data: &[u8])
    -> Result<(), JsbTransportError>;
  fn close_channel(&self, channel_id: &str)
    -> Result<(), JsbTransportError>;
}
```

接口只包含通用 Channel 操作，不包含 Shell360 方法、SSH 或平台业务能力。

### 3.2 `JsbHandler`

`JsbHandler` 是 `jsb-core` 调用具体 JSB 方法实现的唯一入口：

```rust
pub trait JsbHandler: Send + Sync {
  fn invoke(&self, context: JsbInvokeContext, request: JsbInvokeRequest,
            completion: Arc<dyn JsbInvokeCompletion>);
  fn receive_binary(&self, context: JsbChannelContext, data: Vec<u8>)
    -> Result<(), JsbHandlerError>;
  fn close_channel(&self, context: JsbChannelContext);
  fn release_client(&self, client_id: String);
}
```

上下文只包含 JSB 通用标识：

```rust
pub struct JsbInvokeContext { pub client_id: String, pub channel_id: String }
pub struct JsbChannelContext { pub client_id: String, pub channel_id: String }
pub struct JsbInvokeRequest {
  pub id: String,
  pub method: String,
  pub params_json: String, // 已序列化的请求 data，缺省为 "null"
}
pub struct JsbHandlerError { pub code: String, pub message: String }
```

上下文中不得增加 `ssh_shell_id`、`ssh_sftp_id` 等业务字段。`receive_binary` 的错误只用于
通道拆除诊断：二进制帧没有 request id 可以回复，业务错误由 `shell360-runtime` 通过关闭
SSH/通道等业务手段处理。

### 3.3 `JsbInvokeCompletion`

具体方法可能同步完成，也可能等待 Rust 异步任务或平台能力。`jsb-core` 通过 completion 保持
pending request 生命周期：

```rust
pub trait JsbInvokeCompletion: Send + Sync {
  fn resolve(&self, data_json: String);
  fn reject(&self, error: JsbErrorPayload);
}
```

completion 由 `jsb-core` 创建，内部绑定 `client_id`、`channel_id`、request ID、pending 状态
与对应 `JsbTransport`。`resolve`/`reject` 只能成功一次；Channel 已关闭、client 已释放或请求已
取消时，后续完成必须安全忽略并释放资源。该接口让 `jsb-core` 不需要理解 HostCall
continuation——平台原语协调在 `shell360-runtime`、`shell360-ffi` 和平台 `HostServices` 中
完成，最终只调用 completion。

### 3.4 `Jsb`

```rust
pub struct Jsb {
  transport: Arc<dyn JsbTransport>,
  handler: Arc<dyn JsbHandler>,
  methods: HashSet<String>,
  // Channel、client 和 pending invoke 状态
}

impl Jsb {
  pub fn new(transport: Arc<dyn JsbTransport>, handler: Arc<dyn JsbHandler>,
             methods: impl IntoIterator<Item = impl Into<String>>) -> Self;
  pub fn client_id(&self) -> Option<String>;
  pub fn open_channel(&self, channel_id: String) -> Result<(), JsbError>;
  pub fn close_channel(&self, channel_id: String) -> Result<(), JsbError>;
  pub fn channel_open_failed(&self, channel_id: String, reason: String) -> Result<(), JsbError>;
  pub fn receive_text(&self, channel_id: String, text: String) -> Result<(), JsbError>;
  pub fn receive_binary(&self, channel_id: String, data: Vec<u8>) -> Result<(), JsbError>;
  /// `message` 是已序列化的 `emit` 信封 JSON；core 只校验并寻址 control Channel。
  pub fn emit(&self, message: String) -> Result<(), JsbError>;
  pub fn send_binary(&self, channel_id: String, data: Vec<u8>) -> Result<(), JsbError>;
  /// 取消全部 pending invoke，通知 handler 释放 client，并要求 transport 关闭所有 Channel。
  pub fn shutdown(&self) -> Result<(), JsbError>;
}
```

`JsbError` 只覆盖无法作为帧投递的传输/状态失败（`NotConnected`、`MessageTooLarge`、
`Transport(JsbTransportError)`、`LockPoisoned`）；协议错误（非法 JSON、未注册方法、重复
request id 等）一律作为 `invoke.response` 错误帧通过 transport 发回页面，不作为入口错误返回。

文本帧在锁内解析并分类，随后在锁外调用 handler/transport，必要时再次短暂持锁提交结果；
completion 内部用 `AtomicBool` 保证 `resolve`/`reject`/`cancel` 只有一个生效。

## 4. 消息流

### 4.1 普通 invoke

```text
TS JSB.invoke("app.getVersion")
  -> JSBChannel.postMessage(invoke.request)
  -> 平台 MessagePort callback
  -> NativeJsb.receiveText(channelId, text)
  -> Jsb::receive_text -> 解析 JsbInvokeRequest
  -> JsbHandler::invoke (shell360-runtime)
  -> completion.resolve(data)
  -> Jsb 构造 invoke.response -> JsbTransport::send_text
  -> MessagePort.postMessage -> TS Promise resolve
```

### 4.2 Rust 主动事件

```text
shell360-runtime event sink
  -> NativeJsb.emit(event_json) / Jsb::emit(message)
  -> 校验并定位 control channel
  -> JsbTransport::send_text
  -> TS JSB.on/once listener
```

`jsb-core` 只认识通用 `emit` 信封，不认识具体事件名。

### 4.3 二进制 Channel

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
  -> Jsb::send_binary(channelId, bytes) -> 校验 Channel 和帧大小
  -> JsbTransport::send_binary
  -> JSBChannel<ArrayBuffer> message
```

`(clientId, sshShellId) -> dataChannelId` 由 `shell360-runtime` 管理；`jsb-core` 只校验通用
`channelId`。

### 4.4 平台能力与异步完成

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

## 5. 平台适配

三端对接层只做两件事：实现 `JsbTransport`（WebView 端口操作，切 UI 主线程）与 `HostServices`
（系统原语）。

### 5.1 Android

`JsbPortBridge` 负责：创建和转交 `WebMessagePortCompat`；保存 `channelId ->
WebMessagePortCompat` 句柄；将 string/ArrayBuffer 原样送入 `NativeJsb.receiveText/
receiveBinary`；实现 Rust `JsbTransport` callback；在主线程调用 WebView/MessagePort API；
关闭和释放端口。

### 5.2 iOS

WKWebView 传输适配器负责：document-start JSB 注入；WKScriptMessage 收发；string/binary 信封
适配；实现 `JsbTransport` callback；确保 WebKit 调用位于主线程。Base64 仅可存在于 iOS
WKScriptMessage 二进制传输适配器内部，不进入 `jsb-core`、公开 invoke JSON 或其他平台。

### 5.3 HarmonyOS

`MessagePortBridge` 负责：ArkWeb MessagePort 创建和转交；string/ArrayBuffer 收发；实现
N-API 传输 callback；在正确的 ArkUI 线程执行 WebView 操作；端口释放。

## 6. FFI 与线程约束

### 6.1 UniFFI（`shell360-ffi`，Kotlin/Swift）

绑定表面：

```text
interface HostServices {           // 平台能力异步边界
  onHostCall(callId, primitive, paramsJson)
}

interface JsbTransport {           // Rust -> WebView
  openChannel(channelId, controlMessage)
  failChannel(channelId, controlMessage)
  sendText(channelId, message)
  sendBinary(channelId, data: ByteArray)
  closeChannel(channelId)
}

object Shell360Runtime {
  constructor(appDataDir, cacheDir)
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

`JsbTransport` callback 在 UniFFI 边界返回 `Result`；`FfiJsbTransport` 将平台错误转换回
`jsb-core::JsbTransportError`。除 `completeHostCall` 外，`NativeJsb` 所有入口返回
`Result<Unit, FfiError>`，不返回输出集合。运行时事件和 SSH shell 二进制由 Rust 内部直接路由到
`NativeJsb`，不经过平台事件 callback。

### 6.2 OHRS / N-API（`shell360_ohrs`，ArkTS）

```text
initializeRuntime(appDataDir, cacheDir) / shutdown()
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

`attachJsbTransportCallback` 注册 ThreadsafeFunction；Rust 端 `OhrsJsbTransport` 实现
`shell360_ffi::JsbTransport`，把每个操作包成 `JsbTransportEvent` 经 ThreadsafeFunction 投递，
ArkTS 在 JS 线程串行执行 WebView 操作。

### 6.3 禁止锁内跨 FFI 回调

`Jsb` 状态需要同步保护，但不得在持有状态锁时调用 `JsbTransport`、`JsbHandler`、
`JsbInvokeCompletion` 的外部业务逻辑，或任意 UniFFI / N-API callback。推荐流程：短暂持锁读取
或更新状态 → 释放锁 → 调用 handler 或 transport → 必要时再次短暂持锁提交结果。这样避免平台
回调重入、主线程切换和 completion 同步完成造成死锁。

### 6.4 顺序保证

同一 `channelId` 上必须保持：`channel.opened` 先于该 Channel 的普通消息；同一次处理产生的响应
和后置事件顺序可预测；`close_channel` 后不再发送文本或二进制；completion 与 Channel close
竞争时最多发送一次最终响应；Transport 线程切换不能重排同一 Channel 的消息。若平台 callback
本身不能保证顺序，应在平台 transport 中使用单线程队列或主线程队列串行执行。

## 7. crate 与模块边界

`jsb-core` 结构：

```text
crates/jsb-core/src/
├── lib.rs          # 公开导出（无业务名、无 cfg(platform)、无 uniffi/napi 依赖）
├── jsb.rs          # Jsb 状态、公开入口与短锁调度
├── protocol.rs     # invoke/emit/channel 信封序列化与 JsbErrorPayload
├── handler.rs      # JsbHandler、JsbInvokeCompletion 与通用上下文
└── transport.rs    # JsbTransport 与 JsbTransportError
```

`jsb-core` 的 Cargo 依赖保持通用，不依赖 `shell360-runtime`、`shell360-ssh`、
`shell360-store`、UniFFI、napi-ohos，或 Android/iOS/HarmonyOS SDK。

依赖方向：

```text
shell360-runtime -> jsb-core
shell360-ffi     -> jsb-core + shell360-runtime
shell360_ohrs    -> jsb-core + shell360-runtime
jsb-core         -> 通用 serde/uuid 等基础依赖
```

## 8. 统一与不统一的边界

**统一（收敛到 `jsb-core` 纯框架，注入式）**：

- 方法路由与校验、pending 请求、响应/错误信封、事件路由、通道/生命周期、帧上限、UUID 校验。
- 异步方法的**通用机制**：`JsbHandler::invoke` 拿到 `Arc<dyn JsbInvokeCompletion>`，
  `resolve`/`reject` 经 `AtomicBool` 保证一次性；close/release/shutdown 时核心取消 pending 并
  通知 handler。具体 HostCall、scoped 文件和二进制绑定策略不进入核心。
- 通道收发的**唯一出口** `JsbTransport`（open/fail/send_text/send_binary/close），核心不调用
  任何平台 SDK，也不返回供平台解释的输出列表。

**不统一（刻意保留，且不再放进 `jsb-core`）**：

- **业务方法名 + 业务调度 + 宿主路由表**：归 `shell360-runtime`（单一 Rust 实现）。
  `method_typescript()` 在 `shell360-runtime`，生成的 `JsbMethod` 声明由 `bridge` 消费（不是
  `jsb`）；“哪个方法交给哪个宿主原语”由 `shell360-runtime::methods::host_primitive()` 决定。
- **`HostServices` 系统原语实现**：各平台各一份（剪贴板/文件选择/打开 URL/系统栏/关窗/
  scoped 文件/生物识别），但参数校验、URL scheme、路径 canonicalize、staging、错误模型归
  Rust。
- **传输适配器**：Android/HarmonyOS 用 WebMessagePort；iOS 用 WKScriptMessage（Base64 仅
  iOS 适配器内部）。
- **前端 `bridge/*` API 与 Tauri 桌面端**：不变。
