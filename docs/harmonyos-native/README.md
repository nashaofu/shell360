# HarmonyOS 原生 WebView 与 Rust FFI 实施方案

## 文档目的

本文是顶层 `harmonyos/` 工程的分阶段实施基线。目标是将当前 ArkUI 示例应用改造为
Shell360 的独立 HarmonyOS WebView 宿主，通过与 Android、iOS 共用的 `bridge/native`
协议调用 HarmonyOS 平台能力和现有 Rust Core。

本文只定义已确认的现状、目标边界、技术决策、实施顺序和验收标准，不代表对应能力已经
完成。每个阶段只有在完成标准全部满足后才能更新为“已完成”。

调研基线日期为 2026-08-09。当前工程使用 HarmonyOS API 26.0.0；本机 DevEco Studio
随附的 SDK 是 26.0.0.23 Beta1。Beta SDK 接口、Hvigor DSL 和设备行为在正式实施时必须
重新核对，本文不会把未经编译或真机验证的能力当作既定事实。

## 实施状态

| 阶段 | 优先级 | 状态   | 目标                                       |
| ---- | ------ | ------ | ------------------------------------------ |
| 0    | P0     | 进行中 | 验证 Rust、N-API、ABI 和跨线程回调         |
| 1    | P0     | 进行中 | 建立 WebView 宿主及 Debug/Release 页面加载 |
| 2    | P0     | 进行中 | 建立 Web 与 ArkTS 的 Bridge v1 通道        |
| 3    | P0     | 进行中 | 打通 Web → ArkTS → Rust 最小垂直链路       |
| 4    | P1     | 进行中 | 接入 Keygen、Data、持久化和错误模型        |
| 5    | P1     | 进行中 | 接入 SSH Terminal 与事件通道               |
| 6    | P1     | 进行中 | 接入 SFTP 和 HarmonyOS 平台能力            |
| 7    | P1     | 进行中 | 建立构建、增量开发、CI 和发布流程          |
| 8    | P2     | 进行中 | 安全加固、稳定性验证和性能优化             |

状态只使用：`未开始`、`进行中`、`已完成`、`阻塞`。

## 当前项目基线

### HarmonyOS

- 顶层 `harmonyos/` 是 Stage 模型工程，只有一个 `entry` 类型 HAP。
- `targetSdkVersion`、`compatibleSdkVersion` 和 `modelVersion` 均为 `26.0.0`，设备类型
  仅为 `phone`。
- `EntryAbility` 在 `onWindowStageCreate` 中加载 `pages/Index`，并实现 `onCreate`、
  `onForeground`、`onBackground`、`onDestroy` 等标准 Ability 生命周期。
- `Index.ets` 仍是 `Hello World` 示例页面，没有 Web 组件、Bridge、native module 或业务 UI。
- `entry/src/main/resources/rawfile/` 已存在但为空。
- `entry/build-profile.json5` 尚未声明 CMake、native library、ABI 或 Web 资源同步任务。
- 根 `package.json` 尚无 `harmonyos:dev`、`harmonyos:build` 等命令。

### Web 与 Bridge

- `mobile` 是现有移动业务 UI，Rsbuild 开发服务器监听 `0.0.0.0:1421`，生产构建输出
  `mobile/dist`。
- `mobile/src/index.tsx` 检测到 `window.shell360Native` 时动态安装 `bridge/native`，否则
  安装 `bridge/tauri`。
- `bridge/native` 已实现请求 ID、页面级 `clientId`、Promise、超时、结构化错误、事件订阅、
  `targetId` 和 `bridge.releaseClient`。
- HarmonyOS 应提供相同的 `window.shell360Native` 传输接口，不新增 HarmonyOS 私有业务协议，
  不在 ArkTS 中复制 React 业务逻辑。

### Rust 与 UniFFI

- `shell360-ffi` 已导出 `Shell360Runtime`、`FfiEventSink`、`invoke_keygen`、`invoke_data`、
  `invoke_ssh`、`release_client` 和 `shutdown`。
