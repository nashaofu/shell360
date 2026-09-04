# 移动端 JSB 目标分层（bridge / jsb / jsb-core）

> 本文定义移动端 JSB 的**目标分层**，是对 `unification-analysis.md`（现状核对）与 ADR-0001~0003 的补充。
>
> 核心约束：**`jsb`（TS）与 `jsb-core`（Rust）都必须是纯框架，不含任何业务逻辑**；
> 业务调用收敛到 `bridge`（TS）与业务后端（Rust）；各端 JSB 对接层统一基于 `jsb-core` 封装，不再各自写代码。
>
> **落地状态（2026-09-02，2026-09-04 更新）**：Rust 侧分层与三端宿主迁移均已落地。`jsb-core` 现为纯 JSB 框架：`Jsb`（原 `JsbEngine`）通过注入的 `JsbTransport` 直接向 WebView Channel 发送响应/事件/二进制，通过 `JsbHandler` 把具体方法委托给 `shell360-runtime`；平台不再解释 Rust 输出列表，`EngineOutput`/`NativeEngineOutput`/`InvokeFlow` 已删除（详见 `rust-owned-webview-transport.md`）。Rust 测试、clippy 与协议 golden 全部通过；Android/iOS/HarmonyOS 的构建与真机验证状态见 `rust-owned-webview-transport.md` §11。

---

## 1. 目标分层

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

分层职责一句话：

| 层 | 语言 | 职责 | 是否含业务 |
| --- | --- | --- | --- |
| `bridge` | TS | 业务调用，`jsb.invoke` 的类型安全封装 | ✅ 业务 |
| `jsb` | TS | JSB 协议/通道/事件的纯框架 | ❌ 纯框架 |
| 各端对接 | Kotlin/Swift/ArkTS | 传输适配 + `HostServices` 系统原语 | 系统原语，非 JSB 业务 |
| `shell360-ffi` / `shell360_ohrs` | Rust | UniFFI / NAPI 绑定，包装 `jsb-core` | ❌ 仅绑定 |
| `jsb-core` | Rust | JSB 引擎纯框架 | ❌ 纯框架 |
| `shell360-runtime` | Rust | 业务调度 + 方法表 | ✅ 业务 |

---

## 2. 现状核对

### 2.1 已经符合目标

- **`jsb`（TS）完全通用**：`jsb.ts` 的 `invoke<TRequest, TResponse>(method: string, data?)` 只做序列化/路由/事件，`types.ts`/`protocol.ts`/`jsb_channel.ts`/`channel_registry.ts`/`error.ts` 无任何业务方法名或业务类型。✅
- **`bridge`（TS）已是业务封装**：`bridge/src/native.ts` `import jsb, { JSBChannel, JSBError } from "jsb"`，各能力子包（`data/ssh/fs/dialog/...`）基于 jsb 封装。✅
- **业务调度未在平台重复**：`shell360_ohrs` 直接复用 `shell360-ffi` 的 `Shell360Runtime` 与 `NativeJsb`（`OhrsJsbTransport` 实现 `shell360_ffi::JsbTransport`），没有为 HarmonyOS 单独重写方法分发。✅

### 2.2 已修复（本次落地）：`jsb-core` 已纯化 ✅

`jsb-core` 是 `crates/jsb-core`，依赖只有 `serde/serde_json/thiserror/uuid`（无业务 crate 依赖）。此前业务知识以**硬编码字符串**渗入，现已全部外移到业务后端 `shell360-runtime`：

1. **方法表外移**：`jsb-core::methods.rs` 里的 `METHOD_SPECS`（70 个业务方法名）、`method_events()`（`data.authedChange`、`ssh.session.disconnect`、`ssh.shell.eof/close`、`ssh.sftp.eof/close`）、`method_specs()`、`method_typescript()` 已整体迁到 `shell360-runtime::methods`。
2. **业务策略类型外移**：`jsb-core::methods` 已删除；`MethodSpec`、事件/错误域元数据、scoped-file 规则和二进制绑定规则均由 `shell360-runtime` 持有，核心构造时只接收允许调用的方法名。
3. **路由改为 handler 委托**：核心不认识“某方法属于 Rust 还是宿主”。`JsbHandler::invoke(context, request, completion)` 由 `shell360-runtime::RuntimeInvoker` 实现；方法在 Rust 内完成则调用 `completion.resolve/reject`，需要平台能力时由 runtime 经 `RuntimeHostServices::host_call` 发起 HostCall，平台完成后回到 `complete_host_call` 再由 runtime 完成同一个 completion。宿主原语、continuation 对核心均不透明。
4. **业务特例外移**：
   - `ssh.sftp.uploadFile/downloadFile` 的 staging、参数改写、续跑和清理由 `shell360-runtime` 执行；核心只持有 pending request 与一次性 completion。
   - `ssh.shell.open` 的 `(clientId, sshShellId) -> dataChannelId` 绑定由 `shell360-runtime` 保存；核心二进制接口只认识 `channelId`。
   - `data.resetCrypto` 重启等后置宿主动作为 `shell360-runtime` 内部编排，不经过核心。
