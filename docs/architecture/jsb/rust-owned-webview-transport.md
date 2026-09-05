# Rust JSB 直连 WebView 通道技术方�?

> 状态：已落地（Rust + Android + iOS 代码 + HarmonyOS 代码已完成；Android 构建、iOS/Xcode �?HarmonyOS 真机验证未在当前环境执行�? 
> 适用范围：Android、iOS、HarmonyOS 原生 WebView 宿主  
> 目标：由 Rust `jsb-core` 直接管理 JSB 协议与通道收发，同时保�?`jsb-core` 为零业务逻辑的通用框架�?

## 1. 背景

迁移前的移动�?JSB 已将协议状态和业务调度收敛�?Rust，但 Rust �?WebView 之间采用“计算输出、平台执行”的两段式模型（该模型已随本方案删除）：

```text
WebView MessagePort
  -> 平台层接收文本或二进�?
  -> NativeJsbEngine / jsb_engine_* 调用 jsb-core
  -> Vec<EngineOutput>
  -> Kotlin / Swift / ArkTS 遍历并解�?EngineOutput
  -> 平台层写�?MessagePort
```

该模型存在以下问题：

1. `Engine` 是实现视角的抽象，与 TypeScript `jsb` 库的 `JSB`、`invoke`、`emit`、`JSBChannel` 术语不一致�?
2. `EngineOutput` 不是前端业务返回值，而是要求平台继续执行的中间指令，容易产生误解�?
3. 三个平台都需要维护输出类型转换、序列化�?`executeOutputs` 分支�?
4. Rust 只负责“算出下一步”，并未真正接管 JSB 通道的发送生命周期�?
5. HostCall 混在核心输出中，但在 FFI 层又�?callback 消费，核心输出与平台可见输出并不等价�?

本方案删除输出列表模式。`jsb-core` 通过平台注入的通用传输接口直接收发 WebView 消息，通过注入的调用接口将具体方法交给 `shell360-runtime` 实现�?

## 2. 设计原则

### 2.1 `jsb-core` 只实�?JSB 框架

`jsb-core` 负责�?

- JSB Channel 生命周期�?
- `invoke.request` 解析、校验和 request ID 生命周期�?
- `invoke.response` 序列化和发送；
- `emit` 消息序列化和发送；
- 文本与二进制帧的大小限制�?
- client ID 生命周期�?
- pending invoke 的完成、拒绝和取消�?
- 调用外部注入的通用方法处理接口�?
- 调用外部注入�?WebView 传输接口�?

`jsb-core` 不负责：

- `ssh.*`、`data.*`、`fs.*`、`dialog.*` 等具体方法；
- SSH shell、SFTP 或数据库实现�?
- `(clientId, sshShellId) -> dataChannelId` 等业务绑定；
- scoped URI、staging path 或文件策略；
- 剪贴板、生物识别、系统栏、打开 URL 等具体平台原语；
- Android、iOS、HarmonyOS WebView API 的具体调用�?

`jsb-core` 中不得出现业务方法名、业�?ID、宿主原语名或按业务方法分支的逻辑�?

### 2.2 Rust 接管 JSB，不接管平台 WebView API

Rust 负责决定何时打开、发送、失败和关闭 JSB Channel，但具体 WebView API 仍由平台实现�?

平台�?Rust 提供最小传输能力，Rust 不使�?`cfg(android)`、`cfg(ios)` �?`cfg(harmonyos)` 直接依赖平台 SDK。这�?`jsb-core` 仍可独立测试和复用�?

### 2.3 TypeScript `jsb` 是协议术语来�?

Rust �?TypeScript 使用相同的核心概念：