- 普通参数、返回值和事件使用 JSON 字符串，适合保持窄而稳定的跨语言边界。
- 业务实现继续位于 `shell360-store`、`shell360-keygen` 和 `shell360-ssh`。
- `Shell360Runtime` 内部持有多线程 Tokio runtime；当前导出方法通过 `block_on` 对调用方
  表现为同步调用，因此不得运行在 ArkUI 或 ArkTS JS 主线程。
- 当前 UniFFI 配置只生成 Kotlin Android binding。ArkTS 无法直接复用 Kotlin/JNI 产物，
  但可以复用 Rust runtime、JSON 路由、事件和错误模型。

### Android 行为基线

HarmonyOS 实现应尽量对齐 Android 已有行为：

- Debug 加载本地开发服务器，Release 只加载应用内 Web 资源。
- Web 页面只通过 `bridge/native` 调用宿主。
- Bridge 使用显式方法白名单、1 MiB 控制消息上限和结构化错误。
- WebView/UI 线程不执行阻塞 Rust 调用。
- Rust 事件由宿主安全切回页面线程后推送。
- 外部导航使用 scheme 白名单；不受信页面不能继续持有原生能力。
- 页面销毁、reload 或 HMR 后释放旧 `clientId` 对应的 SSH、SFTP 和监听器资源。

## 目标架构

```text
mobile React
    |
    v
bridge/native (NativeTransport)
    |
    v
window.shell360Native
    |
    v
HarmonyOS Web JSBridge
    |
    v
ArkTS BridgeRouter
    |                          \
    v                           v
ArkTS RustBridge          HarmonyOS 平台能力
    |                      app/dialog/fs/clipboard/window
    v
N-API native module
    |
    v
稳定 C ABI 或 Rust N-API adapter
    |
    v
shell360-ffi
    |
    +-- shell360-store
    +-- shell360-keygen
    +-- shell360-ssh

Rust FfiEventSink
    -> N-API 线程安全回调
    -> ArkTS EventDispatcher
    -> WebviewController.runJavaScript
    -> window.shell360Native.onmessage
```

## 固定职责边界

- React 负责全部业务 UI、路由、状态和业务流程。
- `bridge/native` 负责后端中立的请求、响应、事件、超时和能力 facade。
- HarmonyOS WebView 宿主只负责页面生命周期、资源加载、导航、安全、诊断和 JS 注入。
- ArkTS `BridgeRouter` 只做协议校验、显式方法路由、平台能力适配和错误归一化。
- N-API/C ABI 层只做类型、线程、内存、runtime handle 和 callback 转换，不承载业务逻辑。
- `shell360-ffi` 只负责 FFI、runtime 生命周期、JSON 路由和事件转发。
- SSH、SFTP、Keygen、Data 和加密业务继续由现有 Rust crate 提供。
- HarmonyOS 不提供本地 PTY；未实现能力显式返回 `BRIDGE_UNSUPPORTED`。
- Release 只加载 HAP 内置 Web 资源，不允许远程页面获得 Native Bridge。
- 大文件不经过 JSON/Base64 Bridge；使用平台文件句柄、受控路径或临时文件中转。

## WebView 改造

### 页面承载

- 保留 `EntryAbility` 和 Stage 模型生命周期。
- 以 ArkUI `Web` 组件替换 `Index.ets` 的示例 UI。
- `WebviewController` 由稳定的页面 owner 持有，ArkUI 重绘不得重建 WebView 或 Rust runtime。
- 页面提供 loading、加载失败、Bridge 初始化失败和 native module 加载失败状态。
- renderer 崩溃或页面加载失败时显示可诊断的原生错误页，而不是白屏。

### Release 资源

```text
pnpm --filter mobile run build
    -> mobile/dist
    -> 声明式同步到 HAP Web 资源输入目录
    -> resources/rawfile/www/index.html
```

