# JSB 统一化历史记录

> 本文件归档已过时的设计与分析，仅作决策 / 迁移历史保留。当前架构以
> `architecture.md`（架构设计）与 `protocol.md`（协议规范）为准。
>
> 下文所有条目记录的 `JsbEngine` + `Vec<EngineOutput>` + 输出列表解释模型已被删除。
> 当前实现中 `jsb-core::Jsb` 通过注入的 `JsbTransport` 直接收发 WebView Channel，入口
> 只返回 `Result<(), JsbError>`；具体方法由 `shell360-runtime` 通过 `JsbHandler` 实现。

## 迁移背景：为什么删除输出列表模型

迁移前，Rust 与 WebView 之间采用“计算输出、平台执行”的两段式模型：

```text
WebView MessagePort
  -> 平台层接收文本或二进制
  -> NativeJsbEngine / jsb_engine_* 调用 jsb-core
  -> Vec<EngineOutput>
  -> Kotlin / Swift / ArkTS 遍历并解释 EngineOutput
  -> 平台层写回 MessagePort
```

该模型的问题：

1. `Engine` 是实现视角的抽象，与 TypeScript `jsb` 库的 `JSB`、`invoke`、`emit`、`JSBChannel`
   术语不一致。
2. `EngineOutput` 不是前端业务返回值，而是要求平台继续执行的中间指令，容易产生误解。
3. 三个平台都需要维护输出类型转换、序列化和 `executeOutputs` 分支。
4. Rust 只负责“算出下一步”，并未真正接管 JSB 通道的发送生命周期。
5. HostCall 混在核心输出中，但在 FFI 层又被 callback 消费，核心输出与平台可见输出并不等价。

因此删除输出列表模式：`jsb-core` 通过平台注入的通用传输接口直接收发 WebView 消息，通过注入的
调用接口将具体方法交给 `shell360-runtime` 实现（即当前 `architecture.md` 所述架构）。

## 1. ADR-0001: JsbEngine contract and method-table design

Status: Superseded by the current architecture (was: Accepted for P1 implementation).

### Decision

`jsb-core::JsbEngine` is the sole transport-independent owner of method routing, invoke validation, pending requests, response/error envelopes, events, logical channel bindings, configurable frame limits, UUID validation, and first/last channel client lifecycle.

Inputs are `on_control_frame(channel_id, text)`, `on_binary_frame(channel_id, bytes)`, `on_channel_open(channel_id)`, `on_channel_close(channel_id)`, and `complete_host_call(call_id, result_json)`. Every input returns an ordered `Vec<EngineOutput>`.

Outputs are `ReplyText`, `PushBinary`, `OpenChannel`, `FailChannel`, `ClosePort`, and `HostCall`. Host execution must preserve vector order and must not inspect business method names or payload fields.

The declarative Rust method table records dotted-camel method name, `Rust` or `Host` kind, Rust handler or host primitive, events, binary behavior, error domain, and capability metadata. It drives routing, binding export lists, generated TypeScript method-name declarations, and contract-case generation.

Channel IDs are RFC 4122 UUID strings. Frame limits default to 1 MiB for text and 10 MiB for binary; each platform may override them before opening the first Channel. Text input is checked before JSON parsing. Deterministic tests inject the client/call ID source; production IDs remain UUIDs.

### Compatibility decision

P1 adds the engine entrypoints while retaining the current `NativeJsbRegistry`/`NativeJsbConnection` and OHRS register/connect/dispatch/resolve/reject API for one version. P2 removes each platform's use of the legacy API independently. Removal of exported legacy bindings occurs only after all three hosts have migrated.

### Consequences

WebView hosts become instruction executors. A new Rust method changes only the Rust table; a new host method also adds one primitive implementation per platform. The Tauri backend and `bridge/src/tauri.ts` are outside this decision and remain behaviorally unchanged.

## 2. P1 JsbEngine implementation

### Implemented

