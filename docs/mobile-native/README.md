# 移动端原生宿主实施方案（iOS / HarmonyOS）

## 文档目的

本文是顶层 `ios/` 与 `harmonyos/` 工程的分阶段实施文档。目标是把 SwiftUI / ArkUI 示例应用
改造成 Shell360 的独立 WebView 宿主，通过与 Android 共用的 `bridge/native` 协议调用平台能力
和 `shell360-ffi`，最终进入 Rust Core。

本文只定义方案、边界、实施顺序和验收标准，不代表对应功能已经完成。每一阶段均应在验收通过后
更新“实施状态”，再开始依赖它的后续阶段。

Android 宿主的统一说明见 `../android-native/README.md`；JSB 引擎 / 传输的当前架构与迁移状态见
`../architecture/jsb/`（其中三端 JSB transport 迁移均已落地，宿主只做 `JsbTransport` 传输适配
与 `HostServices` 系统原语）。

## 实施状态

> 下表保留各平台原实施计划最后一次记录的状态。三端 JSB 引擎/传输迁移已完成，以
> `../architecture/jsb/architecture.md` 为准。

### iOS

| 阶段 | 优先级 | 状态 | 目标 |
| --- | --- | --- | --- |
| 0 | P0 | 未开始 | 固化跨端协议与 iOS 工程边界 |
| 1 | P0 | 已完成（基础切片） | 建立 WebView 宿主与页面加载 |
| 2 | P0 | 已完成 | 生成 Swift Binding 与平台静态库 |
| 3 | P0 | 已完成 | 打通 Web → Swift → Rust 最小链路 |
| 4 | P1 | 已完成 | 接入 Data、Keygen 和错误模型 |
| 5 | P1 | 已完成 | 接入 SSH Terminal 与事件通道 |
| 6 | P1 | 已完成 | 接入 SFTP 和 iOS 平台能力 |
| 7 | P1 | 已完成 | 建立 Debug、Release、CI 与发布流程 |
| 8 | P2 | 已完成 | 安全加固、测试和旧 iOS 路径清理 |

### HarmonyOS

| 阶段 | 优先级 | 状态 | 目标 |
| --- | --- | --- | --- |
| 0 | P0 | 进行中 | 验证 Rust、N-API、ABI 和跨线程回调 |
| 1 | P0 | 进行中 | 建立 WebView 宿主及 Debug/Release 页面加载 |
| 2 | P0 | 进行中 | 建立 Web 与 ArkTS 的 Bridge v1 通道 |
| 3 | P0 | 进行中 | 打通 Web → ArkTS → Rust 最小垂直链路 |
| 4 | P1 | 进行中 | 接入 Keygen、Data、持久化和错误模型 |
| 5 | P1 | 进行中 | 接入 SSH Terminal 与事件通道 |
| 6 | P1 | 进行中 | 接入 SFTP 和 HarmonyOS 平台能力 |
| 7 | P1 | 进行中 | 建立构建、增量开发、CI 和发布流程 |
| 8 | P2 | 进行中 | 安全加固、稳定性验证和性能优化 |

状态只使用：`未开始`、`进行中`、`已完成`、`阻塞`。

## 固定职责边界

- React 负责全部业务 UI、路由、状态和业务流程。
- `bridge/native` 负责后端中立的请求、响应、事件、超时和能力 facade。
- WebView 宿主只负责页面生命周期、资源加载、导航、安全、诊断和 JS 注入。
- Bridge 路由层只做协议校验、显式方法路由、平台能力适配和错误归一化。
- N-API / C ABI / FFI 层只做类型、线程、内存、runtime handle 和 callback 转换，不承载业务逻辑。
- `shell360-ffi` 只负责 FFI、runtime 生命周期、JSON 转换和事件转发。
- SSH、SFTP、Keygen、Data 和加密业务继续由现有 Rust crate 提供。
- 移动端不提供本地 PTY；未实现能力显式返回 `BRIDGE_UNSUPPORTED`。
- Release 只加载 App Bundle / HAP 内置 Web 资源，不允许远程页面获得 Native Bridge。
- 大文件不经过 JSON/Base64 Bridge，使用平台文件句柄、受控路径或临时文件中转。
- 不允许 Web 直接访问任意绝对文件路径。

## Bridge v1 协议