| TypeScript `jsb` | Rust `jsb-core` | 含义 |
| --- | --- | --- |
| `JSB` | `Jsb` | JSB 实例 |
| `JSBChannel` | Channel 状态（`jsb.rs` 内部结构，不公开�?| 文本或二进制通道 |
| `JSBInvokeRequest` | `JsbInvokeRequest`（`id`/`method`/`params_json`�?| `invoke.request` 消息 |
| `JSBInvokeResponse` | 无公开类型；`jsb.rs` 内部序列化响�?错误�?| `invoke.response` 消息 |
| `JSBEmitMessage` | 无公开类型；`emit(message_json)` 只寻址 control channel | 主动事件消息 |
| `JSBErrorPayload` | `JsbErrorPayload`（`code`/`message`/`details`�?| 协议错误结构 |
| `invoke()` | `JsbHandler::invoke(..)` + `JsbInvokeCompletion` | JSB 方法调用语义 |
| `openChannel()` | `open_channel()` | 打开 Channel |
| `closeChannel()` | `close_channel()` | 关闭 Channel |

Rust 遵循 Rust 命名约定使用 `Jsb`，TypeScript 继续使用 `JSB`�?

## 3. 目标架构

```text
┌──────────────────────────────────────────────────────────────�?
�?bridge (TypeScript)                                          �?
�?ssh/data/fs/... 的类型安全业�?API                           �?
└──────────────────────────────┬───────────────────────────────�?
                               �?jsb.invoke(method, data)
┌──────────────────────────────▼───────────────────────────────�?
�?jsb (TypeScript，纯框架)                                     �?
�?JSB · JSBChannel · invoke.request/response · emit            �?
└──────────────────────────────┬───────────────────────────────�?
                               �?MessagePort string/ArrayBuffer
┌──────────────────────────────▼───────────────────────────────�?
�?平台 WebView Transport（薄适配�?                            �?
�?Android WebMessagePort / iOS WKScriptMessage / ArkWeb Port   �?
└──────────────────────────────┬───────────────────────────────�?
                               �?receive_text / receive_binary
┌──────────────────────────────▼───────────────────────────────�?
�?jsb-core (Rust，纯框架)                                      �?
�?Jsb · 协议 · Channel · pending invoke · JsbTransport         �?
└───────────────┬──────────────────────────────┬───────────────�?
                �?JsbHandler::invoke           �?transport.send_*
                �?                             �?
┌──────────────────────────────�?  ┌───────────────────────────�?
�?shell360-runtime             �?  �?平台 WebView Transport    �?
�?方法表与全部业务实现         �?  �?直接把响应写�?MessagePort�?
└───────────────┬──────────────�?  └───────────────────────────�?
                �?必要的平台能�?
                �?
┌──────────────────────────────�?
�?Shell360 HostServices        �?
�?各平台系统能力实�?          �?
└──────────────────────────────�?
```

关键变化是：`jsb-core` 的入口返�?`Result<(), JsbError>`，响应由 Rust 直接通过 `JsbTransport` 发出，不再返�?`EngineOutput`、`JsbOutput` �?`JsbOperation`�?

## 4. 核心接口设计

以下代码用于说明职责和方向，最终签名可根据 UniFFI、N-API 和线程模型调整�?

### 4.1 `JsbTransport`

`JsbTransport` �?`jsb-core` 操作 WebView JSB Channel 的唯一出口�?

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

接口只包含通用 Channel 操作，不包含 Shell360 方法、SSH 或平台业务能力�?

### 4.2 `JsbHandler`

`JsbHandler` �?`jsb-core` 调用具体 JSB 方法实现的唯一入口�?

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

其中上下文只包含 JSB 通用标识�?

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
  pub params_json: String, // 已序列化的请�?data，缺省为 "null"
}