- 首选使用 `$rawfile` 或 HarmonyOS 官方资源协议加载 `www/index.html`。
- Web 生产资源必须使用相对 URL，必须验证动态 import、CSS、字体、SVG 和 Web Worker。
- 必须验证 React Router 深层路由和刷新。若资源协议不支持 history fallback，优先使用
  hash router，不为此引入应用内 HTTP server。
- 只有在 `$rawfile`/资源协议经设备验证无法满足必要 Web API 时，才单独评估自定义 scheme
  或应用内 localhost server。

### Debug 资源

- `pnpm run harmonyos:dev` 负责启动 `mobile` dev server、设备选择、端口映射、安装和启动。
- Debug WebView URL 可配置；真机优先使用开发机局域网地址。
- 只有在当前设备和 API 版本实测支持时才使用 `hdc rport` 或等效反向映射，并记录命令。
- Debug 可开启 Web 调试、HMR 和必要的明文 HTTP；Release 必须关闭这些能力。
- Dev server 生命周期留在根 Node.js 脚本，Hvigor 只负责可重复构建。

### 生命周期

- `onWindowStageCreate`：创建页面 owner、WebView 和 Bridge。
- Controller attached：注册代理、固定 dispatcher 和诊断回调。
- 页面加载开始：禁用旧页面 Bridge、轮换 session token、释放旧 client。
- 页面加载完成：完成 bridge-ready 握手并允许当前页面发送请求。
- `onForeground`/`onBackground`：同步 Web 活跃状态；默认不主动销毁 SSH 会话。
- 系统返回：先由 Web 路由处理，再尝试 Web history，最后退出 Ability。
- `onWindowStageDestroy`/`onDestroy`：拒绝 pending 请求、释放 client、注销 callback 和代理，
  最终释放 runtime。

### 导航与安全

- Release 仅信任应用内页面；Debug 仅额外信任显式配置的开发 origin。
- 外部 `http`、`https`、`mailto`、`tel` 使用系统能力打开，其余 scheme 默认拒绝。
- 禁止任意新窗口、混合内容、文件系统浏览、摄像头、麦克风和地理位置，除非后续明确授权。
- SSL 错误直接失败，不提供忽略证书选项。
- `javaScriptProxy` 在 API 26 SDK 声明中可能注入所有 frame，不能把“对象已注入”视作安全
  边界。每次文档加载生成随机 session token，并在每条请求中验证。
- 页面离开白名单地址后立即失去 Bridge 能力。
- 原生向 Web 回传时只能调用固定 dispatcher；JSON 必须安全序列化，禁止把未转义数据拼进
  JavaScript 源码。
- Release 使用严格 CSP，不允许远程脚本和 `eval`；Debug 单独放宽 HMR 所需规则。

## Bridge v1 协议

首个实现保持与当前 Android 和 `bridge/native` 兼容，不要求同时升级现有平台协议。

### 请求

```json
{
  "id": "request-uuid",
  "clientId": "page-client-uuid",
  "method": "data.getHosts",
  "params": null
}
```

### 成功响应

```json
{
  "id": "request-uuid",
  "result": []
}
```

### 失败响应

```json
{
  "id": "request-uuid",
  "error": {
    "code": "BRIDGE_INVALID_REQUEST",
    "message": "Invalid request",
    "details": null
  }
}
```

### Native 事件

```json
{
  "clientId": "page-client-uuid",
  "event": "ssh.shell.data",
  "targetId": "shell-uuid",
  "sequence": 1,
  "payload": "base64-data"
}
```

### 协议约束

- `id`、`clientId` 和 `method` 必须为非空字符串，无参数请求使用 `params: null`。
- ArkTS 只路由完整方法名白名单，不使用反射或动态 native symbol 调用。
- 单条请求、响应和事件的 UTF-8 编码大小上限为 1 MiB。
- `clientId` 隔离不同页面 generation 拥有的 Rust 资源。
- 未知方法返回 `BRIDGE_UNSUPPORTED`；非法 JSON 或参数返回 `BRIDGE_INVALID_REQUEST`。
- Web 层继续管理默认超时和领域长超时；ArkTS 保存 pending 状态以拒绝重复 ID、忽略迟响应
  并限制并发。
