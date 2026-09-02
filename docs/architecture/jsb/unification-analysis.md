# 移动端 JSB 功能统一：现状梳理与边界分析

> 目标：将三端移动宿主（Android / iOS / HarmonyOS）的 **JSB 基础框架（jsb core）** 在 Rust 侧完全统一；
> 前端暴露的 `bridge/*` API 保持不变；后端统一由 Rust 实现；`ssh.*`、`data.*` 等具体业务调用不在本次统一范围。

> **重要修正（见 `layering.md`）**：目标分层进一步明确为「`bridge` = 业务调用，`jsb` = JSB 纯框架，`jsb-core` = JSB Rust 纯引擎，二者都不含业务逻辑」。
> 据此，本文 §1/§3.1 中把「方法表 `method_specs()`（69 个方法）」归入 jsb core 统一范围的表述**已过时**——69 个业务方法名属于业务知识，应从 `jsb-core` 移到业务后端（`shell360-runtime`）。目标分层、差距与改造方案以 `layering.md` 为准。

本文是 `adr-0001`~`adr-0003`、`p1-engine.md`、`p2-android.md` 的现状核对与落地建议，不修改既有 ADR 基线。

---

## 1. 结论摘要

- 统一的“锚点”已经存在：`crates/jsb-core::JsbEngine` 是传输无关的路由/校验/信封/生命周期引擎，配合 `HostPrimitive` 原语枚举，已经是“jsb core 统一”的完整 Rust 实现。
- ✅（已修复，2026-09-02）`jsb-core` 的**业务泄漏已消除**：`methods.rs::METHOD_SPECS`（69 个业务方法名）与业务事件名、`engine.rs` 的 5 处按方法名写死的特例（`core.openUrl`/`ssh.sftp.uploadFile`/`downloadFile`/`ssh.shell.open`/`data.resetCrypto`）已外移到业务后端 `shell360-runtime`；`jsb-core` 现在只保留 `MethodSpec`/`MethodKind`/`HostPrimitive`/`ScopedFileKind`/`BinaryBindSpec` 泛型类型，方法表由构造注入。
- 三端进度已对齐：**Android / iOS / HarmonyOS 三端宿主均已迁移完成**（Android `JsbPortBridge` + `PlatformHostServices`；iOS `WebViewContainer` + `IosHostServices`；HarmonyOS `MessagePortBridge` + `HarmonyHostServices`），全部驱动 `jsb-core` 引擎。
- 统一范围只应是“基础框架”：方法路由、invoke 校验、pending 请求、响应/错误信封、事件、逻辑通道绑定、1 MiB 帧上限、UUID 校验、首/末通道 client 生命周期。这些已全部收敛到 `JsbEngine`。
- 明确不统一的三块，本质上是“平台适配层”，必须保留各自实现：
  1. **业务方法**（`keygen.*` / `data.*` / `ssh.*`）——由 `RustMethodInvoker` 在 Rust 侧单一实现（`shell360-ffi::RuntimeInvoker` → `Shell360Runtime`），已是统一的，不在此次改动。
  2. **系统原语**（`HostServices`：剪贴板、文件选择、打开 URL、系统栏、关窗、scoped 文件、生物识别等）——各平台各写一份原语实现，但**编排、校验、错误模型归 Rust**。
  3. **传输适配器**（Android WebMessagePort / iOS WKScriptMessage+Base64 / HarmonyOS WebMessagePort）——协议骨架一致，但物理通道各平台不同，属于不可统一部分。

---

## 2. 现状梳理

### 2.1 分层结构

| 层 | 位置 | 统一性 | 说明 |
| --- | --- | --- | --- |
| 前端能力 API | `bridge/src/*.ts`（`data/ssh/fs/dialog/…` + `backend.ts`） | 保持现状 | 对外暴露的 `BridgeBackend` 接口与调用签名不变（ADR-0003） |
| 前端 JSB 框架 | `jsb/src/*.ts`（`jsb.ts`/`jsb_channel.ts`/`channel_registry.ts`/`protocol.ts`） | 保持现状 | 只通过 `window.__JSB__.openChannel/closeChannel` + MessagePort 协议与原生通信 |
| 原生传输 | 各宿主 | 平台各自实现 | Android/HarmonyOS 用 WebMessagePort；iOS 用 WKScriptMessage（二进制走 Base64，仅适配器内部） |
| **JSB 引擎（统一点）** | `crates/jsb-core` | **Rust 统一** | `JsbEngine` + `MethodSpec` 表 + `HostPrimitive` |
| FFI 边界 | `crates/shell360-ffi`（UniFFI → Kotlin/Swift）、`crates/shell360_ohrs`（NAPI → ArkTS） | 统一生成 | 同一份引擎导出到三端；`shell360-ffi` 已瘦身为仅绑定层 |
| 业务运行时 | `crates/shell360-runtime::Shell360Runtime`（`keygen/data/ssh` + `shell360-store/ssh/keygen`） | Rust 统一 | 已从 `shell360-ffi` 抽出，唯一业务实现 |