pub struct JsbHandlerError {
  pub code: String,
  pub message: String,
}
```

上下文中不得增加 `ssh_shell_id`、`ssh_sftp_id` 等业务字段。`receive_binary`
的错误只用于通道拆除诊断：二进制帧没�?request id 可以回复，业务错误由
`shell360-runtime` 通过关闭 SSH/通道等业务手段处理�?

### 4.3 异步完成接口

具体方法可能同步完成，也可能等待 Rust 异步任务或平台能力。`jsb-core` 通过 completion 保持 pending request 生命周期�?

```rust
pub trait JsbInvokeCompletion: Send + Sync {
  fn resolve(&self, data_json: String);
  fn reject(&self, error: JsbErrorPayload);
}
```

completion �?`jsb-core` 创建，内部绑定：

- `client_id`�?
- `channel_id`�?
- request ID�?
- 请求是否仍处�?pending�?
- 对应 `JsbTransport`�?

`resolve` �?`reject` 只能成功一次。Channel 已关闭、client 已释放或请求已取消时，后续完成必须安全忽略并释放资源�?

该接口让 `jsb-core` 不需要理�?Shell360 当前�?HostCall continuation。平台原语协调可以在 `shell360-runtime`、`shell360-ffi` 和平�?`HostServices` 中完成，最终只调用 completion�?

### 4.4 `Jsb`

```rust
pub struct Jsb {
  transport: Arc<dyn JsbTransport>,
  handler: Arc<dyn JsbHandler>,
  methods: HashSet<String>,
  // Channel、client �?pending invoke 状�?
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
  /// Channel，不构造业务事件�?
  pub fn emit(&self, message: String) -> Result<(), JsbError>;

  pub fn send_binary(
    &self,
    channel_id: String,
    data: Vec<u8>,
  ) -> Result<(), JsbError>;

  /// 取消全部 pending invoke，通知 handler 释放 client，并要求 transport
  /// 关闭所�?Channel。锁外完成全部回调�?
  pub fn shutdown(&self) -> Result<(), JsbError>;
}
```

`JsbError` 只覆盖无法作为帧投递的传输/状态失败（`NotConnected`�?
`MessageTooLarge`、`Transport(JsbTransportError)`、`LockPoisoned`）；协议错误
（非�?JSON、未注册方法、重�?request id 等）一律作�?`invoke.response` 错误�?
通过 transport 发回页面，不作为入口错误返回�?

文本帧在锁内解析并分类，随后在锁外调�?handler/transport，必要时再次短暂持锁
提交结果；completion 内部�?`AtomicBool` 保证 `resolve`/`reject`/`cancel` 只有
一个生效�?

## 5. 消息�?

### 5.1 普�?invoke

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
  -> Jsb 构�?invoke.response
  -> JsbTransport::send_text
  -> MessagePort.postMessage
  -> TS Promise resolve
```

### 5.2 Rust 主动事件

```text
shell360-runtime event sink
  -> NativeJsb.emit(event_json) / Jsb::emit(message)
  -> 校验并定�?control channel
  -> JsbTransport::send_text
  -> TS JSB.on/once listener
```

`jsb-core` 只认识通用 `emit` 信封，不认识具体事件名�?

### 5.3 二进�?Channel

前端�?Rust�?

```text
JSBChannel<ArrayBuffer>.postMessage
  -> 平台 MessagePort callback
  -> Jsb::receive_binary(channelId, bytes)
  -> JsbHandler::receive_binary(JsbChannelContext { client_id, channel_id }, data)
  -> shell360-runtime 根据自己的业务绑定处�?
```

Rust 到前端：

```text
shell360-runtime 查找业务对象对应�?channelId
  -> Jsb::send_binary(channelId, bytes)
  -> 校验 Channel 和帧大小
  -> JsbTransport::send_binary
  -> JSBChannel<ArrayBuffer> message
```

`(clientId, sshShellId) -> dataChannelId` 继续�?`shell360-runtime` 管理；`jsb-core` 只校验通用 `channelId`�?

### 5.4 平台能力与异步完�?

```text
JsbHandler::invoke
  -> shell360-runtime 判断需要平台能�?
  -> Shell360 HostServices callback
  -> Kotlin / Swift / ArkTS 执行系统能力
  -> shell360-runtime 恢复业务调用
  -> completion.resolve/reject
  -> jsb-core 直接发�?invoke.response
```