iOS 与 HarmonyOS 共用同一套 `bridge/native` 请求、响应、事件和错误协议，不新增平台私有业务协议。

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

- `id`、`clientId` 和 `method` 必须为非空字符串；无参数请求使用 `params: null`。
- 宿主只路由完整方法名白名单，不使用反射或动态 native symbol 调用。
- 单条请求/响应/事件 UTF-8 编码默认上限 1 MiB，二进制 Channel 单帧默认上限 10 MiB；可在首个
  Channel 打开前按平台覆盖，大文件仍应优先使用文件传输接口。
- `clientId` 隔离不同页面 generation 拥有的 Rust 资源；未知方法返回 `BRIDGE_UNSUPPORTED`。
- 宿主不向 Web 返回调用栈、密码、私钥或不必要的本地绝对路径。
- SSH 终端二进制数据继续使用 Base64（iOS 与 HarmonyOS 一致）。
- Promise 超时不等于 native 工作已经取消；首个实现取消等待并丢弃迟响应，真正的取消需领域级
  Rust API。
- 同一 shell 的 send、resize 和 close 保持顺序；独立 session 可以并行；高频终端事件按约 16 ms
  或约 32 KiB 合并，事件队列必须有界。
- `bridge.releaseClient` 是页面卸载时的资源释放兜底。

后续只有在 Android、iOS、HarmonyOS 和 Web 可以同步迁移时，才引入显式 `version`、`type`、
`sessionToken` 或通用 cancel envelope。平台安全 token 可先由宿主 adapter 内部处理，不改变业务
方法格式。

## 平台差异总览

| 关注点 | iOS | HarmonyOS |
| --- | --- | --- |
| 宿主工程 | `ios/shell360.xcodeproj`（SwiftUI + `UIViewRepresentable`） | `harmonyos/`（Stage 模型 + ArkUI `Web` 组件） |
| 页面组件 | `WKWebView` | ArkWeb `Web` 组件 |
| JS 桥接 | WKScriptMessage（页面内 `MessageChannel`，二进制 Base64 仅限适配器内部） | `javaScriptProxy` / MessagePort |
| Rust 绑定 | UniFFI 生成 Swift binding + 平台静态库 | N-API（`shell360_ohrs`）或稳定 C ABI |
| 传输适配器 | `IosJsbTransport`（`DispatchQueue.main` 投递） | `MessagePortBridge`（`JsbTransportEvent` ThreadsafeFunction） |
| 系统原语 | `IosHostServices`（14 原语） | `HarmonyHostServices`（14 原语） |
| 文件选择 | `UIDocumentPicker`（security-scoped URL） | 文件选择器（URI/FD 或沙箱路径） |
| 调试 | dev server `http://127.0.0.1:1421` + `isInspectable` | dev server + `hdc` 端口映射 |
| Release 资源 | App Bundle `WebAssets`（`loadFileURL`） | HAP `resources/rawfile/www`（`$rawfile`） |

## iOS 分阶段实施

### 目标架构

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
WKWebView JavaScript Bridge
    |
    v
Swift BridgeRouter
    |                         \
    v                          v
Swift RustBridge          iOS 平台能力
    |                     app/dialog/fs/clipboard
    v
UniFFI Generated Swift Bindings
    |
    v
iOS 平台静态库
    |
    v
shell360-ffi
    |
    +-- shell360-store
    +-- shell360-keygen
    +-- shell360-ssh