### 2.2 jsb core 的“双轨”已收敛

✅（已清理，2026-09-02）`crates/jsb-core/src/lib.rs` 只保留统一 API `JsbEngine`（`on_channel_open/close/failed`、`on_control_frame`、`on_binary_frame`、`complete_host_call`、`emit`、`push_shell_binary`）+ `methods.rs` 的框架类型 `MethodSpec`/`MethodKind`/`HostPrimitive`/`ScopedFileKind`/`BinaryBindSpec`。旧的 `JsbRegistry`/`JsbConnection` 双轨，以及投影到两个 FFI 边界的 `NativeJsbRegistry`/`NativeJsbConnection`、`register_jsb/connect_jsb/dispatch_jsb/resolve_jsb/reject_jsb/close_jsb` 均已删除，三端宿主已全部切到 `JsbEngine`。

### 2.3 三端宿主对照

| 关注点 | Android（✅ 已迁移） | iOS（✅ 已迁移） | HarmonyOS（✅ 已迁移） |
| --- | --- | --- | --- |
| 路由 | `JsbPortBridge` → `NativeJsbEngine` | `WebViewContainer` → `NativeJsbEngine`（`onChannelOpen/Close`/`onControlFrame`/`onBinaryFrame`） | `MessagePortBridge` → `jsb_engine_*`（NAPI） |
| 系统原语 | `PlatformHostServices.kt` 实现 `HostServices` | `IosHostServices.swift` 实现 `HostServices`（14 原语） | `HarmonyHostServices.ets`（14 原语） |
| 二进制/Shell | 引擎 `(clientId, shellId)→channelId` 绑定 | 引擎 `engine.pushShellBinary` / `engine.onBinaryFrame` | 引擎 `jsbEnginePushShellBinary` / `jsbEngineBinaryFrame` |
| 事件 | `engine.emit` | `engine.emit` → `receive` 信封 | `jsbEngineEmit` |
| 传输 | WebMessagePort | WKScriptMessage（`JavaScriptBridge.swift` 注入适配器，二进制 Base64） | WebMessagePort（`MessagePortBridge.ets`） |

---

## 3. 统一与不统一的边界

### 3.1 统一（= jsb core 基础框架，全部收敛到 `JsbEngine`）

> ✅ 已落地（2026-09-02）：方法表内容（69 个业务方法名）已从 `jsb-core` 移到业务后端 `shell360-runtime`；`jsb-core` 只保留 `MethodSpec`/`MethodKind`/`HostPrimitive`/`ScopedFileKind`/`BinaryBindSpec` 泛型类型，表由构造注入（详见 `layering.md` §3.1）。

- 方法路由：`JsbEngine` 按注入的方法表决定 `Rust`/`Host` 归属、`binary` 标记、`events`、`error_domain`；方法表本身由业务层维护。
- invoke 校验：`type/id/method` 非空、`invoke.request` 类型、未注册方法（`JSB_UNSUPPORTED`）、重复 pending（`JSB_DUPLICATE_REQUEST`）。
- 帧上限：文本/二进制统一 1 MiB（`MAX_FRAME_SIZE`，`JSB_MESSAGE_TOO_LARGE`）。
- 通道与 client 生命周期：UUID 校验、首通道建 client、末通道 `release_client`、`channel.open.failed` 信封。
- 响应/错误信封：`reply_success`/`reply_error` 统一输出 `{type,id,data|error{code,message,details}}`；错误码由各平台漂移收敛为引擎规范码（见 `method-error-matrix.md`）。
- 事件路由：`emit` 只发控制通道；shell 二进制 `(clientId, shellId)→channelId` 绑定由引擎维护（`bind_shell`）。
- scoped SFTP 编排：`ssh.sftp.uploadFile/downloadFile` 由引擎围绕 `readScopedFile`/`writeScopedFile` 编排 + staging 生命周期。

