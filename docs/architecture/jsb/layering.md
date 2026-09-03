# 移动端 JSB 目标分层（bridge / jsb / jsb-core）

> 本文定义移动端 JSB 的**目标分层**，是对 `unification-analysis.md`（现状核对）与 ADR-0001~0003 的补充。
>
> 核心约束：**`jsb`（TS）与 `jsb-core`（Rust）都必须是纯框架，不含任何业务逻辑**；
> 业务调用收敛到 `bridge`（TS）与业务后端（Rust）；各端 JSB 对接层统一基于 `jsb-core` 封装，不再各自写代码。
>
> **落地状态（2026-09-02）**：Rust 侧分层与三端宿主迁移均已落地 —— `jsb-core` 纯化（P1-jscore）、`shell360-runtime` 拆分与 `shell360-ffi` 瘦身（P2-runtime）、Android/iOS/HarmonyOS 三端宿主迁移到 `JsbEngine`（P2-android / P2-iOS / P2-HarmonyOS）已完成；旧双轨清理（P2 收尾）已完成；P3 中 `app.getVersion` 与 `machineUid.getMachineUid` 已回迁 Rust，app-local `fs` 仍待拆分后回迁；**P4-jscore 已完成**：`jsb-core` 删除 `HostPrimitive` / `MethodKind`，宿主路由改为 `MethodInvoker` 委托，`jsb-core` 已不含任何宿主原语词汇。

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
│  各端对接层（薄适配，全部基于 jsb-core 封装，无逐方法 handler）│
│  Android: JsbPortBridge + PlatformHostServices (Kotlin) ✅     │
│  iOS:     WebViewContainer + IosHostServices (Swift) ✅        │
│  Harmony: MessagePortBridge + HarmonyHostServices (ArkTS) ✅   │
└──────────────────────────────┬─────────────────────────────────┘
                               │ FFI（UniFFI / NAPI）
┌──────────────────────────────▼─────────────────────────────────┐
│  shell360-ffi / shell360_ohrs   FFI 边界（仅绑定，无业务）     │
│  NativeJsbEngine 包装 jsb-core · HostServices trait · 事件 sink│
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│  jsb-core (Rust)       JSB Rust 核心（纯引擎，零业务）         │
│  JsbEngine：路由/校验/信封/通道/事件/生命周期/帧上限/UUID      │
│  MethodInvoker trait · InvokeFlow · MethodSpec（声明式策略）   │
│  不含任何方法名 / 宿主原语名 / 业务编排                        │
└──────────────────────────────┬─────────────────────────────────┘
                               │ trait MethodInvoker（构造时注入；返回 Complete / Delegate）
┌──────────────────────────────▼─────────────────────────────────┐
│  shell360-runtime (Rust)   业务后端（唯一业务实现）            │
│  Shell360Runtime：keygen / data / ssh 调度 · openUrl 校验      │
│  方法表（69 个 MethodSpec）· 宿主路由表 · impl MethodInvoker   │
│  依赖 shell360-store / shell360-ssh / shell360-keygen          │
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