```

### 固定架构约束

- 使用顶层 `ios/shell360.xcodeproj`，不改造 `src-tauri/gen/apple`。
- 保留 SwiftUI App Lifecycle，使用 `UIViewRepresentable` 承载 `WKWebView`。
- 业务逻辑继续位于 `shell360-store`、`shell360-keygen` 和 `shell360-ssh`。
- Rust 同步 FFI 调用不得阻塞 WebKit 主线程。

### 能力矩阵基线

| 域 | iOS 首版策略 |
| --- | --- |
| `bridge.*` | Swift 实现 |
| `keygen.*` | 转发 Rust |
| `data.*` | 转发 Rust |
| `ssh.*` | 转发 Rust，文件中转除外 |
| `app.*` | `getVersion` 由 Rust 实现（`CARGO_PKG_VERSION`）；`setSystemBarsAppearance` 由 Swift 实现 |
| `machineUid.*` | Rust 实现（`app_data_dir/machine_uid` 持久化 UUID v4） |
| `core.openUrl` | Swift 实现，scheme 白名单 |
| `dialog.*` | Swift 实现 |
| `fs.*` | Swift 实现，受控路径 |
| `clipboard.*` | Swift 实现 |
| `window.close` | 定义移动端安全语义 |
| `pty.*` | 不支持 |
| `updater.*` | 不支持 |
| `process.relaunch` | 不支持 |

### 建议目录结构

```text
ios/
├── Config/                     # Debug.xcconfig / Release.xcconfig
├── Generated/                  # 生成产物，不手工维护
├── Scripts/                    # 由仓库根 Node.js CLI 统一执行
├── shell360/
│   ├── App/                    # shell360App / AppContainerView / AppRuntime
│   ├── WebView/                # WebViewContainer / WebViewCoordinator / ...
│   ├── Bridge/                 # BridgeMessage / BridgeError / BridgeRouter / JavaScriptBridge
│   ├── Rust/                   # RustBridge / RustEventSink
│   ├── Platform/               # App / Clipboard / ExternalURL / File / MachineUID
│   └── WebAssets/
└── shell360.xcodeproj/
```

### 阶段 1：WKWebView 宿主

页面加载策略：

| 构建 | 页面来源 | 说明 |
| --- | --- | --- |
| Debug | 可配置开发服务器 | 模拟器默认 `http://127.0.0.1:1421` |
| Release | App Bundle `WebAssets/index.html` | 必须离线工作 |

Release 推荐 `loadFileURL(_:allowingReadAccessTo:)`，读取权限只覆盖 WebAssets 根目录。若验证发现
`file://` 对必要 Web API 有不可接受限制，再单独评估 `WKURLSchemeHandler`，首版不引入本地 HTTP Server。

- 使用 `@StateObject` 或等效 owner 保证 SwiftUI 重绘不重建 WebView。
- Debug 开启 `isInspectable`，Release 关闭；Release 禁止任意远程导航和 mixed content。
- 外部 HTTP/HTTPS、mailto、tel 导航交给系统。
- 确定 React Router 刷新策略，优先无需 server rewrite 的路由方式。
- Debug.xcconfig 使用 `SHELL360_WEBVIEW_MODE=development` + URL；Release.xcconfig 使用
  `SHELL360_WEBVIEW_MODE=bundle`，Release 代码忽略外部传入的开发 URL。

### 阶段 2：UniFFI Swift 与平台静态库

Rust targets：`aarch64-apple-ios`、`aarch64-apple-ios-sim`、`x86_64-apple-ios`。

预期产物：

```text
ios/shell360/Generated/shell360_ffi.swift
ios/shell360/Generated/shell360_ffiFFI.h
ios/shell360/Generated/module.modulemap
ios/Generated/Rust/<Configuration>/iphoneos/libshell360_ffi.a
ios/Generated/Rust/<Configuration>/iphonesimulator/libshell360_ffi.a
```

- 使用仓库锁定的 UniFFI 版本生成 binding；simulator 同时请求 arm64/x86_64 时用 `lipo` 合并，
  device 与 simulator 始终分开。
- 把生成任务做成有明确 inputs/outputs 的可增量脚本，用 `LIBRARY_SEARCH_PATHS` 链接静态库。
- Xcode 启用 User Script Sandboxing 时，Run Script 必须声明仓库输入与生成输出。
- 首版使用仓库内脚本生成并由 Xcode 本地引用，不引入 CocoaPods，不生成 XCFramework。

### 阶段 3：最小 Web → Rust 垂直链路

打通 `React bridge.health → WKScriptMessageHandler → Swift BridgeRouter → Swift RustBridge →
UniFFI Shell360Runtime.healthCheck → Swift → JavaScript Promise`，并验证 `FfiEventSink` 反向推送。

组件职责：`JavaScriptBridge` 注册消息 handler / 注入 adapter；`BridgeMessage` 严格解析模型；
`BridgeRouter` 白名单路由与错误归一化；`RustBridge` 参数/结果/线程/错误适配；`RustEventSink`
接收 Rust 任意线程回调并切回 MainActor。

