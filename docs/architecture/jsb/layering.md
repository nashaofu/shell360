# 移动端 JSB 目标分层（bridge / jsb / jsb-core）

> 本文定义移动端 JSB 的**目标分层**，是对 `unification-analysis.md`（现状核对）与 ADR-0001~0003 的补充。
>
> 核心约束：**`jsb`（TS）与 `jsb-core`（Rust）都必须是纯框架，不含任何业务逻辑**；
> 业务调用收敛到 `bridge`（TS）与业务后端（Rust）；各端 JSB 对接层统一基于 `jsb-core` 封装，不再各自写代码。
>
> **落地状态（2026-09-02）**：Rust 侧分层与三端宿主迁移均已落地 —— `jsb-core` 纯化（P1-jscore）、`shell360-runtime` 拆分与 `shell360-ffi` 瘦身（P2-runtime）、Android/iOS/HarmonyOS 三端宿主迁移到 `JsbEngine`（P2-android / P2-iOS / P2-HarmonyOS）已完成；旧双轨清理（P2 收尾）已完成；P3 中 `app.getVersion` 与 `machineUid.getMachineUid` 已回迁 Rust，app-local `fs` 仍待拆分后回迁。

---

## 1. 目标分层

```
┌────────────────────────────────────────────────────────────────┐
│ bridge (TS)          业务调用层：基于 jsb 封装                     │
│   ssh.ts / data.ts / fs.ts / dialog.ts / clipboard-manager.ts … │
│   → jsb.invoke("ssh.session.connect", params)                    │
└──────────────────────────────┬─────────────────────────────────┘
                               │ 泛型 invoke(method, data) 调用
┌──────────────────────────────▼─────────────────────────────────┐
│ jsb (TS)              JSB 核心（纯框架，零业务）                    │
│   JSB.invoke/on/once/off · JSBChannel · protocol · error        │
│   channel_registry · types —— 不含任何方法名 / 业务类型             │
└──────────────────────────────┬─────────────────────────────────┘
                               │ 传输适配（MessagePort / WKScriptMessage）
┌──────────────────────────────▼─────────────────────────────────┐
│ 各端对接层（薄适配，全部基于 jsb-core 封装，无逐方法 handler）        │
│   Android: JsbPortBridge + PlatformHostServices (Kotlin) ✅      │
│   iOS:     WebViewContainer + IosHostServices (Swift) ✅          │
│   Harmony: MessagePortBridge + HarmonyHostServices (ArkTS) ✅     │
└──────────────────────────────┬─────────────────────────────────┘
                               │ FFI（UniFFI / NAPI）
┌──────────────────────────────▼─────────────────────────────────┐
│ shell360-ffi / shell360_ohrs   FFI 边界（仅绑定，无业务）          │
│   NativeJsbEngine 包装 jsb-core · HostServices trait · 事件 sink │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│ jsb-core (Rust)       JSB Rust 核心（纯引擎，零业务）              │
│   JsbEngine：路由/校验/信封/通道/事件/生命周期/帧上限/UUID          │
│   RustMethodInvoker trait · HostPrimitive · MethodSpec（类型）    │
│   不含任何方法名 / 业务编排                                        │
└──────────────────────────────┬─────────────────────────────────┘
                               │ trait RustMethodInvoker（构造时注入）
┌──────────────────────────────▼─────────────────────────────────┐
│ shell360-runtime (Rust)   业务后端（唯一业务实现）                  │
│   Shell360Runtime：keygen / data / ssh 调度                      │
│   方法表（69 个 MethodSpec）· 业务特例策略 · impl RustMethodInvoker│
│   依赖 shell360-store / shell360-ssh / shell360-keygen           │
└────────────────────────────────────────────────────────────────┘
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
- **业务调度未在平台重复**：`shell360_ohrs` 直接 `use shell360_ffi::{Shell360Runtime, NativeJsbEngine, ...}`，没有为 HarmonyOS 单独重写 69 个方法的分发。✅（方向正确，但 `Shell360Runtime` 还混在 `shell360-ffi` 里，见 §3.2）

### 2.2 已修复（本次落地）：`jsb-core` 已纯化 ✅

`jsb-core` 是 `crates/jsb-core`，依赖只有 `serde/serde_json/thiserror/uuid`（无业务 crate 依赖）。此前业务知识以**硬编码字符串**渗入，现已全部外移到业务后端 `shell360-runtime`：

1. **方法表外移**：`jsb-core::methods.rs` 里的 `METHOD_SPECS`（69 个业务方法名）、`method_events()`（`data.authedChange`、`ssh.session.disconnect`、`ssh.shell.eof/close`、`ssh.sftp.eof/close`）、`method_specs()`、`method_typescript()` 已整体迁到 `shell360-runtime::methods`。`jsb-core::methods.rs` 现在**只保留框架类型**：`MethodSpec`、`MethodKind`、`HostPrimitive`、`ScopedFileKind`、`BinaryBindSpec` —— 它们描述“某方法是 Rust 还是 Host、是否二进制、scoped 方向、二进制绑定字段”等**泛型契约**，不含任何具体方法名。
2. **5 处业务特例通用化**（`jsb-core::engine.rs` 不再按方法名写死）：
   - `core.openUrl` scheme 校验 → 引擎按 `HostPrimitive::OpenExternal` **原语**做通用 scheme 白名单校验。
   - `ssh.sftp.uploadFile/downloadFile` → `MethodSpec.scoped_file: Option<ScopedFileKind>`（`Upload`/`Download`）声明式编排 staging + `ReadScopedFile`/`WriteScopedFile`。
   - `ssh.shell.open` → `MethodSpec.binary_bind: Option<BinaryBindSpec>`（`channel_field`/`shell_field`）通用绑定二进制通道。
   - `data.resetCrypto` 重启 → `RustMethodInvoker::invoke` 返回 `InvokeOutcome { result_json, host_actions: Vec<HostPrimitive> }`，业务层声明 `ResetApplication` 后置动作；引擎不再识别 `data.resetCrypto`。
3. **`JsbEngine::new(invoker, specs)`**：方法表改为构造时注入，`jsb-core` 内部不再调用 `method_specs()`；`JsbEngine` 持有 `HashMap<String, MethodSpec>`。

### 2.3 各端对接现状

- `shell360-ffi`：已瘦身为**仅绑定层** ✅ —— `NativeJsbEngine` 包装 `jsb-core`（构造注入 `RuntimeInvoker` + `shell360_runtime::method_specs()`），另含 `FfiError`/`FfiEventSink`/`HostServices`/输出类型转换；业务运行时 `Shell360Runtime` 已抽出到 `shell360-runtime`，此处只保留 `#[uniffi::Object]` 薄包装转发到 `InnerRuntime`。旧 `NativeJsbRegistry`/`NativeJsbConnection` 双轨已删除。
- `shell360_ohrs`：`jsb_engine_*` 已包装 `jsb-core` ✅；旧的 `register_jsb/connect_jsb/dispatch_jsb/resolve_jsb/reject_jsb/close_jsb` 双轨已删除。
- iOS（Swift）与 HarmonyOS（ArkTS）：**已迁移完成** ✅ —— iOS 的 `WebViewContainer.swift` + `IosHostServices.swift`、HarmonyOS 的 `MessagePortBridge.ets` + `HarmonyHostServices.ets` 均驱动 `NativeJsbEngine` / `jsb_engine_*`，不再手写 69 个 handler。