1. **方法表外移**：`jsb-core::methods.rs` 里的 `METHOD_SPECS`（69 个业务方法名）、`method_events()`（`data.authedChange`、`ssh.session.disconnect`、`ssh.shell.eof/close`、`ssh.sftp.eof/close`）、`method_specs()`、`method_typescript()` 已整体迁到 `shell360-runtime::methods`。
2. **宿主原语词汇外移（本次）**：`HostPrimitive` 枚举与 `MethodKind`（`Rust` / `Host(primitive)` 分类）已从 `jsb-core` 删除。`jsb-core::methods.rs` 现在**只保留框架类型**：`MethodSpec`（声明式策略：`scoped_file` / `binary_bind` / 元数据）、`ScopedFileKind`、`BinaryBindSpec`，以及引擎自产的 staging 协议常量 `READ_SCOPED_FILE` / `WRITE_SCOPED_FILE`（与 `channel.opened` 控制帧同级的框架协议，不是业务词汇）。
3. **路由改为 invoker 委托（本次）**：引擎不再认识“某方法属于 Rust 还是宿主”。`MethodInvoker::invoke` 返回 `InvokeFlow::Complete(outcome)`（Rust 内完成）或 `InvokeFlow::Delegate { primitive, params_json }`（挂起，交由宿主执行，`primitive` 对引擎不透明）。宿主路由表 `host_primitive(method)` 与 `core.openUrl` 的 scheme 白名单校验一并落到 `shell360-runtime`，错误信封（`BRIDGE_INVALID_REQUEST`）与线协议字节不变。
4. **业务特例通用化**（`jsb-core::engine.rs` 不再按方法名写死）：
   - `ssh.sftp.uploadFile/downloadFile` → `MethodSpec.scoped_file: Option<ScopedFileKind>`（`Upload`/`Download`）声明式编排 staging + `READ_SCOPED_FILE`/`WRITE_SCOPED_FILE`。
   - `ssh.shell.open` → `MethodSpec.binary_bind: Option<BinaryBindSpec>`（`channel_field`/`shell_field`）通用绑定二进制通道。
   - `data.resetCrypto` 重启 → `InvokeOutcome { result_json, host_actions: Vec<HostAction> }`；`HostAction { primitive, params_json }` 同样是业务层声明的不透明后置动作，引擎原样转发（fire-and-forget）。
5. **`JsbEngine::new(invoker, specs)`**：方法表改为构造时注入，`jsb-core` 内部不再调用 `method_specs()`；`JsbEngine` 持有 `HashMap<String, MethodSpec>`。

### 2.3 各端对接现状

- `shell360-ffi`：已瘦身为**仅绑定层** ✅ —— `NativeJsbEngine` 包装 `jsb-core`（构造注入 `RuntimeInvoker` + `shell360_runtime::method_specs()`），另含 `FfiError`/`FfiEventSink`/`HostServices`/输出类型转换；业务运行时 `Shell360Runtime` 已抽出到 `shell360-runtime`，此处只保留 `#[uniffi::Object]` 薄包装转发到 `InnerRuntime`。旧 `NativeJsbRegistry`/`NativeJsbConnection` 双轨已删除。
- `shell360_ohrs`：`jsb_engine_*` 已包装 `jsb-core` ✅；旧的 `register_jsb/connect_jsb/dispatch_jsb/resolve_jsb/reject_jsb/close_jsb` 双轨已删除。
- iOS（Swift）与 HarmonyOS（ArkTS）：**已迁移完成** ✅ —— iOS 的 `WebViewContainer.swift` + `IosHostServices.swift`、HarmonyOS 的 `MessagePortBridge.ets` + `HarmonyHostServices.ets` 均驱动 `NativeJsbEngine` / `jsb_engine_*`，不再手写 69 个 handler。

---

## 3. 改造落地记录（本次已完成 P1-jscore 与 P2-runtime）

### 3.1 让 `jsb-core` 纯化（本次核心）✅ 已落地

**方法表外移**：把 `METHOD_SPECS`（69 个名字）从 `jsb-core::methods.rs` 移到业务后端 `shell360-runtime`。`JsbEngine::new` 改为接收方法表：

```rust
impl<I: MethodInvoker> JsbEngine<I> {
  pub fn new(invoker: I, specs: Vec<MethodSpec>) -> Self { ... }
}
```

`MethodSpec`（`scoped_file` / `binary_bind` / 元数据字段）作为**声明式策略类型**保留在 `jsb-core`，但**表的内容（具体方法名）由业务层注入**。

**宿主路由去业务化（本次）**：

```rust
// jsb-core：引擎只认识“完成”或“委托给宿主”，primitive 对它不透明
pub enum InvokeFlow {
  Complete(InvokeOutcome),
  Delegate { primitive: String, params_json: String },
}
```