- Promise 超时不等于 native 工作已经取消。首个实现取消等待并丢弃迟响应；真正的 SFTP、SSH
  或长任务取消必须增加领域级 Rust API。
- `bridge.releaseClient` 是页面卸载时的资源释放兜底。
- 同一 shell 的 send、resize 和 close 保持顺序；独立 session 可以并行。
- 高频 terminal 事件按最多 16 ms 或约 32 KiB 合并，事件队列必须有界。

后续只有在 Android、iOS、HarmonyOS 和 Web 可以同步迁移时，才引入显式 `version`、`type`、
`sessionToken` 或通用 cancel envelope。HarmonyOS 的安全 token 可以先由宿主 adapter 内部处理，
不改变业务方法格式。

## FFI 方案

### 推荐路线

当前实现使用 `shell360-ffi` + `shell360_ohrs`：

1. 继续复用 `Shell360Runtime` 和 JSON 路由。
2. `shell360_ohrs` 使用 `napi-rs` 直接导出 HAP 中的 `libentry.so`。
3. native module 暴露异步 `createRuntime`、`invoke`、`releaseClient` 和 `shutdown`。
4. `napi-rs` 的 `AsyncTask` 在 native worker 调用 Rust Runtime，Promise 完成后回到 ArkTS JS 线程。
5. Rust `FfiEventSink` 通过 `ThreadsafeFunction` 回到 ArkTS。

### 直接 Rust N-API 与 C ABI 回退

| 方案                         | 优点                        | 风险                                                   | 决策               |
| ---------------------------- | --------------------------- | ------------------------------------------------------ | ------------------ |
| Rust 直接导出 N-API          | 边界最薄，少一层 C++        | Rust N-API crate 对 OHOS target 和 API 26 的支持需验证 | 阶段 0 首选 spike  |
| 稳定 C ABI + C++ N-API       | ABI、内存、错误和工具链可控 | 多一层极薄 wrapper                                     | 必须保留的回退方案 |
| 为 UniFFI 新增 ArkTS backend | 可能自动生成类型            | 生成器维护成本高，当前 JSON 边界收益低                 | 不推荐             |
| 复用 Kotlin UniFFI/JNI       | 无                          | ArkTS/HarmonyOS 不能消费 Kotlin/JNI 产物               | 不可行             |

若直接 N-API 不可用，最小 C ABI 为：

```c
typedef struct Shell360RuntimeHandle Shell360RuntimeHandle;

Shell360RuntimeHandle* shell360_runtime_new(
    const char* app_data_dir,
    const char* cache_dir,
    shell360_event_callback callback,
    void* callback_context,
    Shell360Error* error);

Shell360OwnedString shell360_invoke(
    Shell360RuntimeHandle* runtime,
    const char* method,
    const char* client_id,
    const char* params_json);

void shell360_string_free(Shell360OwnedString value);
void shell360_runtime_free(Shell360RuntimeHandle* runtime);
```

### ABI 与产物

API 26 Native toolchain 和当前 Rust toolchain 列出以下对应目标：

| HAP ABI       | Rust target                  | 用途                           |
| ------------- | ---------------------------- | ------------------------------ |
| `arm64-v8a`   | `aarch64-unknown-linux-ohos` | 真机，必须                     |
| `x86_64`      | `x86_64-unknown-linux-ohos`  | 模拟器和 CI，建议              |
| `armeabi-v7a` | `armv7-unknown-linux-ohos`   | 仅产品明确支持 32 位设备时增加 |

当前开发机只安装了 `x86_64-unknown-linux-ohos`。阶段 0 必须安装并验证 arm64 target，不能以
模拟器通过代替真机验证。

### 类型、内存和错误