---

## 3. 改造落地记录（本次已完成 P1-jscore 与 P2-runtime）

### 3.1 让 `jsb-core` 纯化（本次核心）✅ 已落地

**方法表外移**：把 `METHOD_SPECS`（69 个名字）从 `jsb-core::methods.rs` 移到业务后端 `shell360-runtime`。`JsbEngine::new` 改为接收方法表：

```rust
impl<I: RustMethodInvoker> JsbEngine<I> {
  pub fn new(invoker: I, specs: &'static [MethodSpec]) -> Self { ... }
}
```

`MethodSpec` / `MethodKind` / `HostPrimitive` 作为**泛型能力描述类型**保留在 `jsb-core`（它们描述“某方法是 Rust 还是 Host、是否二进制、走哪个原语”，是框架契约，不含具体业务），但**表的内容（具体方法名）由业务层注入**。

**5 处特例去业务化（通用化）**：

| 现状（硬编码方法名） | 目标（通用机制） |
| --- | --- |
| `core.openUrl` scheme 校验 | 引擎对 `HostPrimitive::OpenExternal` 原语做通用 scheme 白名单校验（按原语而非方法名） |
| `ssh.sftp.uploadFile/downloadFile` 特判 | `MethodSpec` 增加声明式 `scoped_file` 字段（`param` + `direction`），引擎通用编排 staging + `ReadScopedFile`/`WriteScopedFile` |
| `ssh.shell.open` 绑定 | `MethodSpec` 增加声明式 `binary_bind` 字段（`channel_param`/`target_param`），引擎通用绑定二进制通道 |
| `data.resetCrypto` 重启 | `RustMethodInvoker::invoke` 返回 `InvokeOutcome { result_json, host_action: Option<HostPrimitive> }`，业务层声明后置动作 |

**删旧双轨**：`JsbRegistry`/`JsbConnection` 及 FFI 边界上的旧导出已在三端宿主全部迁移到 `JsbEngine` 后删除（✅ P2 收尾，ADR-0001 收尾条件满足）。