- `jsb-core::JsbEngine` owns UUID/channel state, the first/last channel client lifecycle, configurable frame limits (default 1 MiB text and 10 MiB binary), invoke validation, the 69-method union table, pending HostCalls, unified response envelopes, control-channel events, and `(clientId, sshShellId) -> dataChannelId` binary routing.
- `MethodInvoker` keeps `jsb-core` independent of the application crate. `shell360-runtime` implements it with the existing `Shell360Runtime`; SSH/data/keygen code is not duplicated.
- **Updated (2026-09-03)**: Rust/Host routing is no longer a static classification inside the engine. `MethodInvoker::invoke` returns `InvokeFlow::Complete(outcome)` or `InvokeFlow::Delegate { primitive, params_json, continuation }`, where the primitive and optional continuation are opaque to the engine. Shell channel bindings and scoped-file staging live in `shell360-runtime`; `jsb-core` only resumes or cancels opaque continuations.
- UniFFI exposes `NativeJsbEngine`, `NativeEngineOutput`, and the asynchronous `HostServices.onHostCall` delivery boundary. A HostCall is delivered once through the callback; `completeHostCall` returns the resulting reply output.
- OHRS exposes matching channel-open, channel-close, control-frame, binary-frame, and HostCall-completion functions. HostCalls use a thread-safe callback.
- The legacy Registry/Connection and OHRS register/connect/dispatch/resolve/reject/close exports were compatibility-only and have been removed now that all three hosts run `JsbEngine` (P2 cleanup complete).

### Deliberately deferred

- No Android, iOS, or HarmonyOS host calls the engine yet.
- `app.getVersion` and `machineUid.getMachineUid` have moved back to Rust (P3): the version is `env!("CARGO_PKG_VERSION")` and the machine UID is a UUID v4 persisted at `app_data_dir/machine_uid`. Their transitional `GetAppVersion`/`GetMachineUid` Host primitives are removed. The legacy per-host machine UID values still need a one-time migration read.
- app-local `fs` remains a transitional Host primitive: `fs.readTextFile`/`writeTextFile` carry both app-local (known_hosts) and scoped URI (import/export/add-key) semantics, so moving the method to Rust requires first splitting those two paths at the business layer.
- Scoped SFTP upload/download is orchestrated by the engine around `readScopedFile`/`writeScopedFile`. The host only moves bytes between a user-authorized URI and an engine-managed staging path.
- `core.healthCheck` and JSON `ssh.shell.send` remain in the union table until P3 validates the iOS binary path and chooses removal or cross-platform alignment.
- Generated TypeScript text is deterministic and tested through `method_typescript`; the checked-in declaration is consumed by `bridge/native`, while generic `jsb` continues to accept opaque method strings.
- P0 device captures remain missing. Rust replay and host builds are not presented as device evidence.

## 3. P2 Android host migration

### Change list

- Replaced the Android dispatcher, route table, and channel manager with `JsbPortBridge`.
- Added `PlatformHostServices` for Android system primitives only.
- Routed text frames, binary frames, channel lifecycle, Rust events, and shell bytes through `NativeJsbEngine`.
- Removed Android-side shell binding and all parsing of `ssh.shell.open` parameters.
- Preserved the existing WebView capability checks, origin allowlist, navigation policy, machine ID storage, app-local file boundary, scoped URI handling, reset behavior, and system-bar/window callbacks.
- Kept the separately staged mobile Back-navigation changes intact.

### Compatibility mapping

| Previous Android path | Engine path | Behavior |
| --- | --- | --- |
| `Jsb.dispatch` plus `registerAndroidRoutes` | `JsbEngine.on_control_frame` | Same invoke response envelope; routing is Rust-owned |
| `WebViewBridge` channel map | `JsbPortBridge` plus engine channel state | Same transferred WebMessagePort and binary support |
| `bindShellChannel` | Engine `(clientId, shellId) -> channelId` binding | Same targeted shell byte delivery without host business parsing |
| `AndroidBridgeServices` | `PlatformHostServices` | Same Android system calls; errors are returned to the Rust envelope builder |
| Android scoped SFTP route branches | Engine HostCall orchestration | Same URI-to-staging transfer with the business invoke owned by Rust |

### Verification

- Rust unit and golden replay tests pass for `jsb-core`.
- UniFFI unit tests pass for `shell360-ffi`.
- Android debug Kotlin and instrumentation-test sources compile.
- The repository Android runner produced both `app-debug.apk` and `app-debug.aab`, including arm64 and x86_64 Rust libraries.
- Structural scans find no Android dispatcher/route-table references, `bindShellChannel`, shell binding map, or `ssh.`/`data.` business method strings in the Android host bridge.

### Not yet claimed