### 3.2 不统一（= 平台适配层，刻意保留）

| 不统一项 | 归属 | 理由 |
| --- | --- | --- |
| `keygen.*`/`data.*`/`ssh.*` 业务方法 | Rust `RustMethodInvoker`（单实现） | 已是单一 Rust 实现，无需也不应在平台重复 |
| `HostServices` 系统原语实现 | 各平台各一份 | 剪贴板/文件选择/系统栏/生物识别等只能调平台 API；Rust 只负责参数校验、URL scheme 校验、路径 canonicalize、staging、错误模型（ADR-0002） |
| 传输适配器 | 各平台各一份 | 物理通道不同：Android/HarmonyOS = WebMessagePort，iOS = WKScriptMessage（Base64 仅 iOS 适配器内部） |
| 前端 `bridge/*` API | 不变 | ADR-0003：`jsb/` 只改协议内部 + 消费生成的 TS 方法名声明 |
| Tauri 桌面端 | 不动 | `bridge/src/tauri.ts` 与桌面选择结果不变 |

> 需要强调：`app.getVersion`、`machineUid.getMachineUid`、`fs.readTextFile/writeTextFile` 目前在 `methods.rs` 里是 **过渡性的 `Host` 原语**（P1 遗留），最终应由 Rust 接管（见 ADR-0002 / P3）。在此之前它们属于“迁移期例外”，不应固化。

---

## 4. 迁移现状与缺口

### 4.1 Android（已完成，作为参考实现）

`JsbPortBridge.kt` 已完整示范“宿主只做指令执行器”的目标形态：
- `openChannel/closeChannel` → `engine.onChannelOpen/Close`
- WebMessagePort `TYPE_STRING/TYPE_ARRAY_BUFFER` → `engine.onControlFrame/onBinaryFrame`
- `executeOutput` 消费 `ReplyText/PushBinary/OpenChannel/FailChannel/ClosePort`
- `PlatformHostServices` 只实现原语，`completion(callId, resultJson)` 回调 `engine.completeHostCall`

### 4.2 iOS（已迁移 ✅）

- UniFFI 已为 Swift 生成 `NativeJsbEngine`、`HostServices`、`NativeEngineOutput`（`scripts/ios/commands/build-native.ts` 用 `--language swift` 生成到 `ios/shell360/Generated`），**引擎侧无需改动**。
- 已改宿主侧：删除 `Jsb.swift`（旧 `NativeJsbRegistry/Connection` + `registerIosRoutes` 69 个 handler），改为 `WebViewContainer.swift` 驱动 `NativeJsbEngine` + `IosHostServices.swift` 实现 14 原语 + `RustBridge.swift` 生命周期持有者。
- **iOS 通道模型**：iOS 没有跨 WK 边界的 WebMessagePort，`JavaScriptBridge.swift` 注入的适配器在**页面内部**自建 `MessageChannel`，Swift 只经 `WKScriptMessage` 中转文本 / Base64 二进制。引擎的 `PushBinary`/`ClosePort` 输出映射为适配器的 `receive` 信封（`kind: "binary"` / `"close"`），`OpenChannel` 控制帧映射为适配器的 `channel.opened` + `port2` 转移。已新增 `channel.open`/`channel.close` 信封，通道模型已无损映射。
- 引擎接管后，`shellBindings`/`bindShellChannel`（Swift 与 JS 适配器）已删除，改用 `engine.pushShellBinary` / `engine.onBinaryFrame`。
- iOS 的 Base64 与 `version/kind` 信封是“适配器专用”，不属于公开 JSON invoke 协议（`current-protocol.md`），保留即可。

### 4.3 HarmonyOS（已迁移 ✅）

- OHRS 已暴露 `initialize_jsb_engine` / `attach_host_call_callback` / `jsb_engine_channel_open/close/open_failed/control_frame/binary_frame/complete_host_call/emit/push_shell_binary`，**NAPI 侧无需改动**。
- 已改 ArkTS 侧：`MessagePortBridge.ets` 改为调用引擎 NAPI；`HarmonyHostServices.ets` 从 `HarmonyNativeRuntime.ets` 内联原语抽出，实现 14 原语分发（对齐 Android 的 `PlatformHostServices`）。
- 已删除 `shellBindings`/`bindShellChannel`（引擎已接管）；已删除 `pendingEvents` 缓冲（引擎 `emit` 已负责路由到控制通道）。