HostCall、continuation、staging 等均不是 JSB 协议概念，不进入 `jsb-core` 公共模型�?

## 6. 平台适配

### 6.1 Android

保留一个薄�?`JsbPortBridge` 或改名为 `AndroidJsbTransport`，负责：

- 创建和转�?`WebMessagePortCompat`�?
- 保存 `channelId -> WebMessagePortCompat` 的平台句柄；
- �?string/ArrayBuffer 原样送入 `NativeJsb.receiveText/receiveBinary`�?
- 实现 Rust `JsbTransport` callback�?
- 在主线程调用 WebView/MessagePort API�?
- 关闭和释放端口�?

删除�?

- `NativeEngineOutput` / `NativeEngineOutputKind`�?
- `dispatchOutputs` / `executeOutputs` / `executeOutput`�?
- 对输�?kind �?`when` 分支�?

### 6.2 iOS

保留 WKWebView 传输适配器，负责�?

- document-start JSB 注入�?
- WKScriptMessage 收发�?
- string/binary 信封适配�?
- 实现 `JsbTransport` callback�?
- 确保 WebKit 调用位于主线程�?

Base64 仅可存在�?iOS WKScriptMessage 二进制传输适配器内部，不进�?`jsb-core`、公开 invoke JSON 或其他平台�?

删除 Swift �?`NativeEngineOutput` 的遍历和解释�?

### 6.3 HarmonyOS

保留 `MessagePortBridge` 或改名为 `HarmonyJsbTransport`，负责：

- ArkWeb MessagePort 创建和转交；
- string/ArrayBuffer 收发�?
- 实现 N-API 传输 callback�?
- 在正确的 ArkUI 线程执行 WebView 操作�?
- 端口释放�?

OHRS 不再�?Rust 输出序列化成 JSON 数组，删�?`serialize_engine_outputs`。ArkTS 不再解析和执行输出数组�?

## 7. FFI 设计与线程约�?

### 7.1 UniFFI（`shell360-ffi`，Kotlin/Swift�?

最终生成的绑定表面�?
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

`JsbTransport` callback �?UniFFI 边界返回 `Result`；`FfiJsbTransport` 将平�?错误转换�?`jsb-core::JsbTransportError`。除 `completeHostCall` 外，
`NativeJsb` 所有入口返�?`Result<Unit, FfiError>`，不返回输出集合。运行时事件
�?SSH shell 二进制由 Rust 内部直接路由�?`NativeJsb`，不再经过平台事�?callback�?旧的直连入口（`invoke`/`invokeKeygen`/`invokeData`/`invokeSsh`/
`releaseClient`/`sendSshShellData`/`healthCheck` 等）已从绑定中删除�?

### 7.2 OHRS / N-API（`shell360_ohrs`，ArkTS�?

最终导出：

```text
initializeRuntime(appDataDir, cacheDir) / shutdown()
attachHostCallCallback / attachJsbTransportCallback
initializeJsb()

interface JsbTransportEvent {       // #[napi(object)]
  op: "openChannel" | "failChannel" | "sendText" | "sendBinary" | "closeChannel"
  channelId: string
  text?: string
  data?: number[]                   // 二进制保持二进制，不�?JSON/Base64
}

jsbOpenChannel / jsbCloseChannel / jsbChannelOpenFailed
jsbReceiveText / jsbReceiveBinary
jsbCompleteHostCall
jsbEmit / jsbSendBinary / jsbPushShellBinary
```

`attachJsbTransportCallback` 注册 ThreadsafeFunction；Rust �?
`OhrsJsbTransport` 实现 `shell360_ffi::JsbTransport`，把每个操作包成
`JsbTransportEvent` �?ThreadsafeFunction 投递，ArkTS �?JS 线程串行执行
WebView 操作。旧�?`invoke`/`release_client`/`send_ssh_shell_data`/
`health_check` 直连导出已删除�?

### 7.3 禁止锁内�?FFI 回调