- No Android device was attached for this change, so the full authentication, shell, SFTP, data, platform primitive, lifecycle, and WebView-provider smoke matrix remains pending device execution.
- P0 device-captured byte-for-byte frame evidence is still unavailable. Rust golden replay and build success are not substitutes for that evidence.
- iOS and HarmonyOS remain on their compatibility paths and must be migrated in separate P2 changes.

## 4. 统一化现状梳理与边界分析（unification-analysis）

> 目标：将三端移动宿主（Android / iOS / HarmonyOS）的 **JSB 基础框架（jsb core）** 在 Rust 侧完全统一；
> 前端暴露的 `bridge/*` API 保持不变；后端统一由 Rust 实现；`ssh.*`、`data.*` 等具体业务调用不在本次统一范围。

### 结论摘要

- 统一的“锚点”已经存在：`crates/jsb-core::JsbEngine` 是传输无关的路由/校验/信封/生命周期引擎，配合注入式 `MethodInvoker`（`InvokeFlow::Complete` / `Delegate`）委托机制，已经是“jsb core 统一”的完整 Rust 实现；宿主原语词汇不再由引擎持有。
- ✅（已修复，2026-09-02）`jsb-core` 的**业务泄漏已消除**：`methods.rs::METHOD_SPECS`（69 个业务方法名）与业务事件名、`engine.rs` 按方法名写死的特例已外移到业务后端 `shell360-runtime`；方法表由构造注入。
- ✅（已修复，2026-09-03）**业务策略已全部移出引擎**：`jsb-core` 不再导出 `MethodSpec`/`ScopedFileKind`/`BinaryBindSpec`，不再持有 SSH binding 或 scoped-file staging。
- 三端进度已对齐：Android / iOS / HarmonyOS 三端宿主均已迁移完成。
- 统一范围只应是“基础框架”：方法路由、invoke 校验、pending 请求、响应/错误信封、事件、逻辑通道绑定、可配置帧上限、UUID 校验、首/末通道 client 生命周期。
- 明确不统一的三块，本质上是“平台适配层”，必须保留各自实现：
  1. **业务方法**（`keygen.*` / `data.*` / `ssh.*`）——由 `MethodInvoker` 在 Rust 侧单一实现。
  2. **系统原语**（`HostServices`）——各平台各写一份原语实现，但编排、校验、错误模型归 Rust。
  3. **传输适配器**（WebMessagePort / WKScriptMessage+Base64）——物理通道各平台不同。

### 现状梳理

| 层 | 位置 | 统一性 | 说明 |
| --- | --- | --- | --- |
| 前端能力 API | `bridge/src/*.ts` | 保持现状 | 对外暴露的 `BridgeBackend` 接口与调用签名不变（ADR-0003） |
| 前端 JSB 框架 | `jsb/src/*.ts` | 保持现状 | 只通过 `window.__JSB__.openChannel/closeChannel` + MessagePort 协议与原生通信 |
| 原生传输 | 各宿主 | 平台各自实现 | Android/HarmonyOS 用 WebMessagePort；iOS 用 WKScriptMessage（二进制走 Base64） |
| JSB 引擎（统一点） | `crates/jsb-core` | Rust 统一 | `JsbEngine` + 方法名允许集 + `MethodInvoker` 委托 |
| FFI 边界 | `crates/shell360-ffi` / `crates/shell360_ohrs` | 统一生成 | 同一份引擎导出到三端 |
| 业务运行时 | `crates/shell360-runtime` | Rust 统一 | 唯一业务实现 |

三端宿主对照（均已迁移）：

| 关注点 | Android | iOS | HarmonyOS |
| --- | --- | --- | --- |
| 路由 | `JsbPortBridge` → `NativeJsbEngine` | `WebViewContainer` → `NativeJsbEngine` | `MessagePortBridge` → `jsb_engine_*`（NAPI） |
| 系统原语 | `PlatformHostServices.kt` | `IosHostServices.swift`（14 原语） | `HarmonyHostServices.ets`（14 原语） |
| 二进制/Shell | 引擎 `(clientId, shellId)→channelId` 绑定 | 引擎 `pushShellBinary` / `onBinaryFrame` | 引擎 `jsbEnginePushShellBinary` / `jsbEngineBinaryFrame` |
| 传输 | WebMessagePort | WKScriptMessage（Base64） | WebMessagePort |