### 4.4 迁移后清理（✅ 已完成）

三端宿主均已迁移到 `JsbEngine`，旧双轨导出已全部删除：

- `jsb-core`：已删除 `JsbRegistry`/`JsbConnection`。
- `shell360-ffi`：已删除 `NativeJsbRegistry`/`NativeJsbConnection`。
- `shell360_ohrs`：已删除 `register_jsb/connect_jsb/dispatch_jsb/resolve_jsb/reject_jsb/close_jsb`。

---

## 5. 建议（分阶段落地）

> ✅ 已完成：P1-jscore（`jsb-core` 纯化）、P2-runtime（拆 `shell360-runtime`、`shell360-ffi` 瘦身）、P2-iOS 与 P2-HarmonyOS（宿主迁移到引擎）、P2 收尾（删旧双轨导出）。P3 已完成 `app.getVersion` 与 `machineUid.getMachineUid` 回迁，`fs` 仍待拆分。以下为剩余待做项。

1. **P2 收尾** ✅ 已完成：`jsb-core`/`shell360-ffi`/`shell360_ohrs` 的旧 `Registry/Connection` 导出已删除。
2. **P3（部分完成）**：`app.getVersion`（`env!("CARGO_PKG_VERSION")`）与 `machineUid.getMachineUid`（`app_data_dir/machine_uid` 持久化 UUID v4）已回迁 Rust；app-local `fs` 因「app-local 路径 与 scoped URI（content://）读写共用 `fs.readTextFile/writeTextFile` 方法名」而暂缓——需先在业务层拆成 app-local（Rust）与 scoped（Host 原语）两条路径。`core.healthCheck` 与 JSON `ssh.shell.send` 的取舍仍待 iOS 二进制路径验证。
   - **已知占位（已接受，非阻塞）**：`app.getVersion` 目前返回 Rust crate 版本 `0.1.0` 而非真实 App 版本。App 版本本是平台 build 配置值，正确做法是把版本作为构造参数注入 `Shell360Runtime::new`（三端从各自 build config 传入）；此改动涉及 UniFFI/NAPI 构造签名变更与各平台重新生成绑定，已决定暂以 `CARGO_PKG_VERSION` 占位，后续再处理。
3. **P4**：把 `method_typescript()` 生成的 `JsbMethod` 声明接入 `jsb/`（决定是“构建期生成”还是“入库产物”），并评估是否只覆盖 native 能力路径而不动 Tauri 能力路径。
4. **验证策略**：以 `crates/jsb-core/tests/fixtures/current_protocol.json` 的 golden replay 保证引擎协议不变；补齐 P0 缺失的三端 device capture（`README.md` 已明确 gate）；每端迁移沿用 `p2-android.md` 的“结构扫描确认无旧 dispatcher/route/shell 绑定残留 + 编译通过 + 设备冒烟”清单。

---

## 6. 主要风险

- **iOS 通道模型映射**（4.2）已落地为“页面内 MessagePort + WKScriptMessage 中转”适配器，仍是最需要 device capture 验证的一环（WKScriptMessage 无跨边界 MessagePort，二进制走 Base64）。
- **`HostServices` 回调线程模型**：Android 用 `HandlerThread` + `webView.post`；iOS 的 `WKScriptMessage` 处理器与 Swift 并发、HarmonyOS 的 ETS 回调线程都需要独立纪律，避免跨线程访问引擎互斥锁与 UI。
- **`machineUid` 迁移期连续性**：Rust 已在 `app_data_dir/machine_uid` 持久化 UUID v4（P3），但旧值仍残留于各平台（Android SharedPreferences / iOS UserDefaults / HarmonyOS 文件），升级后 machineUid 会变化；需一次「各宿主读取旧值并迁移到 Rust 存储」的收尾（ADR-0002 允许各宿主读取旧值一次）。
- **`app.getVersion` 版本占位**：当前返回 Rust crate 版本 `0.1.0`，非真实 App 版本（已接受为占位，后续改为构造参数注入真实版本，见 §5.2）。
- **`fs` 尚未回迁**：`fs.readTextFile/writeTextFile` 同时承载 app-local（known_hosts）与 scoped URI（导入/导出/加密钥）两种语义，回迁 Rust 前须先拆分；迁移期不得新增平台分支。
- **P0 device capture 缺失**：Rust golden replay 与编译通过不构成端到端证据（`README.md` 环境探针记录），发布前需补齐。