- FFI 只传 UTF-8 string、opaque runtime handle、callback 和结构化错误。
- ArkTS/N-API 输入只在调用期间借用；Rust 需要保存时复制。
- Rust 返回字符串由 Rust 分配，只能使用配套函数释放。
- runtime handle 由单一 owner 持有，`dispose`/`shutdown` 幂等。
- callback context 必须比 runtime 存活更久，并在 runtime 销毁后禁止回调。
- Rust panic 不得跨越 C/N-API 边界；转换成稳定的 native 错误。
- 不向 ArkTS 暴露 Rust 指针、SQLite handle、Tokio future 或绝对内部路径。
- `FfiError` 映射到现有 Bridge `code/message/details`，不向 Web 返回调用栈、密码或私钥。

### 线程与异步

- Web proxy、ArkTS JS 和 ArkUI 主线程不得执行 `runtime.block_on`。
- N-API `invoke` 返回 Promise，在受控 native worker/async work 中调用现有同步 FFI。
- 完成后回到 ArkTS JS 线程 resolve/reject，再切到 Web controller 所在线程回复页面。
- Rust event callback 可以来自 Tokio worker，必须通过 N-API thread-safe function 或平台等效
  机制调度，禁止直接调用 ArkTS 或 Web API。
- runtime 内部并发由现有 Rust service 管理；ArkTS 只增加有界入口队列和资源级顺序约束。

### 必须先验证的依赖

- `sea-orm` / `sqlx-sqlite` 的 OHOS 编译、文件锁和 SQLite 链接。
- `ring`、RSA、系统随机数和 `getrandom`。
- Tokio socket、DNS、IPv4/IPv6 和线程。
- `russh`、`russh-sftp` 与端口转发。
- `uniffi` 作为编译依赖是否影响 OHOS cdylib；必要时以 Cargo feature 将 HarmonyOS adapter
  与绑定生成器解耦。
- 动态库依赖、最低 API、导出符号、HAP 打包位置和应用数据目录权限。

## 建议目录结构

具体目录在阶段 0 spike 后冻结，当前建议如下：

```text
harmonyos/
|-- entry/
|   |-- src/main/ets/
|   |   |-- bridge/
|   |   |-- platform/
|   |   |-- runtime/
|   |   `-- pages/Index.ets
|   |-- src/main/rust/
|   |   |-- CMakeLists.txt
|   |   `-- napi_init.cpp
|   |-- src/main/resources/rawfile/www/   # 生成或同步输入
|   `-- types/libentry/index.d.ts
|-- generated/                            # 构建产物，不手工维护
`-- README.md                             # 可选的开发命令入口

scripts/harmonyos/
|-- index.ts
|-- constants.ts
|-- build.ts
|-- dev.ts
|-- hdc.ts
`-- devices.ts
```

如直接 Rust N-API 需要独立 crate，优先建立一个只含平台胶水的 adapter crate；不得把 HarmonyOS
平台逻辑放进 `shell360-store`、`shell360-ssh` 或 `shell360-keygen`。

## 构建与增量开发

### 建议命令

```text
pnpm run harmonyos:dev
pnpm run harmonyos:build
pnpm run harmonyos:build
pnpm run harmonyos:build
```

### Release

```text
pnpm --filter mobile run build
    -> 同步 mobile/dist 到声明的 HAP Web 资源输入
    -> 同时构建 arm64-v8a 与 x86_64 Rust release 动态库
    -> 构建/链接 N-API module
    -> Hvigor assembleHap
    -> 签名与产物校验
```

### Debug

```text
检查 DevEco SDK、Rust targets 和设备
    -> 启动 mobile dev server
    -> 仅构建当前设备 ABI 的 Debug native module
    -> Hvigor 构建并安装 Debug HAP
    -> 配置开发 URL/端口映射
    -> 启动 Ability 并输出 Web 调试入口