JS Adapter 在 document start 注入 `window.shell360Native`，把 `postMessage` 映射到
`window.webkit.messageHandlers.shell360Native.postMessage`，Swift 回传时调用固定接收入口触发
`window.shell360Native.onmessage`。不得通过字符串拼接把未转义 JSON 插入 JavaScript。

Runtime 生命周期：App Runtime 创建一次 `Shell360Runtime`；app data 用
`Application Support/shell360`，cache 用 `Library/Caches/shell360`；页面产生独立 `clientId`；
`pagehide` 或 WebView 销毁时调用 `bridge.releaseClient`，App Runtime 释放时调用 `shutdown`。

### 阶段 4：Keygen、Data 与错误模型

接入 `keygen.generate`、全部 `data.*` 与 `data.authedChange`，映射 `FfiError` 到 Bridge Error。
生物识别未落地前明确返回不支持；评估 iCloud/iTunes backup 排除规则。

### 阶段 5：SSH Terminal

接入 `ssh.session.*`、`ssh.shell.*`、known_hosts、各认证方式与 disconnect/data/eof/close 事件。
Terminal 输入输出继续用 Base64；高频 `shell.send`/`shell.resize` 不经过主线程阻塞队列；验证
UTF-8、ANSI、粘贴、大量输出、resize、跳板连接、known_hosts 一致性、页面重载清理与断网诊断。

### 阶段 6：SFTP 与 iOS 平台能力

SFTP 文件模型（Web 不能把任意本地绝对路径交给 Rust）：

```text
上传: UIDocumentPicker → security-scoped URL → App cache 临时文件 → Rust SFTP
下载: Rust SFTP → App cache 临时文件 → UIDocumentPicker/export → 用户目标
```

文件安全：App Data 路径标准化并限制在 `Application Support/shell360` 下；拒绝 `..`、符号链接
越界和非授权 scheme；security-scoped URL 只在实际 IO 窗口内持有；临时文件用随机 ID；大文件不
经过 JSON/Base64 Bridge；文件 picker 同时只允许一个，冲突返回 `BRIDGE_BUSY`。

### 阶段 7：构建、CI 与发布

```text
pnpm run ios:dev

# 签名归档并导出 IPA
IOS_CERTIFICATE=<p12-base64> \
IOS_CERTIFICATE_PASSWORD=<p12-password> \
IOS_MOBILE_PROVISION=<mobileprovision-base64> \
pnpm dotenvx pnpm run ios:build
```

- iOS 构建、资源同步和 UniFFI 生成全部由 Node.js 执行；Xcode 共享 Scheme 的 Build Pre-action 生成
  WebAssets，Target Build Phase 生成 UniFFI binding 和当前平台静态库。
- `ios:dev` 从 Xcode Build Settings 读取实际 `.app` 产物路径；`ios:build` 用 `app-store-connect`
  导出 `ios/build/shell360.ipa`，任一签名变量为空时立即失败。
- 签名使用独立临时 Keychain 与最小文件权限，结束后恢复 Keychain 搜索列表、删除临时描述文件。
- 使用 input/output file list 避免每次编译重建全部 Rust；归档 dSYM 与崩溃分析产物；CI 缓存
  pnpm/Cargo，不缓存签名密钥。

CI 建议：`frontend-check`（tsc + biome）、`rust-check`（fmt/clippy/test）、`ios-bindings`、
`ios-simulator`、`ios-archive`。

### 阶段 8：安全、测试与清理

WebView 安全清单：只接受主 frame 消息；只允许受信 Bundle 页面或 Debug 白名单 origin 注册 Bridge；
页面离开白名单后立即失去 Bridge 能力；Release 禁止任意 Remote URL、mixed content 和 Web Inspector；
禁止通过 Bridge 动态调用任意 Swift API；响应注入不使用未转义字符串拼接；Bridge 有请求大小、超时
和并发上限。

数据与隐私：密码/私钥/数据库明文不得进入日志；machine UID 不使用 IDFA；App Switcher 快照遮挡
敏感终端内容；缓存、临时下载和崩溃日志不进入备份；生物识别经 LocalAuthentication/Keychain 正确
实现后再声明 capability。