5. **`Jsb::new(transport, handler, methods)`**：传输出口（`JsbTransport`）、方法处理器（`JsbHandler`）与允许调用的方法名均由构造注入；业务元数据不进入核心。

### 2.3 各端对接现状

- `shell360-ffi`：**仅绑定层** ✅ —— `NativeJsb` 包装 `jsb-core::Jsb`（构造时注入 `FfiJsbTransport` 适配器 + `RuntimeInvoker` + `shell360_runtime::method_specs()` 方法名）；UniFFI 暴露 `JsbTransport`/`HostServices` callback interface；runtime 事件和 SSH 二进制在 Rust 内部直达 `NativeJsb`，所有入口返回 `Result<(), FfiError>`，不再有输出类型转换。业务运行时 `Shell360Runtime` 在 `shell360-runtime`，此处只保留 `#[uniffi::Object]` 薄包装（构造 + `shutdown()`）。
- `shell360_ohrs`：`jsb_*` NAPI 入口（`jsbOpenChannel`/`jsbReceiveText`/…）全部返回 `Result<()>`；Rust 端 `OhrsJsbTransport` 实现 `shell360_ffi::JsbTransport`，经 `JsbTransportEvent` ThreadsafeFunction 驱动 ArkTS；旧的 `jsb_engine_*`、输出 JSON 数组和直连 `invoke`/`release_client`/`send_ssh_shell_data` 导出均已删除。
- Android（Kotlin）、iOS（Swift）与 HarmonyOS（ArkTS）：**迁移完成** ✅ —— 三端只做两件事：实现 `JsbTransport`（WebView 端口操作，UI 线程）与 `HostServices`（系统原语）；不再解释任何 Rust 输出列表，不再手写逐方法 handler。

---

## 3. 改造落地记录

> 本节 P1–P5 记录 2026-09-02/03 的中间落地形态（`JsbEngine` + `MethodInvoker`/`InvokeFlow` 委托 + 平台解释输出列表）。该中间形态已被 **P6（Rust 直连 WebView 通道）** 取代：`JsbEngine` 更名为 `Jsb`，`InvokeFlow`/`EngineOutput`/`NativeEngineOutput` 全部删除，改为 `JsbTransport` + `JsbHandler` + `JsbInvokeCompletion`，详见 `rust-owned-webview-transport.md`。以下条目保留历史脉络，其中涉及旧接口名之处均以 P6 最终形态为准。

### 3.1 让 `jsb-core` 纯化（本次核心）✅ 已落地

**方法表外移**：把 `METHOD_SPECS`（70 个名字）从 `jsb-core::methods.rs` 移到业务后端 `shell360-runtime`。`Jsb::new` 接收传输、处理器与方法表：

```rust
impl Jsb {
  pub fn new(
    transport: Arc<dyn JsbTransport>,
    handler: Arc<dyn JsbHandler>,
    methods: impl IntoIterator<Item = impl Into<String>>,
  ) -> Self { ... }
}
```

`MethodSpec` 只存在于 `shell360-runtime`，用于业务类型生成和检查；`jsb-core` 不再导出业务策略类型。

**宿主路由去业务化（最终形态）**：

```rust
// jsb-core：核心只认识通用 handler 与一次性 completion，method/primitive 对它不透明
pub trait JsbHandler: Send + Sync {
  fn invoke(&self, context: JsbInvokeContext, request: JsbInvokeRequest,
            completion: Arc<dyn JsbInvokeCompletion>);
  fn receive_binary(&self, context: JsbChannelContext, data: Vec<u8>) -> Result<(), JsbHandlerError>;
  fn close_channel(&self, context: JsbChannelContext);
  fn release_client(&self, client_id: String);
}
```

