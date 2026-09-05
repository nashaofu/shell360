# 移动端 JSB 分层（bridge / jsb / jsb-core）

> 本文定义移动端 JSB 的**当前分层**与统一/不统一的边界。核心约束：**`jsb`（TS）与
> `jsb-core`（Rust）都必须是纯框架，不含任何业务逻辑**；业务调用收敛到 `bridge`（TS）与
> 业务后端（Rust）；各端 JSB 对接层统一基于 `jsb-core` 封装，不再各自写代码。
>
> 详细设计与迁移方案见 `rust-owned-webview-transport.md`；历史设计 / 落地过程见 `history.md`。
>
> **当前落地状态**：Rust 侧分层与三端宿主迁移均已落地。`jsb-core` 现为纯 JSB 框架：`Jsb`
> 通过注入的 `JsbTransport` 直接向 WebView Channel 发送响应/事件/二进制，通过 `JsbHandler`
> 把具体方法委托给 `shell360-runtime`；平台不再解释 Rust 输出列表。

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

- **`jsb`（TS）完全通用**：`jsb.ts` 的 `invoke<TRequest, TResponse>(method: string, data?)`
  只做序列化/路由/事件，`types.ts`/`protocol.ts`/`jsb_channel.ts`/`channel_registry.ts`/
  `error.ts` 无任何业务方法名或业务类型。✅
- **`bridge`（TS）已是业务封装**：`bridge/src/native.ts` 导入 `jsb`，各能力子包
  （`data/ssh/fs/dialog/...`）基于 jsb 封装。✅
- **业务调度未在平台重复**：`shell360_ohrs` 直接复用 `shell360-ffi` 的 `Shell360Runtime`
  与 `NativeJsb`，没有为 HarmonyOS 单独重写方法分发。✅

### 2.2 各端对接现状

- `shell360-ffi`：**仅绑定层** ✅ —— `NativeJsb` 包装 `jsb-core::Jsb`（构造时注入
  `FfiJsbTransport` 适配器 + `RuntimeInvoker` + `shell360_runtime::method_specs()` 方法名）；
  UniFFI 暴露 `JsbTransport`/`HostServices` callback interface；所有入口返回
  `Result<(), FfiError>`，不再有输出类型转换。业务运行时 `Shell360Runtime` 在
  `shell360-runtime`，此处只保留 `#[uniffi::Object]` 薄包装（构造 + `shutdown()`）。
- `shell360_ohrs`：`jsb_*` NAPI 入口（`jsbOpenChannel`/`jsbReceiveText`/…）全部返回
  `Result<()>`；Rust 端 `OhrsJsbTransport` 实现 `shell360_ffi::JsbTransport`，经
  `JsbTransportEvent` ThreadsafeFunction 驱动 ArkTS；旧的 `jsb_engine_*`、输出 JSON 数组和
  直连 `invoke`/`release_client`/`send_ssh_shell_data` 导出均已删除。
- Android（Kotlin）、iOS（Swift）与 HarmonyOS（ArkTS）：**迁移完成** ✅ —— 三端只做两件事：
  实现 `JsbTransport`（WebView 端口操作，UI 线程）与 `HostServices`（系统原语）；不再解释任何
  Rust 输出列表，不再手写逐方法 handler。

---

## 3. 统一与不统一的边界

**统一（收敛到 `jsb-core` 纯框架，注入式）**：
- 方法路由与校验、pending 请求、响应/错误信封、事件路由、通道/生命周期、帧上限、UUID 校验。
- 异步方法的**通用机制**：`JsbHandler::invoke` 拿到 `Arc<dyn JsbInvokeCompletion>`，
  `resolve`/`reject` 经 `AtomicBool` 保证一次性；close/release/shutdown 时核心取消 pending 并
  通知 handler。具体 HostCall、scoped 文件和二进制绑定策略不进入核心。
- 通道收发的**唯一出口** `JsbTransport`（open/fail/send_text/send_binary/close），核心不调用
  任何平台 SDK，也不返回供平台解释的输出列表。

**不统一（刻意保留，且不再放进 `jsb-core`）**：
- **业务方法名 + 业务调度 + 宿主路由表**：归 `shell360-runtime`（单一 Rust 实现）。
  `method_typescript()` 随之从 `jsb-core` 移到 `shell360-runtime`，生成的 `JsbMethod` 声明由
  `bridge` 消费（不是 `jsb`）；“哪个方法交给哪个宿主原语”由
  `shell360-runtime::methods::host_primitive()` 决定。
- **`HostServices` 系统原语实现**：各平台各一份（剪贴板/文件选择/打开 URL/系统栏/关窗/scoped
  文件/生物识别），但参数校验、URL scheme、路径 canonicalize、staging、错误模型归 Rust。
- **传输适配器**：Android/HarmonyOS 用 WebMessagePort；iOS 用 WKScriptMessage（Base64 仅 iOS
  适配器内部）。
- **前端 `bridge/*` API 与 Tauri 桌面端**：不变。