### iOS 通道模型映射

iOS 没有跨 WK 边界的 WebMessagePort，`JavaScriptBridge.swift` 注入的适配器在**页面内部**
自建 `MessageChannel`，Swift 只经 `WKScriptMessage` 中转文本 / Base64 二进制。引擎的
`PushBinary`/`ClosePort` 输出映射为适配器的 `receive` 信封（`kind: "binary"` / `"close"`），
`OpenChannel` 控制帧映射为适配器的 `channel.opened` + `port2` 转移。

### 迁移后清理（已完成）

- `jsb-core`：已删除 `JsbRegistry`/`JsbConnection`。
- `shell360-ffi`：已删除 `NativeJsbRegistry`/`NativeJsbConnection`。
- `shell360_ohrs`：已删除 `register_jsb/connect_jsb/dispatch_jsb/resolve_jsb/reject_jsb/close_jsb`。

### 主要风险

- iOS 通道模型映射（页面内 MessagePort + WKScriptMessage 中转）仍最需要 device capture 验证。
- `HostServices` 回调线程模型：Android 用 `HandlerThread` + `webView.post`；iOS 的 WKScriptMessage
  处理器与 Swift 并发、HarmonyOS 的 ETS 回调线程都需要独立纪律。
- `machineUid` 迁移期连续性：旧值仍残留于各平台，需一次「各宿主读取旧值并迁移到 Rust 存储」的收尾。
- `app.getVersion` 当前返回 Rust crate 版本而非真实 App 版本（占位，后续改为构造参数注入）。
- `fs` 尚未回迁：需先拆 app-local 与 scoped URI 两条路径。
- P0 device capture 缺失：Rust golden replay 与编译通过不构成端到端证据。

## 5. `jsb-core` 纯化落地记录

### 已修复：`jsb-core` 纯化

`jsb-core` 是 `crates/jsb-core`，依赖只有 `serde/serde_json/thiserror/uuid`。此前业务知识以
硬编码字符串渗入，现已全部外移到业务后端 `shell360-runtime`：

1. **方法表外移**：`jsb-core::methods.rs` 里的 `METHOD_SPECS`（70 个业务方法名）、
   `method_events()`、`method_specs()`、`method_typescript()` 已整体迁到 `shell360-runtime::methods`。
2. **业务策略类型外移**：`MethodSpec`、事件/错误域元数据、scoped-file 规则和二进制绑定规则
   均由 `shell360-runtime` 持有，核心构造时只接收允许调用的方法名。
3. **路由改为 handler 委托**：核心不认识“某方法属于 Rust 还是宿主”。`JsbHandler::invoke` 由
   `shell360-runtime::RuntimeInvoker` 实现。
4. **业务特例外移**：`ssh.sftp.uploadFile/downloadFile` 的 staging、`ssh.shell.open` 的绑定、
   `data.resetCrypto` 重启均由 `shell360-runtime` 执行。
5. **`Jsb::new(transport, handler, methods)`**：传输出口、方法处理器与允许调用的方法名均由构造注入。

### P1–P6 落地顺序（均已落地）

1. **P1-jscore**：业务方法表外移，核心只接收允许调用的方法名。
2. **P2-runtime**：拆出 `shell360-runtime`，`shell360-ffi` 减到只做绑定。
3. **P2-iOS / P2-HarmonyOS**：iOS 与 HarmonyOS 均迁移到引擎，与 Android 对齐。
4. **P2 收尾**：删 `jsb-core`/`shell360-ffi`/`shell360_ohrs` 的旧 `Registry/Connection` 导出。
5. **P3**：`app.getVersion` 与 `machineUid.getMachineUid` 移回 Rust；app-local `fs` 仍待拆分。
6. **P4-jscore**：`jsb-core` 删除 `HostPrimitive` 枚举与 `MethodKind` 分类，改为 `MethodInvoker` 委托。
7. **P5-library**：scoped-file 与 SSH binary binding 下沉到 `shell360-runtime`。
8. **P6-transport**：删除输出列表模型，`JsbEngine`→`Jsb`，新增 `JsbTransport`/`JsbHandler`/
   `JsbInvokeCompletion`；三端改为 transport 直连，`EngineOutput`/`NativeEngineOutput`/
   `executeOutputs`/`jsb_engine_*` 全部删除。