```

### 构建边界

- Node.js 脚本负责 dev server、设备选择、`hdc`、安装和启动生命周期。
- Hvigor/CMake 负责声明 Web 资源、Rust/native module 和 HAP 的可重复构建依赖。
- Web、Rust、N-API 和 HAP 使用独立中间目录，生成物不手工复制或维护。
- 修改 Web 时依赖 HMR；修改 Rust 时只重建当前 ABI；修改 ArkTS/N-API 时重新部署 HAP。
- Release 必须校验 Web 资源和 native library 来自当前源码，不能静默使用过期生成物。

## 分阶段实施计划

### 阶段 0：平台与 FFI spike

涉及：

- `harmonyos/entry/src/main/rust/` 或 Rust N-API adapter crate。
- `harmonyos/entry/build-profile.json5`、CMake 和 native 类型声明。
- `shell360-ffi` 的最小构建 feature/adapter，只有实际需要时才调整。

任务：

- 构建最小 `health_check` 动态库。
- ArkTS 通过 Promise 调用 native worker。
- native worker 调用 Rust 并返回字符串。
- Rust 后台线程主动推送事件到 ArkTS。
- 验证 runtime 创建、销毁、错误和 panic 隔离。
- 分别验证 x86_64 模拟器与 arm64 真机。

完成标准：

- `health_check` 返回 `ok`，UI 无主线程卡顿。
- Rust 后台事件稳定到达 ArkTS，销毁后不再回调。
- HAP 中 ABI、动态依赖和符号符合预期。
- 直接 Rust N-API 或 C ABI+C++ N-API 路线形成书面结论。

回退：

- Rust N-API crate 不兼容时回退稳定 C ABI+C++ N-API。
- 依赖树尚不能编译时只验证独立最小 Rust crate，并将具体依赖列为阶段 3 阻塞项。

### 阶段 1：WebView 宿主

涉及：

- `EntryAbility.ets`、`pages/Index.ets`、WebView owner 和资源配置。
- `mobile/rsbuild.config.ts`，仅在需要相对资源路径时调整。

任务：

- 建立 Web 页面、controller、loading/error UI、返回键和生命周期。
- Debug 加载 dev server；Release 加载内置资源。
- 建立导航分类、外部 URL、SSL/renderer/load error 处理。
- 验证 HMR、动态 chunk、路由、键盘、前后台和重建。

完成标准：

- Debug 可刷新和 HMR；Release 断网可启动完整 React UI。
- 未受信导航不会保留后续 Bridge 能力。
- 加载失败显示可诊断错误，不显示空白页。

回退：

- history route 不可用时回退 hash router。
- 资源协议不满足必要能力时再评估自定义 scheme；不直接引入本地 HTTP server。

### 阶段 2：Bridge v1

涉及：

- ArkTS bridge message、router、transport、error 和 Web adapter。
- `bridge/native` 仅在 HarmonyOS 无法模拟现有 port 时做最小兼容调整。

任务：

- 实现 `bridge.health`、`app.getVersion` 等无 Rust或最小方法。
- 实现请求、响应、事件、超时状态、大小限制和方法白名单。
- 实现页面 generation、session token、旧响应丢弃和 client 释放。
- 为非法 JSON、缺字段、未知方法、重复 ID、超大消息和错误页面来源增加测试。

完成标准：

- `bridge/native` 无 HarmonyOS 业务分支即可工作。
- 并发请求按 ID 正确返回；错误稳定映射为 `NativeBridgeError`。
- reload/HMR 后无旧 pending Promise、旧事件或旧 client 资源。

回退：

- 若 `javaScriptProxy` 无法满足安全要求，比较 API 26 提供的 message port 或文档脚本接口，
  但保持 Web 侧 `NativeMessagePort` 形状不变。

### 阶段 3：最小 Web → Rust 链路

涉及：

- ArkTS `RustBridge`、native module、`shell360-ffi` adapter。

任务：

- 路由 `bridge.health` 或 `keygen.generate` 到 Rust。
- 实现 worker、Promise、错误、event callback 和 runtime 生命周期。
- 建立可重复的 native 构建与 HAP 链接任务。

完成标准：

- Web Promise 经 ArkTS/N-API/Rust 完整往返。
- Rust 主动事件抵达正确 client。
- 慢调用期间 Web 与 ArkUI 仍可响应。

回退：

- 若完整 `shell360-ffi` 依赖树阻塞，先接入仅依赖 `shell360-keygen` 的垂直切片，随后修复
  `shell360-ffi` 依赖，不在 ArkTS 复制业务。

### 阶段 4：Keygen 与 Data

涉及：

- `keygen.*`、`data.*` 路由、数据目录和错误映射。

任务：

- 接入 Keygen、全部现有 Data CRUD、crypto 流程和 `data.authedChange`。
- 验证 SQLite、config、known_hosts 等文件位于应用沙箱预期目录。
- 验证升级、重启、卸载、备份和敏感缓存策略。

完成标准：

- Key、Host、PortForwarding CRUD 与现有平台数据结构一致。
- 数据和认证状态在应用重启后符合预期。
- 错误不会泄露密码、私钥或数据库内部信息。

回退：

- SQLite 或 crypto 依赖阻塞时保持平台明确不可用，不使用 ArkTS 临时数据库复制业务。

### 阶段 5：SSH Terminal

涉及：

- `ssh.session.*`、`ssh.shell.*`、事件聚合和应用前后台策略。

任务：

- 接入连接、known_hosts、认证、shell、send、resize、close 和 disconnect。
- 对齐 Android 的 client/session/shell 所有权和错误码。
- 实现有界事件队列、Base64 terminal 数据和批量推送。
- 验证断网、前后台、多个 session、长时间运行和 renderer reload。

完成标准：

- 真机可完成 SSH 连接、认证和交互式终端。
- terminal 输出顺序正确且无明显 UI 卡顿。
- 页面和 Ability 销毁后连接按策略释放。

回退：

- 高频事件性能不足时调整批量阈值，不改变 Web 业务协议。

### 阶段 6：SFTP 与平台能力

涉及：

- ArkTS platform services、文件选择、受控文件访问和 SFTP 中转。

任务：

- 接入 clipboard、openUrl、app、machine UID、dialog、fs 和 window 语义。
- 对接 HarmonyOS 文件选择器、URI/FD 或沙箱路径。
- SFTP 上传下载使用临时文件或 FD，不通过 JSON 搬运文件内容。
- 实现进度、取消、权限拒绝、临时文件清理和路径穿越防护。

完成标准：

- 导入、导出、SFTP 上传下载和取消核心流程可用。
- 平台 capability 声明与实际能力一致。
- 路径越界、非法 scheme 和权限拒绝均得到稳定错误。

回退：

- 外部 URI 不能直接交给 Rust 时沿用 Android 的受控 cache staging 方案。

### 阶段 7：构建、CI 与发布

涉及：

- `scripts/harmonyos/`、根 `package.json`、Hvigor/CMake 和 CI。

任务：

- 实现统一 dev/build 命令。
- 为任务声明输入输出和 ABI，保证 Gradle/Android、Xcode/iOS 不受影响。
- 建立干净 checkout、模拟器 Debug、真机 arm64 Release 和离线启动验证。
- 检查 HAP 中 Web 资源、ABI、动态依赖、调试开关和开发 URL。

完成标准：

- 一条仓库命令可生成可安装 Debug HAP。
- 一条仓库命令可生成 Release HAP/APP 产物。
- CI 可以从干净 checkout 重现核心产物。

回退：

- Hvigor 自定义任务接口不稳定时由 Node 编排外部步骤，Hvigor 只消费声明的生成目录。

### 阶段 8：安全、稳定性与性能

任务：

- 完成导航、frame、token、CSP、SSL、调试开关和消息 fuzz 测试。
- 完成内存、线程、handle、callback 和页面 generation 泄漏测试。
- 完成大输出 terminal、大文件 SFTP、并发 session 和长时间前后台测试。
- 验证 renderer crash、Ability 重建、系统回收、断网和升级。
- 记录 API 26 Beta 到正式版的差异并更新本文。

完成标准：

- 安全与稳定性清单全部有自动化结果或可重复真机记录。
- Release 不包含开发 URL，不开启 Web 调试，不允许远程页面调用 Bridge。
- arm64 真机和 x86_64 模拟器的关键路径均通过。

## 待确认问题

1. API 26 是否是正式发布的最低版本，还是需要兼容更早的正式 API。
2. 产品是否只支持 arm64 真机，CI 是否必须覆盖 x86_64 模拟器。
3. API 26 是否存在可限制主 frame/origin 的 Web message API，安全性是否优于
   `javaScriptProxy`。
4. `$rawfile` 下动态 import、Worker、字体、SVG 和 React Router 的真实行为。
5. 当前设备版本可用的 `hdc` 端口反向映射能力和命令。
6. HarmonyOS 文件选择器返回 URI、FD 或沙箱路径的形式及持久权限策略。
7. 前后台切换时 SSH、端口转发和下载任务的产品策略。
8. 生物识别加密首版是实现、显式不支持，还是使用 HarmonyOS安全存储能力。
9. 需要支持的最大 terminal 吞吐量、SFTP 文件大小和并发 session 数。
10. HarmonyOS native module 的最终命名、HAP `libs` 目录和 Hvigor DSL，以 API 26 最小样例
    编译结果为准。

## 风险与验证清单

- [ ] `shell360-ffi` 全依赖树可编译到 `aarch64-unknown-linux-ohos`。
- [ ] x86_64 模拟器成功不能代替 arm64 真机验证。
- [ ] HAP 中 native ABI、动态依赖、导出符号和最低 API 正确。
- [ ] N-API Promise 和同步 Rust FFI 不阻塞 ArkUI/ArkTS JS 线程。
- [ ] Rust worker 事件只通过线程安全机制进入 ArkTS。
- [ ] runtime、callback、字符串和 opaque handle 无泄漏、悬挂或重复释放。
- [ ] `$rawfile` 的 HTML、chunk、CSS、字体、SVG 和 Worker 均可加载。
- [ ] Debug dev server、设备网络、明文 HTTP 和 HMR 可用。
- [ ] Release 无开发 URL、无 Web 调试、无任意远程 origin Bridge。
- [ ] iframe、redirect 和导航切换不能复用旧 token 或旧 client。
- [ ] 非法 JSON、重复 ID、超大消息、未知 method 和错误参数均返回规范错误。
- [ ] 页面 reload、Ability 销毁和 renderer 崩溃都会释放 client 与 native 资源。
- [ ] 请求超时或取消后的迟响应不会命中新的请求。
- [ ] 同一 shell 的 send、resize、close 顺序稳定。
- [ ] terminal 高频输出不会导致 ArkTS/Web 主线程不可用。
- [ ] SFTP 大文件不通过 Bridge 搬运，临时文件始终清理。
- [ ] 前后台、断网、系统回收、升级和重启行为符合产品策略。
- [ ] React 业务代码没有 HarmonyOS 平台分支，平台能力仍通过 `bridge` 暴露。

## 官方资料基线

- [HarmonyOS Web 组件 API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/ts-basic-components-web)
- [WebviewController API](https://developer.huawei.com/consumer/cn/doc/harmonyos-references/js-apis-web-webview)
- [HarmonyOS Native API / N-API 开发指南](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/napi-guidelines)

当前 API 26 SDK 类型声明已确认存在 Web 本地 rawfile 资源、`javaScriptProxy`、
`runJavaScript`、`onLoadIntercept` 和 mixed-content 配置，以及 Native N-API 头文件和
arm64-v8a、armeabi-v7a、x86_64 toolchain。具体签名、线程保证、frame/origin 安全属性和
Hvigor 打包 DSL 必须以实施时安装的正式 SDK、官方文档和最小样例编译结果为准。

## 每阶段交付模板

完成一个阶段时，在对应任务或 PR 中记录：

```text
阶段：
状态：

已完成：
-

未完成/延期：
-

验证命令：
-

模拟器验证：
-

真机验证：
-

已知风险：
-

回退策略：
-

文档更新：
-
```

只有本阶段的完成标准全部满足后，才能把顶部状态改为 `已完成`。