| 改造前 | 改造后 |
| --- | --- |
| `MethodKind::Host(HostPrimitive::ReadClipboard)` 静态方法分类 | `MethodSpec` 无 `kind` 字段；`shell360-runtime::methods::host_primitive(method)` 路由表由 `RuntimeInvoker` 查询，返回 `InvokeFlow::Delegate { primitive: "readClipboard", .. }` |
| 引擎按 `HostPrimitive::OpenExternal` 特判做 URL scheme 校验 | `shell360-runtime` 在返回 `Delegate` 前校验（`BRIDGE_INVALID_REQUEST` 信封不变） |
| `host_actions: Vec<HostPrimitive>`（只能发无参原语） | `Vec<HostAction { primitive, params_json }>`（可带参，为后续 `fs` 回迁留出空间） |

**其余特例去业务化（通用化）**：

| 现状（硬编码方法名） | 目标（通用机制） |
| --- | --- |
| `ssh.sftp.uploadFile/downloadFile` 特判 | `MethodSpec` 增加声明式 `scoped_file` 字段（`param` + `direction`），引擎通用编排 staging + `READ_SCOPED_FILE`/`WRITE_SCOPED_FILE` 协议常量 |
| `ssh.shell.open` 绑定 | `MethodSpec` 增加声明式 `binary_bind` 字段（`channel_param`/`target_param`），引擎通用绑定二进制通道 |
| `data.resetCrypto` 重启 | `InvokeOutcome { result_json, host_actions: Vec<HostAction> }`，业务层声明后置动作 |

**删旧双轨**：`JsbRegistry`/`JsbConnection` 及 FFI 边界上的旧导出已在三端宿主全部迁移到 `JsbEngine` 后删除（✅ P2 收尾，ADR-0001 收尾条件满足）。

### 3.2 crate 拆分（业务与 FFI 分离）✅ 已落地

- 新增 **`shell360-runtime`**：从 `shell360-ffi` 抽出 `Shell360Runtime`（`DataService`/`SshService`/`keygen` 调度）+ 方法表 + 宿主路由表 + `impl MethodInvoker`。这是唯一的业务实现。
- **`shell360-ffi`** 只保留 UniFFI 绑定：`NativeJsbEngine`（包装 `jsb-core`）+ `HostServices` trait + 事件 sink + 类型转换。无业务分发。
- **`shell360_ohrs`** 只保留 NAPI 绑定：`jsb_engine_*`（包装 `jsb-core`）+ HostServices 回调 + 事件 sink，依赖 `jsb-core` + `shell360-runtime`。

依赖方向变为单向：`shell360-runtime → {jsb-core, shell360-store, shell360-ssh, shell360-keygen}`；`shell360-ffi / shell360_ohrs → {jsb-core, shell360-runtime}`。

### 3.3 宿主迁移（消除“各端单独写代码”）✅ 已落地

- **iOS** ✅：`Jsb.swift` 已删除；`WebViewContainer.swift` 改走 `NativeJsbEngine`（`onChannelOpen/Close`/`onControlFrame`/`onBinaryFrame`/`completeHostCall`/`emit`/`pushShellBinary`），新增 `IosHostServices`（Swift）实现 14 个原语；`RustBridge.swift` 精简为生命周期持有者（`createJsbEngine` + owner 事件监听）；`JavaScriptBridge.swift` 作为“页面内 MessagePort + WKScriptMessage 中转”的传输适配器保留，新增 `channel.open`/`close` 信封。删除了 `registerIosRoutes` 的 69 个 handler 与自维护 `shellBindings`。
- **HarmonyOS** ✅：`MessagePortBridge.ets` 改走 `jsb_engine_*`（NAPI）+ 新增 `HarmonyHostServices`（ArkTS）实现 14 个原语；删除了 69 个 handler、`shellBindings`、`pendingEvents` 缓冲。