`Jsb` 状态需要同步保护，但不得在持有状态锁时调用：

- `JsbTransport`�?
- `JsbHandler`�?
- `JsbInvokeCompletion` 的外部业务逻辑�?
- 任意 UniFFI �?N-API callback�?

推荐流程�?

1. 短暂持锁读取或更�?JSB 状态；
2. 释放锁；
3. 调用 handler �?transport�?
4. 必要时再次短暂持锁提交结果�?

这样避免平台回调重入、主线程切换�?completion 同步完成造成死锁�?

### 7.4 顺序保证

同一 `channelId` 上必须保持以下顺序：

- `channel.opened` 先于�?Channel 的普通消息；
- 同一次处理产生的响应和后置事件顺序可预测�?
- `close_channel` 后不再发送文本或二进制；
- completion �?Channel close 竞争时最多发送一次最终响应；
- Transport 线程切换不能重排同一 Channel 的消息�?

如果平台 callback 本身不能保证顺序，应在平�?transport 中使用单线程队列或主线程队列串行执行�?

## 8. 错误模型

错误分为三层�?

1. **协议错误**：非�?JSON、缺�?ID、重复请求、消息过大、方法不可用。由 `jsb-core` 构�?`JsbInvokeResponse::Error` 并直接发回前端�?
2. **方法错误**：由 `JsbHandler` �?completion 返回 `JsbErrorPayload`，`jsb-core` 只负责封装响应�?
3. **Transport 错误**：WebView port 不存在、线程调度失败或发送失败。转换为 `JsbTransportError`，触�?Channel 清理�?pending 请求取消；不能伪装为具体业务错误�?

错误码来源仍�?Shell360 Rust 业务层维护。`jsb-core` 只维护通用 JSB 框架错误码，例如�?

```text
JSB_INVALID_MESSAGE
JSB_MESSAGE_TOO_LARGE
JSB_DUPLICATE_REQUEST
JSB_NOT_CONNECTED
JSB_UNSUPPORTED
JSB_CHANNEL_INVALID_ID
JSB_CHANNEL_OPEN_FAILED
```

## 9. crate 与模块边�?

建议�?`jsb-core` 结构�?

```text
crates/jsb-core/src/
├── lib.rs          # 公开导出（无业务名、无 cfg(platform)、无 uniffi/napi 依赖�?
├── jsb.rs          # Jsb 状态、公开入口与短锁调�?
├── protocol.rs     # invoke/emit/channel 信封序列化与 JsbErrorPayload
├── handler.rs      # JsbHandler、JsbInvokeCompletion 与通用上下�?
└── transport.rs    # JsbTransport �?JsbTransportError
```

`jsb-core` �?Cargo 依赖保持通用，不依赖�?

- `shell360-runtime`�?
- `shell360-ssh`�?
- `shell360-store`�?
- UniFFI�?
- napi-ohos�?
- Android、iOS �?HarmonyOS SDK�?

依赖方向�?

```text
shell360-runtime -> jsb-core
shell360-ffi     -> jsb-core + shell360-runtime
shell360_ohrs    -> jsb-core + shell360-runtime
jsb-core         -> 通用 serde/uuid 等基础依赖
```

## 10. 命名调整

删除所�?JSB 领域中的 `Engine` 和输出列表命名（已全部落地）�?

| 迁移�?| 迁移�?|
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
| 局部变�?`engine` | `jsb` |

不得为了替换名称而新增同义的 `JsbOutput`、`JsbOperation` �?`JsbCommand`。目标模型没有需要平台解释的返回列表。依赖库中无关的 `base64::Engine`（SSH shell 发送路径）不在改名范围内�?

## 实施规划与历�?

本方案的分阶段迁移计划、兼容性要求、测试验证、可观测性、风险应对、完成标准与决策摘要已归档至
`history.md` §7。所有阶段均已落地�?

### 阶段 A：建立直连接口，不改业务路由