### 中间形态（P1–P5，已被 P6 取代）

P1–P5 记录的是 `JsbEngine` + `MethodInvoker`/`InvokeFlow` 委托 + 平台解释输出列表的中间形态。
该中间形态已被 P6（Rust 直连 WebView 通道）取代：`JsbEngine` 更名为 `Jsb`，`InvokeFlow`/
`EngineOutput`/`NativeEngineOutput` 全部删除，改为 `JsbTransport` + `JsbHandler` +
`JsbInvokeCompletion`。

crate 拆分后依赖方向：`shell360-runtime → {jsb-core, shell360-store, shell360-ssh,
shell360-keygen}`；`shell360-ffi / shell360_ohrs → {jsb-core, shell360-runtime}`。

## 6. P0 平台漂移快照

> 本节记录 P0 时期三端尚未统一时的方法注册与错误码漂移。帧信封格式、帧序列与完整方法表的
> **当前规范**见 `protocol.md`；下述漂移在统一迁移中大部分已由 `jsb-core` /
> `shell360-runtime` 收敛。

### 6.1 方法注册差异（P0）

P0 时期三端注册并不完全一致：Android 缺 `ssh.shell.send` 与 `core.healthCheck`；HarmonyOS 缺
`core.healthCheck`；iOS 注册全部。`ssh.shell.open` 曾在三端 transport 桥中额外解析以绑定
`dataChannelId` 到 `(clientId, sshShellId)`（现由 `shell360-runtime` 持有）；iOS 还保留
JSON/base64 的 `ssh.shell.send` invoke 路径。

方法族归属（P0）：

| Family | Android | iOS | HarmonyOS | 归属 |
| --- | --- | --- | --- | --- |
| `bridge.health` | local | local | Rust pass-through | drifted |
| `core.healthCheck` | absent | local/Rust | absent | iOS-only redundant route |
| `app.*` | Rust | Rust | Rust | Rust-owned |
| `machineUid.*` | Rust | Rust | Rust | Rust-owned |
| `clipboard.*`/`dialog.*`/`core.openUrl`/`window.close` | platform | platform | Rust-to-platform | host capabilities |
| `fs.*` | platform scoped | local file APIs | Rust-to-platform | transitional Host primitive |
| `keygen.*`/`data.*`/`ssh.*` | Rust pass-through | Rust pass-through | Rust pass-through | duplicated routing |

### 6.2 错误码与帧上限漂移（P0）

| Condition | Android | iOS | HarmonyOS |
| --- | --- | --- | --- |
| not connected | `JSB_INVALID_MESSAGE` | `JSB_NOT_CONNECTED` | `JSB_INVALID_MESSAGE` |
| malformed invoke | `JSB_INVALID_MESSAGE`（多种原因） | `JSB_INVALID_MESSAGE`（generic） | `JSB_INVALID_MESSAGE`（native Error 文本） |
| missing method | `JSB_UNSUPPORTED` | `JSB_UNSUPPORTED` | `JSB_UNSUPPORTED` |
| handler failure | `JSB_NATIVE_ERROR` 或结构化 native code | `JSB_NATIVE_ERROR` 或 `BridgeCallbackError` | 归一 runtime error 或 `JSB_NATIVE_ERROR` |
| invalid channel ID | `JSB_CHANNEL_INVALID_ID` | 空 ID 静默忽略，其余不校验 | `JSB_CHANNEL_OPEN_FAILED` |
| request too large | `JSB_MESSAGE_TOO_LARGE`（1 MiB 文本 / 10 MiB 二进制，可配） | 无上限 | 无上限 |
| picker/系统失败 | 结构化 `BRIDGE_*` | 结构化 `BRIDGE_*` | 多条原始 `Error` 消息 |

统一后：方法表唯一来源 `shell360-runtime::methods::method_specs()`，错误码由 `jsb-core`
（框架码）与 `shell360-runtime`（业务/宿主码）统一产生，帧上限默认 1 MiB 文本 / 10 MiB
二进制（见 `protocol.md`）。

### 6.3 iOS 适配器差异与风险（P0）

iOS 适配器与 `jsb/` 在 `source`、`channelId`、`channel.opened`、`channel.open.failed` 与恰好一个
被转交的 port 上一致。P0 时期的差异与风险：