两端只做两件事：**传输适配** + **`HostServices` 系统原语实现**，编排/错误模型由 `jsb-core` 引擎承担；原语参数校验与业务策略（URL scheme 等）由 `shell360-runtime` 承担。

---

## 4. 统一与不统一的边界（修正版）

**统一（收敛到 `jsb-core` 纯引擎，注入式）**：
- 方法路由与校验、pending 请求、响应/错误信封、事件路由、通道/生命周期、帧上限、UUID 校验。
- 原语编排（scoped 文件、二进制通道绑定）——以**声明式 `MethodSpec` 字段**表达，引擎通用执行。
- 宿主调用的**机制**（异步挂起、`complete_host_call` 关联、通道关闭清理、fire-and-forget 后置动作），但**不涉及任何具体原语名**。

**不统一（刻意保留，且不再放进 `jsb-core`）**：
- **业务方法名 + 业务调度 + 宿主路由表**：归 `shell360-runtime`（单一 Rust 实现）。`method_typescript()` 随之从 `jsb-core` 移到 `shell360-runtime`，生成的 `JsbMethod` 声明由 `bridge` 消费（不是 `jsb`）；“哪个方法交给哪个宿主原语”同样由 `shell360-runtime::methods::host_primitive()` 决定。
- **`HostServices` 系统原语实现**：各平台各一份（剪贴板/文件选择/打开 URL/系统栏/关窗/scoped 文件/生物识别），但参数校验、URL scheme、路径 canonicalize、staging、错误模型归 Rust（`jsb-core` 管机制，`shell360-runtime` 管业务策略）。
- **传输适配器**：Android/HarmonyOS 用 WebMessagePort；iOS 用 WKScriptMessage（Base64 仅 iOS 适配器内部）。
- **前端 `bridge/*` API 与 Tauri 桌面端**：不变。

---

## 5. 落地顺序建议

1. **P1-jscore** ✅ 已落地：方法表外移 + 特例通用化（`JsbEngine::new(invoker, specs)`）。`jsb-core` 已满足“零业务”。
2. **P2-runtime** ✅ 已落地：拆出 `shell360-runtime`，`shell360-ffi` 减到只做绑定（`shell360_ohrs` 已 `use shell360_ffi`，随之一同收益）。
3. **P2-iOS / P2-HarmonyOS** ✅ 已落地：iOS（`WebViewContainer` + `IosHostServices`）与 HarmonyOS（`MessagePortBridge` + `HarmonyHostServices`）均已迁移到引擎，与 Android 对齐。
4. **P2 收尾** ✅ 已落地：删 `jsb-core`/`shell360-ffi`/`shell360_ohrs` 的旧 `Registry/Connection` 导出。
5. **P3** 🟡 部分落地：`app.getVersion` 与 `machineUid.getMachineUid` 已从过渡 `Host` 原语移回 Rust；app-local `fs` 仍待「app-local 与 scoped URI 拆路径」后回迁；`method_typescript()` 产物接入 `bridge` 属 P4。
6. **P4-jscore** ✅ 已落地：`jsb-core` 删除 `HostPrimitive` 枚举与 `MethodKind` 分类，宿主路由改为 `MethodInvoker` 委托（`InvokeFlow::Complete` / `InvokeFlow::Delegate`）；宿主路由表与 `core.openUrl` scheme 校验迁到 `shell360-runtime`。`jsb-core` 现可作为通用 JSB 框架复用。
7. **后续可选（未做）**：若希望 `jsb-core` 连 `READ_SCOPED_FILE`/`WRITE_SCOPED_FILE` staging 协议都不持有，可进一步把 scoped 传输编排下沉到 `shell360-runtime`——需要引擎引入 `HostContinuation`（宿主完成后回调业务层续跑）契约，并把 staging 清理改为续跑体的 `abort()`。这同时能解除「`host_actions` 无法带参等待结果」对 `fs` 回迁的阻塞。