清理范围（独立 iOS 流程验收完成后再决定删除）：`src-tauri/gen/apple/`、
`src-tauri/tauri.ios.conf.json`、旧 Tauri iOS 构建脚本和 CI 分支。桌面 Tauri 工程必须保留，删除前
创建可定位的 Git commit/tag。

## HarmonyOS 分阶段实施

### 目标架构

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

### 当前基线

- 顶层 `harmonyos/` 是 Stage 模型工程，只有 `entry` 类型 HAP；`targetSdkVersion` 等均为
  `26.0.0`，设备类型仅 `phone`；`Index.ets` 尚未有 Web 组件/Bridge/业务 UI。
- 调研基线日期 2026-08-09，SDK 为 26.0.0.23 Beta1；Beta SDK 接口、Hvigor DSL 与设备行为在正式
  实施时必须重新核对。
- `shell360-ffi` 已导出 `Shell360Runtime` 等；ArkTS 无法直接复用 Kotlin/JNI 产物，但可复用 Rust
  runtime、JSON 路由、事件和错误模型。

### 页面承载与资源

- 保留 `EntryAbility` 和 Stage 模型生命周期，以 ArkUI `Web` 组件替换示例 UI。
- `WebviewController` 由稳定的页面 owner 持有，ArkUI 重绘不得重建 WebView 或 Rust runtime。
- Release 资源：`pnpm --filter mobile run build → mobile/dist → resources/rawfile/www/index.html`；
  首选 `$rawfile` 或官方资源协议，验证动态 import、CSS、字体、SVG 和 Web Worker；若资源协议不支持
  history fallback，优先 hash router，不引入应用内 HTTP server。
- Debug 由 `pnpm run harmonyos:dev` 负责 dev server、设备选择、端口映射、安装和启动；Debug 可开
  Web 调试/HMR/明文 HTTP，Release 必须关闭。

### 生命周期

`onWindowStageCreate` 创建页面 owner、WebView 和 Bridge；页面加载开始禁用旧 Bridge、轮换 session
token、释放旧 client；`onForeground`/`onBackground` 同步 Web 活跃状态；系统返回先由 Web 路由处理，
再尝试 Web history，最后退出 Ability；`onWindowStageDestroy`/`onDestroy` 拒绝 pending 请求、释放
client、注销 callback，最终释放 runtime。

### 导航与安全

Release 仅信任应用内页面，Debug 仅额外信任显式配置的开发 origin；外部 `http`/`https`/`mailto`/
`tel` 用系统能力打开，其余 scheme 默认拒绝；禁止任意新窗口、混合内容、文件系统浏览、摄像头、
麦克风和地理位置；SSL 错误直接失败；`javaScriptProxy` 在 API 26 可能注入所有 frame，每次文档加载
生成随机 session token 并在每条请求中验证；原生向 Web 回传只能调用固定 dispatcher，JSON 安全序列化；
Release 使用严格 CSP，不允许远程脚本和 `eval`。

### FFI 方案

当前实现使用 `shell360-ffi` + `shell360_ohrs`：复用 `Shell360Runtime` 和 JSON 路由；
`shell360_ohrs` 用 `napi-rs` 直接导出 `libentry.so`；`napi-rs` 的 `AsyncTask` 在 native worker 调用
Rust Runtime；`FfiEventSink` 通过 `ThreadsafeFunction` 回到 ArkTS。

| 方案 | 优点 | 风险 | 决策 |
| --- | --- | --- | --- |
| Rust 直接导出 N-API | 边界最薄 | Rust N-API crate 对 OHOS target/API 26 支持需验证 | 阶段 0 首选 spike |
| 稳定 C ABI + C++ N-API | ABI/内存/错误可控 | 多一层极薄 wrapper | 必须保留的回退方案 |
| 为 UniFFI 新增 ArkTS backend | 可能自动生成类型 | 生成器维护成本高 | 不推荐 |
| 复用 Kotlin UniFFI/JNI | 无 | ArkTS 不能消费 Kotlin/JNI 产物 | 不可行 |

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

| HAP ABI | Rust target | 用途 |
| --- | --- | --- |
| `arm64-v8a` | `aarch64-unknown-linux-ohos` | 真机，必须 |
| `x86_64` | `x86_64-unknown-linux-ohos` | 模拟器和 CI，建议 |
| `armeabi-v7a` | `armv7-unknown-linux-ohos` | 仅产品明确支持 32 位设备时增加 |