- Android/Harmony 在打开前校验 UUID 语法；iOS 只校验非空字符串。
- iOS `openChannel` 自建页面 port 并在 WK 处理前上报 opened；其他宿主创建/转交原生 port。
- iOS open 失败仅限页面侧 `window.postMessage` 操作；后续原生拒绝没有等价的 open-failed 路径。
- iOS 在公开的 open/close 之外暴露私有适配助手 `receive` 与 `emit`。
- iOS 二进制 Base64 与 version/kind 信封仅为适配器内部，尚无 schema 级互操作测试。
- 页面解析器接受 `source === null` 且空 origin 的原生消息；iOS 适配器投递同窗/同源消息。

## 7. Rust 直连 WebView 通道方案实施规划

本节记录直连 transport 方案的实施规划：分阶段迁移、兼容性要求、测试验证、可观测性、风险与
完成标准。各阶段均已落地，当前架构见 `architecture.md`。

### 7.1 分阶段迁移

**阶段 A：建立直连接口，不改业务路由**

1. 在 `jsb-core` 增加 `JsbTransport`、`JsbHandler` 和 completion 抽象。
2. 将 `JsbEngine` 重命名为 `Jsb`。
3. 保持现有协议、方法允许集、错误 JSON 和事件格式不变。
4. 为内存 Transport 编写完整单元测试。
5. 暂不删除旧输出模式，使用测试或 feature 隔离验证新路径。

验收：纯 Rust 测试能证明 `receive_text -> handler -> completion -> transport.send_text` 完整闭环。

**阶段 B：迁移 Android**

1. UniFFI 增加 `JsbTransport` callback 和 `NativeJsb`。
2. Android `JsbPortBridge` 实现 transport。
3. 删除 Android `executeOutputs` 路径。
4. 重新生成 UniFFI Kotlin bindings。
5. 验证 control、emit、HostServices、SSH binary 和关闭生命周期。

Android 先作为单平台试点；本阶段不同时改 iOS/HarmonyOS 的宿主实现。

**阶段 C：迁移 iOS**

1. 重新生成 Swift bindings。
2. WKWebView adapter 实现 transport。
3. 删除 Swift 输出解释逻辑。
4. 验证 iOS string/binary 回环及主线程约束。

**阶段 D：迁移 HarmonyOS**

1. OHRS 注册 transport callback。
2. ArkTS MessagePortBridge 改为 callback 驱动。
3. 删除输出 JSON 数组序列化与解释。
4. 验证 string/ArrayBuffer、HostServices 与生命周期。

**阶段 E：清理旧模型**

三端全部迁移后：

1. 删除 `EngineOutput`、`NativeEngineOutput` 及 kind；
2. 删除 `InvokeFlow::Delegate`、`HostAction`、`HostCallResult` 等已被 runtime completion 替代的核心机制；
3. 删除 `complete_host_call` 的 JSB core API；
4. 清理 `engine` 命名、旧 N-API 导出和生成绑定；
5. 更新现有 ADR 与架构文档。

阶段 E 不得早于三端迁移完成，避免维护两套不完整路径。

**落地状态**：

- 阶段 A（`jsb-core` 直连接口与纯 Rust 测试）：已完成。28 个单元测试 + golden 协议测试全部通过。
- 阶段 B（Android）：代码已完成，`JsbPortBridge` 实现 `JsbTransport`，`executeOutputs`/`NativeEngineOutput` 已删除；Gradle 构建与 instrumented 测试因当前环境无 Android SDK 未执行。
- 阶段 C（iOS）：代码已完成，`IosJsbTransport` 在 `DispatchQueue.main` 上投递，Base64 仅存在于 WKScriptMessage 二进制适配器；Xcode 编译与真机验证因当前环境为 Windows 未执行。
- 阶段 D（HarmonyOS）：代码已完成，`OhrsJsbTransport`（Rust）+ `JsbTransportEvent` ThreadsafeFunction + `MessagePortBridge.ets` callback 驱动，输出 JSON 数组已删除；hvigor/ohpm 构建与真机验证因当前环境限制未执行。
- 阶段 E（清理）：已完成。`EngineOutput`/`NativeEngineOutput`/kind、旧直连导出均已删除；`complete_host_call` 不再存在于 `jsb-core`；全仓搜索确认 JSB 领域无 `JsbEngine`/`EngineOutput`/`NativeEngineOutput`/`jsb_engine_*`/`executeOutputs` 残留。