| 改造前（硬编码） | 最终形态（通用机制） |
| --- | --- |
| `MethodKind::Host(HostPrimitive::ReadClipboard)` 静态方法分类 | `shell360-runtime::methods::host_primitive(method)` 路由表由 `RuntimeInvoker` 查询；需要宿主能力时经 `RuntimeHostServices::host_call` 发起 HostCall，结果经 `complete_host_call` 回到 runtime 完成 completion |
| 核心按 `HostPrimitive::OpenExternal` 特判做 URL scheme 校验 | `shell360-runtime` 在发起 HostCall 前校验（`BRIDGE_INVALID_REQUEST` 信封不变） |
| 核心返回 `host_actions: Vec<HostAction>` 后置动作 | 后置宿主动作（如 `data.resetCrypto` 重启）由 `shell360-runtime` 在 completion 前后自行编排，不经过核心 |

**其余特例去业务化（通用化）**：

| 现状（硬编码方法名） | 目标（通用机制） |
| --- | --- |
| `ssh.sftp.uploadFile/downloadFile` 特判 | `shell360-runtime` 创建 staging、挂起 HostCall continuation，并在宿主完成后续跑或清理 |
| `ssh.shell.open` 绑定 | `shell360-runtime` 维护 `(clientId, sshShellId) -> dataChannelId`，核心只按 `channelId` 收发二进制 |
| `data.resetCrypto` 重启 | `shell360-runtime` 内部编排 reset host call，核心无感知 |

**删旧双轨**：`JsbRegistry`/`JsbConnection` 及 FFI 边界上的旧导出已在三端宿主全部迁移后删除（✅ P2 收尾；P6 进一步删除了输出列表双轨）。

### 3.2 crate 拆分（业务与 FFI 分离）✅ 已落地

- 新增 **`shell360-runtime`**：从 `shell360-ffi` 抽出 `Shell360Runtime`（`DataService`/`SshService`/`keygen` 调度）+ 方法表 + 宿主路由表 + `RuntimeInvoker`（`impl JsbHandler` + HostCall continuation 表）。这是唯一的业务实现。
- **`shell360-ffi`** 只保留 UniFFI 绑定：`NativeJsb`（包装 `jsb-core::Jsb`，构造注入 `FfiJsbTransport` + `RuntimeInvoker`）+ `JsbTransport`/`HostServices` callback interface + 类型转换。无业务分发。
- **`shell360_ohrs`** 只保留 NAPI 绑定：`jsb_*` 入口（包装 `NativeJsb`）+ `OhrsJsbTransport`（Rust 内实现 `JsbTransport`，经 `JsbTransportEvent` ThreadsafeFunction 驱动 ArkTS）+ HostServices/事件回调，依赖 `jsb-core` + `shell360-runtime`。

依赖方向变为单向：`shell360-runtime → {jsb-core, shell360-store, shell360-ssh, shell360-keygen}`；`shell360-ffi / shell360_ohrs → {jsb-core, shell360-runtime}`。

### 3.3 宿主迁移（消除“各端单独写代码”）✅ 已落地（P6 最终形态）

- **Android** ✅：`JsbPortBridge.kt` 直接实现 UniFFI `JsbTransport` callback（`webView.post` 切主线程写端口），入站帧经 `NativeJsb.receiveText/receiveBinary/openChannel/...` 进入 Rust；`RustBridge.kt` 只保留 runtime 生命周期与 `createJsb(transport, hostServices)`；`executeOutputs`/输出类型转换已删除。
- **iOS** ✅：`WebViewContainer.swift` 持有 `NativeJsb` + `IosJsbTransport`（`DispatchQueue.main.async` 投递 `receive` 信封，Base64 仅存在于该适配器的 binary 帧）；`RustBridge.swift` 提供 `createJsb(transport:hostServices:)`；`JavaScriptBridge.swift` 保留页面内 MessagePort 中转并自行发 `channel.opened`；输出解释逻辑已删除。
- **HarmonyOS** ✅：`MessagePortBridge.ets` 经 `attachJsbTransportCallback` 接收 `JsbTransportEvent` 驱动 ArkWeb 端口，入站帧走 `jsbReceiveText/jsbReceiveBinary/...`；`HarmonyHostServices.ets` 实现宿主原语并回调 `jsbCompleteHostCall`；输出 JSON 数组与 69 个手写 handler 已删除。

三端只做两件事：**传输适配（实现 `JsbTransport`）** + **`HostServices` 系统原语实现**；方法编排、错误模型、pending 生命周期与帧顺序由 Rust（`jsb-core` + `shell360-runtime`）承担；原语参数校验与业务策略（URL scheme 等）由 `shell360-runtime` 承担。