### 类型、内存与错误

FFI 只传 UTF-8 string、opaque runtime handle、callback 和结构化错误；Rust 返回字符串由 Rust 分配，
只能用配套函数释放；runtime handle 由单一 owner 持有，`dispose`/`shutdown` 幂等；callback context
必须比 runtime 存活更久；Rust panic 不得跨越 C/N-API 边界；不向 ArkTS 暴露 Rust 指针、SQLite handle、
Tokio future 或绝对内部路径；`FfiError` 映射到现有 Bridge `code/message/details`。

### 阶段 0 必须验证的依赖

`sea-orm`/`sqlx-sqlite` 的 OHOS 编译与 SQLite 链接；`ring`/RSA/`getrandom`；Tokio socket/DNS/
IPv4/IPv6；`russh`/`russh-sftp` 与端口转发；`uniffi` 作为编译依赖是否影响 OHOS cdylib；动态库依赖、
最低 API、导出符号、HAP 打包位置和应用数据目录权限。

### 阶段概览

- **阶段 0（平台与 FFI spike）**：构建最小 `health_check` 动态库，验证 ArkTS Promise → native worker
  → Rust → 事件推送链路，分别验证 x86_64 模拟器与 arm64 真机。
- **阶段 1（WebView 宿主）**：建立 Web 页面、controller、loading/error UI、返回键与生命周期；Debug
  加载 dev server，Release 加载内置资源。
- **阶段 2（Bridge v1）**：实现 `bridge.health` 等最小方法、请求/响应/事件/超时/白名单、页面
  generation/session token/旧响应丢弃/client 释放；若 `javaScriptProxy` 无法满足安全要求，比较
  API 26 的 message port 或文档脚本接口，但保持 Web 侧 `NativeMessagePort` 形状不变。
- **阶段 3（最小 Web → Rust 链路）**：路由 `bridge.health`/`keygen.generate` 到 Rust，实现 worker、
  Promise、错误、event callback 和 runtime 生命周期。
- **阶段 4（Keygen 与 Data）**：接入 Keygen、全部 Data CRUD、crypto 流程和 `data.authedChange`，
  验证 SQLite/config/known_hosts 位于应用沙箱预期目录。
- **阶段 5（SSH Terminal）**：接入连接、认证、shell、send、resize、close 和 disconnect，实现有界
  事件队列、Base64 terminal 数据和批量推送。
- **阶段 6（SFTP 与平台能力）**：接入 clipboard/openUrl/app/machine UID/dialog/fs/window 语义，
  文件选择器 URI/FD 或沙箱路径；SFTP 上传下载使用临时文件或 FD，不通过 JSON 搬运文件内容。
- **阶段 7（构建、CI 与发布）**：实现统一 dev/build 命令，声明任务输入输出和 ABI；建立干净 checkout、
  模拟器 Debug、真机 arm64 Release 和离线启动验证。
- **阶段 8（安全、稳定性与性能）**：完成导航/frame/token/CSP/SSL/消息 fuzz、内存/线程/handle 泄漏、
  大输出 terminal/大文件 SFTP/并发 session/长时间前后台测试。

### 待确认问题

1. API 26 是否是正式发布的最低版本，还是需要兼容更早的正式 API。
2. 产品是否只支持 arm64 真机，CI 是否必须覆盖 x86_64 模拟器。
3. API 26 是否存在可限制主 frame/origin 的 Web message API，安全性是否优于 `javaScriptProxy`。
4. `$rawfile` 下动态 import、Worker、字体、SVG 和 React Router 的真实行为。
5. 当前设备版本可用的 `hdc` 端口反向映射能力和命令。
6. HarmonyOS 文件选择器返回 URI、FD 或沙箱路径的形式及持久权限策略。
7. 前后台切换时 SSH、端口转发和下载任务的产品策略。
8. 生物识别加密首版是实现、显式不支持，还是使用 HarmonyOS 安全存储能力。
9. 需要支持的最大 terminal 吞吐量、SFTP 文件大小和并发 session 数。
10. HarmonyOS native module 的最终命名、HAP `libs` 目录和 Hvigor DSL。

### 风险与验证清单

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

只有本阶段的完成标准全部满足后，才能把状态改为 `已完成`。