### 7.2 兼容性要求

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

### 7.3 测试与验证

**jsb-core 单元测试**（使用 `FakeTransport` 和 `FakeHandler` 覆盖）：

- Channel open/open failed/close；UUID 校验；
- 普通 invoke 成功和失败；异步 completion；completion 只能完成一次；
- 重复 request ID；malformed JSON；未注册方法；
- 默认文本 1 MiB、二进制 10 MiB；平台可在打开首个 Channel 前覆盖实例限制；
- emit 只发送到 control Channel；Channel 关闭时取消 pending invoke；
- close 与 completion 并发；Transport 失败后的资源释放；
- binary 数据不经过 JSON 或 Base64。

保留并更新 current protocol golden test，证明线上协议字节不变。

**平台静态与构建验证**：

- Rust：受影响 crate 执行格式化、测试和 Clippy；
- UniFFI：重新生成 Kotlin/Swift bindings，并证明旧类型不存在；
- Android：Kotlin 编译和 debug/release 构建；
- iOS：在 macOS/Xcode 环境编译；
- HarmonyOS：OHRS、HAR/HAP 和 ArkTS 构建；
- TypeScript：`jsb`、`bridge`、`mobile` 类型检查与 Biome。

**真机验证**（每个平台至少验证）：

1. WebView 初始化和 control Channel 打开；
2. 一个纯 Rust invoke；
3. 一个需要平台能力的异步 invoke；
4. Rust 主动 emit；
5. SSH shell 双向原始二进制；
6. 多个并行 Channel；
7. 页面销毁、应用退后台和 runtime shutdown；
8. Transport 失败时有可诊断日志且不崩溃。

构建通过不能替代真机字节链路验证。

### 7.4 可观测性

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

### 7.5 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| Rust 持锁调用平台 callback | 重入或死锁 | 严格禁止锁内跨 FFI 调用 |
| callback 线程不符合 WebView 要求 | 崩溃或消息丢失 | 平台 transport 显式切换 UI 主线程 |
| completion 与 Channel close 竞争 | 重复响应或泄漏 | pending token 原子完成并做一次性消费 |
| transport callback 生命周期短于 `Jsb` | use-after-free 或发送失败 | 平台 owner 显式管理 attach/detach/shutdown |
| 三端同时迁移导致回归面过大 | 难以定位问题 | Android 试点后按平台逐个迁移 |
| HostCall 过早从 core 删除 | 现有平台能力中断 | completion 路径稳定且三端迁移后再清理 |
| 接口名称对齐但协议行为漂移 | 前端兼容性回归 | golden test 固定线上 JSON 和 Channel control 字节 |

### 7.6 完成标准

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

### 7.7 不在本方案范围内

- 重写 TypeScript `jsb` 公共 API；
- 改写 `bridge` 的业务接口；
- 将平台 WebView SDK 封装进 `jsb-core`；
- 将 SSH、SFTP、data 或 HostServices 业务实现迁入 `jsb-core`；
- 引入跨语言协议 schema 或生成 fixtures；
- 改变 Tauri 桌面端通信机制；
- 以 loopback server 替代 WebView MessagePort。

### 7.8 决策摘要

1. `jsb-core` 是纯 JSB 框架，不是 Shell360 业务后端。
2. Rust 通过注入的 `JsbTransport` 直接控制 JSB Channel 收发。
3. 具体 JSB 方法通过 `JsbHandler` 注入，由 `shell360-runtime` 实现。
4. 异步方法通过 `JsbInvokeCompletion` 完成，最终响应由 `jsb-core` 发送。
5. 平台只保留 WebView MessagePort/WKScriptMessage/ArkWeb Port 的薄适配。
6. 删除平台解释的输出列表，因此不再需要任何 `EngineOutput` 替代类型。
7. 迁移按 Android、iOS、HarmonyOS 逐平台推进，协议和前端 API 保持不变。

## 8. 命名迁移（Engine → Jsb）

统一迁移中删除了 JSB 领域所有 `Engine` 与输出列表命名：

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

不为替换名称新增同义的 `JsbOutput`、`JsbOperation` 或 `JsbCommand`；目标模型没有需要平台解释的
返回列表。依赖库中无关的 `base64::Engine`（SSH shell 发送路径）不在改名范围。