---

## 4. 统一与不统一的边界（修正版）

**统一（收敛到 `jsb-core` 纯框架，注入式）**：
- 方法路由与校验、pending 请求、响应/错误信封、事件路由、通道/生命周期、帧上限、UUID 校验。
- 异步方法的**通用机制**：`JsbHandler::invoke` 拿到 `Arc<dyn JsbInvokeCompletion>`，`resolve`/`reject` 经 `AtomicBool` 保证一次性；close/release/shutdown 时核心取消 pending 并通知 handler。具体 HostCall、scoped 文件和二进制绑定策略不进入核心。
- 通道收发的**唯一出口** `JsbTransport`（open/fail/send_text/send_binary/close），核心不调用任何平台 SDK，也不返回供平台解释的输出列表。

**不统一（刻意保留，且不再放进 `jsb-core`）**：
- **业务方法名 + 业务调度 + 宿主路由表**：归 `shell360-runtime`（单一 Rust 实现）。`method_typescript()` 随之从 `jsb-core` 移到 `shell360-runtime`，生成的 `JsbMethod` 声明由 `bridge` 消费（不是 `jsb`）；“哪个方法交给哪个宿主原语”同样由 `shell360-runtime::methods::host_primitive()` 决定。
- **`HostServices` 系统原语实现**：各平台各一份（剪贴板/文件选择/打开 URL/系统栏/关窗/scoped 文件/生物识别），但参数校验、URL scheme、路径 canonicalize、staging、错误模型归 Rust（`jsb-core` 管机制，`shell360-runtime` 管业务策略）。
- **传输适配器**：Android/HarmonyOS 用 WebMessagePort；iOS 用 WKScriptMessage（Base64 仅 iOS 适配器内部）。
- **前端 `bridge/*` API 与 Tauri 桌面端**：不变。

---

## 5. 落地顺序建议

1. **P1-jscore** ✅ 已落地：业务方法表外移，核心只接收允许调用的方法名。`jsb-core` 已满足“零业务”。
2. **P2-runtime** ✅ 已落地：拆出 `shell360-runtime`，`shell360-ffi` 减到只做绑定（`shell360_ohrs` 已 `use shell360_ffi`，随之一同收益）。
3. **P2-iOS / P2-HarmonyOS** ✅ 已落地：iOS（`WebViewContainer` + `IosHostServices`）与 HarmonyOS（`MessagePortBridge` + `HarmonyHostServices`）均已迁移到引擎，与 Android 对齐。
4. **P2 收尾** ✅ 已落地：删 `jsb-core`/`shell360-ffi`/`shell360_ohrs` 的旧 `Registry/Connection` 导出。
5. **P3** 🟡 部分落地：`app.getVersion` 与 `machineUid.getMachineUid` 已从过渡 `Host` 原语移回 Rust；app-local `fs` 仍待「app-local 与 scoped URI 拆路径」后回迁；`method_typescript()` 产物接入 `bridge` 属 P4。
6. **P4-jscore** ✅ 已落地：`jsb-core` 删除 `HostPrimitive` 枚举与 `MethodKind` 分类，宿主路由改为 `MethodInvoker` 委托（`InvokeFlow::Complete` / `InvokeFlow::Delegate`）；宿主路由表与 `core.openUrl` scheme 校验迁到 `shell360-runtime`。`jsb-core` 现可作为通用 JSB 框架复用。
7. **P5-library** ✅ 已落地：scoped-file 与 SSH binary binding 已下沉到 `shell360-runtime`；`jsb-core` 仅持有不透明 continuation 和 channel ID。
8. **P6-transport** ✅ 代码已落地（平台构建/真机验证见 `rust-owned-webview-transport.md` §11）：删除输出列表模型，`JsbEngine`→`Jsb`，新增 `JsbTransport`/`JsbHandler`/`JsbInvokeCompletion`；`shell360-runtime::RuntimeInvoker` 实现 `JsbHandler` 并持有 HostCall continuation 表；`shell360-ffi` 暴露 `NativeJsb` + `JsbTransport` callback；三端（Android `JsbPortBridge`、iOS `IosJsbTransport`、HarmonyOS `OhrsJsbTransport`+`MessagePortBridge`）改为 transport 直连，`EngineOutput`/`NativeEngineOutput`/`executeOutputs`/`jsb_engine_*` 全部删除。