### 3.2 crate 拆分（业务与 FFI 分离）✅ 已落地

- 新增 **`shell360-runtime`**：从 `shell360-ffi` 抽出 `Shell360Runtime`（`DataService`/`SshService`/`keygen` 调度）+ 方法表 + `impl RustMethodInvoker`。这是唯一的业务实现。
- **`shell360-ffi`** 只保留 UniFFI 绑定：`NativeJsbEngine`（包装 `jsb-core`）+ `HostServices` trait + 事件 sink + 类型转换。无业务分发。
- **`shell360_ohrs`** 只保留 NAPI 绑定：`jsb_engine_*`（包装 `jsb-core`）+ HostServices 回调 + 事件 sink，依赖 `jsb-core` + `shell360-runtime`。

依赖方向变为单向：`shell360-runtime → {jsb-core, shell360-store, shell360-ssh, shell360-keygen}`；`shell360-ffi / shell360_ohrs → {jsb-core, shell360-runtime}`。

### 3.3 宿主迁移（消除“各端单独写代码”）✅ 已落地

- **iOS** ✅：`Jsb.swift` 已删除；`WebViewContainer.swift` 改走 `NativeJsbEngine`（`onChannelOpen/Close`/`onControlFrame`/`onBinaryFrame`/`completeHostCall`/`emit`/`pushShellBinary`），新增 `IosHostServices`（Swift）实现 14 个原语；`RustBridge.swift` 精简为生命周期持有者（`createJsbEngine` + owner 事件监听）；`JavaScriptBridge.swift` 作为“页面内 MessagePort + WKScriptMessage 中转”的传输适配器保留，新增 `channel.open`/`close` 信封。删除了 `registerIosRoutes` 的 69 个 handler 与自维护 `shellBindings`。
- **HarmonyOS** ✅：`MessagePortBridge.ets` 改走 `jsb_engine_*`（NAPI）+ 新增 `HarmonyHostServices`（ArkTS）实现 14 个原语；删除了 69 个 handler、`shellBindings`、`pendingEvents` 缓冲。

两端只做两件事：**传输适配** + **`HostServices` 系统原语实现**，编排/校验/错误模型全部由 `jsb-core` 引擎承担。

---

## 4. 统一与不统一的边界（修正版）

**统一（收敛到 `jsb-core` 纯引擎，注入式）**：
- 方法路由与校验、pending 请求、响应/错误信封、事件路由、通道/生命周期、帧上限、UUID 校验。
- 原语编排（scoped 文件、二进制通道绑定）——以**声明式 `MethodSpec` 字段**表达，引擎通用执行。

**不统一（刻意保留，且不再放进 `jsb-core`）**：
- **业务方法名 + 业务调度**：归 `shell360-runtime`（单一 Rust 实现）。`method_typescript()` 随之从 `jsb-core` 移到 `shell360-runtime`，生成的 `JsbMethod` 声明由 `bridge` 消费（不是 `jsb`）。
- **`HostServices` 系统原语实现**：各平台各一份（剪贴板/文件选择/打开 URL/系统栏/关窗/scoped 文件/生物识别），但参数校验、URL scheme、路径 canonicalize、staging、错误模型归 Rust。
- **传输适配器**：Android/HarmonyOS 用 WebMessagePort；iOS 用 WKScriptMessage（Base64 仅 iOS 适配器内部）。
- **前端 `bridge/*` API 与 Tauri 桌面端**：不变。

---

## 5. 落地顺序建议

1. **P1-jscore** ✅ 已落地：方法表外移 + 5 处特例通用化（`JsbEngine::new(invoker, specs)`）。`jsb-core` 已满足“零业务”。
2. **P2-runtime** ✅ 已落地：拆出 `shell360-runtime`，`shell360-ffi` 减到只做绑定（`shell360_ohrs` 已 `use shell360_ffi`，随之一同收益）。
3. **P2-iOS / P2-HarmonyOS** ✅ 已落地：iOS（`WebViewContainer` + `IosHostServices`）与 HarmonyOS（`MessagePortBridge` + `HarmonyHostServices`）均已迁移到引擎，与 Android 对齐。
4. **P2 收尾** ✅ 已落地：删 `jsb-core`/`shell360-ffi`/`shell360_ohrs` 的旧 `Registry/Connection` 导出。
5. **P3** 🟡 部分落地：`app.getVersion` 与 `machineUid.getMachineUid` 已从过渡 `Host` 原语移回 Rust；app-local `fs` 仍待「app-local 与 scoped URI 拆路径」后回迁；`method_typescript()` 产物接入 `bridge` 属 P4。
