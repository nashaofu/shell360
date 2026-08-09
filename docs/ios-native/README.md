# iOS 原生 WebView 与 UniFFI 迁移方案

## 文档目的

本文是顶层 `ios/` 工程的分阶段实施文档。目标是将当前 SwiftUI 示例 App 改造成
Shell360 的独立 iOS WebView 宿主，通过与 Android 共用的 `bridge/native` 协议调用
Swift 平台能力和 `shell360-ffi`，最终进入 Rust Core。

本文只定义方案、边界、实施顺序和验收标准，不代表对应功能已经完成。每一阶段均应在
验收通过后更新“实施状态”，再开始依赖它的后续阶段。

## 实施状态

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

状态只使用：`未开始`、`进行中`、`已完成`、`阻塞`。

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

## 固定架构约束

- 使用顶层 `ios/shell360.xcodeproj`，不改造 `src-tauri/gen/apple`。
- 保留 SwiftUI App Lifecycle，使用 `UIViewRepresentable` 承载 `WKWebView`。
- React 负责全部业务 UI；Swift 只负责 WebView、Bridge、生命周期和系统能力。
- iOS 与 Android 共用 `bridge/native` 的请求、响应、事件和错误协议。
- `shell360-ffi` 只负责 FFI、运行时生命周期、JSON 转换和事件转发。
- 业务逻辑继续位于 `shell360-store`、`shell360-keygen` 和 `shell360-ssh`。
- iOS 不提供本地 PTY，相关能力显式返回 `BRIDGE_UNSUPPORTED`。
- Release 只加载 App Bundle 中的 Web 资源，不加载远程页面。
- 不允许 Web 直接访问任意绝对文件路径。
- Rust 同步 FFI 调用不得阻塞 WebKit 主线程。

## 当前基线

### iOS

- `ios/` 只有一个 `shell360` Target 和同名 Scheme。
- 入口为 `shell360App.swift`，UI 为 SwiftUI `ContentView` 示例页面。
- Framework、Resources、Sources Build Phase 存在，但没有自定义构建脚本。
- 没有 Swift Package、CocoaPods、Framework 或 XCFramework 依赖。
- 没有 UniFFI Swift 源码、C header 或 modulemap。
- Debug/Release 均使用自动签名，Bundle ID 为 `com.nashaofu.shell360`。
- 当前 Deployment Target 为 iOS 26.5，实施前需要确认产品最低系统版本。

### Web 与 Bridge

- `mobile/src/index.tsx` 已在检测到 `window.shell360Native` 时安装 Native Backend。
- `bridge/src/native.ts` 已实现请求 ID、client ID、超时、Promise 和事件订阅。
- Android 已实现相同协议的 WebViewBridge、BridgeRouter 和 RustBridge，可作为 iOS
  行为基线。

### Rust 与 UniFFI

- `shell360-ffi` 已导出 `Shell360Runtime` 和 `FfiEventSink`。
- 已支持 keygen、data、SSH、SFTP、端口转发和 client 资源释放。
- `uniffi.toml` 当前只有 Kotlin 配置。
- crate 已生成 `staticlib`、`cdylib` 和 `rlib`，但尚无 Apple XCFramework 流程。

## Bridge v1 协议

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

协议约束：

- `id`、`clientId` 和 `method` 必须是非空字符串。
- 无参数请求使用 `null`，不省略 `params`。
- Swift 仅路由白名单中的完整方法名，禁止动态 selector 或反射调用。
- 控制消息限制为 1 MiB；大文件不得整体通过 JS Bridge 传输。
- SSH 终端二进制数据继续使用 Base64，与 Android 保持一致。
- 未知方法返回 `BRIDGE_UNSUPPORTED`。
- Swift 不向 Web 返回调用栈、密码、私钥或不必要的本地绝对路径。

## 建议目录结构

```text
ios/
├── Config/
│   ├── Debug.xcconfig
│   └── Release.xcconfig
├── Generated/
│   └── README.md
├── Scripts/
│   └── （由仓库根目录 Node.js CLI 统一执行）
├── shell360/
│   ├── App/
│   │   ├── shell360App.swift
│   │   ├── AppContainerView.swift
│   │   └── AppRuntime.swift
│   ├── WebView/
│   │   ├── WebViewContainer.swift
│   │   ├── WebViewCoordinator.swift
│   │   ├── WebViewConfigurationFactory.swift
│   │   └── WebContentLoader.swift
│   ├── Bridge/
│   │   ├── BridgeMessage.swift
│   │   ├── BridgeError.swift
│   │   ├── BridgeRouter.swift
│   │   └── JavaScriptBridge.swift
│   ├── Rust/
│   │   ├── RustBridge.swift
│   │   └── RustEventSink.swift
│   ├── Platform/
│   │   ├── AppService.swift
│   │   ├── ClipboardService.swift
│   │   ├── ExternalURLService.swift
│   │   ├── FileService.swift
│   │   └── MachineUIDService.swift
│   ├── WebAssets/
│   └── Rust/
└── shell360.xcodeproj/
```

`Generated` 和 `WebAssets` 应由构建生成；是否提交空目录说明文件由实施阶段决定，不能
手工维护生成的 binding、Rust 静态库或 `mobile/dist` 副本。

---

## 阶段 0：协议与工程边界

### 目标

在修改运行代码前冻结 iOS 首版范围，避免 iOS 与 Android 产生两套 Bridge。

### 任务

- 将本文 Bridge v1 作为 iOS 实现基线。
- 对照 Android `BridgeRouter` 生成 iOS 方法能力矩阵。
- 确认 iOS 最低系统版本、支持设备和横竖屏范围。
- 确认一个 App 是否只允许一个活跃 WebView/Scene。
- 明确后台 SSH、端口转发和下载任务的产品策略。
- 明确生物识别方法在首版实现还是返回不支持。
- 决定 `window.close` 在 iOS 中的语义，不能尝试主动终止 App。

### 能力矩阵基线

| 域 | iOS 首版策略 |
| --- | --- |
| `bridge.*` | Swift 实现 |
| `keygen.*` | 转发 Rust |
| `data.*` | 转发 Rust |
| `ssh.*` | 转发 Rust，文件中转除外 |
| `app.*` | Swift 实现 |
| `machineUid.*` | Swift 实现 |
| `core.openUrl` | Swift 实现，scheme 白名单 |
| `dialog.*` | Swift 实现 |
| `fs.*` | Swift 实现，受控路径 |
| `clipboard.*` | Swift 实现 |
| `window.close` | 定义移动端安全语义 |
| `pty.*` | 不支持 |
| `updater.*` | 不支持 |
| `process.relaunch` | 不支持 |

### 验收

- 方法矩阵中每个 `bridge/native` 调用都有明确的实现方或不支持结果。
- iOS 没有新增平台专属协议格式。
- 最低系统版本和多 Scene 策略已有书面结论。

### 回滚边界

本阶段只更新文档和工程决策，不修改运行时行为。

---

## 阶段 1：WKWebView 宿主

### 目标

用现有 `mobile` React 页面替换 SwiftUI 示例 UI，暂不接入 Rust。

### 页面加载策略

| 构建 | 页面来源 | 说明 |
| --- | --- | --- |
| Debug | 可配置开发服务器 | 模拟器默认 `http://127.0.0.1:1421` |
| Release | App Bundle `WebAssets/index.html` | 必须离线工作 |

Release 推荐 `loadFileURL(_:allowingReadAccessTo:)`，读取权限只覆盖 WebAssets 根目录。
如果实际验证发现 `file://` 对必要 Web API 或模块加载有不可接受的限制，再单独评估
`WKURLSchemeHandler`；首版不引入本地 HTTP Server。

### 任务

- 保留 `shell360App` 和 `WindowGroup`。
- 使用 `UIViewRepresentable` 包装单实例 `WKWebView`。
- 使用 `@StateObject` 或等效 owner 保证 SwiftUI 重绘不重建 WebView。
- 增加加载中、加载失败和 Bridge 初始化失败页面。
- Debug 开启 `isInspectable`，Release 关闭。
- Release 禁止任意远程导航和 mixed content。
- 外部 HTTP/HTTPS、mailto、tel 导航交给系统。
- 验证键盘、安全区、旋转、返回导航和 iPad 布局。
- 调整 Rsbuild 资源路径，使 Bundle 中的 JS、CSS、图片可相对加载。
- 确定 React Router 的刷新策略，优先使用无需 server rewrite 的路由方式。

### 建议配置

```text
Debug.xcconfig:
  SHELL360_WEBVIEW_MODE=development
  SHELL360_WEBVIEW_URL=http://127.0.0.1:1421

Release.xcconfig:
  SHELL360_WEBVIEW_MODE=bundle
```

Release 代码必须忽略外部传入的开发 URL。

### 验证

- Debug 页面可以从开发服务器加载并刷新。
- Release 模拟构建在断网条件下可加载内置页面。
- SwiftUI 状态更新不会导致页面重载。
- 未受信导航不会继续拥有 Native Bridge。
- Web 内容加载失败时显示可诊断错误而不是空白页。

### 完成条件

- iOS App 中不再显示 SwiftUI 示例 UI。
- React 页面能稳定运行，但 Native 调用可以暂时返回明确的 Bridge 未就绪错误。

---

## 阶段 2：UniFFI Swift 与平台静态库

### 目标

从 `shell360-ffi` 可重复生成 Swift binding，以及当前 Xcode 平台所需的 Rust 静态库。

### Rust Targets

```text
aarch64-apple-ios
aarch64-apple-ios-sim
x86_64-apple-ios
```

### 预期产物

```text
ios/shell360/Generated/shell360_ffi.swift
ios/shell360/Generated/shell360_ffiFFI.h
ios/shell360/Generated/module.modulemap
ios/Generated/Rust/<Configuration>/iphoneos/libshell360_ffi.a
ios/Generated/Rust/<Configuration>/iphonesimulator/libshell360_ffi.a
```

### 任务

- 在 `uniffi.toml` 增加 Swift binding 配置。
- 使用仓库锁定的 UniFFI 版本生成 binding，不依赖全局安装的不同版本。
- 根据 Xcode 的 `PLATFORM_NAME` 和 `ARCHS` 构建当前平台需要的 Rust target。
- simulator 同时请求 arm64 和 x86_64 时使用 `lipo` 合并；device 与 simulator 始终分开。
- 将 Swift binding、header 和 modulemap 作为一个稳定 module 暴露给 App。
- 把生成任务做成有明确 inputs/outputs 的可增量脚本。
- 使用 Xcode `LIBRARY_SEARCH_PATHS` 链接当前配置和平台的静态库。
- 根据实际链接符号补充 Apple 系统 Framework，不预先盲目添加。

### 集成选择

首版使用仓库内脚本生成并由 Xcode 本地引用，不引入 CocoaPods。静态库仅供当前 App
使用，不额外生成用于二进制分发的 XCFramework。

### 构建注意事项

- Xcode 当前启用 User Script Sandboxing，Run Script 必须声明仓库输入与生成输出。
- Debug 可以按 Cargo 源文件和 `Cargo.lock` 增量生成。
- Release/Archive 必须验证产物来自当前源码。
- 生成目录不能依赖某位开发者的绝对路径。
- 需要验证 Rust panic 策略、符号文件和真机架构。

### 验证

- Swift 可以导入生成 module。
- 模拟器 arm64、模拟器 x86_64 和真机 arm64 均能链接。
- 干净 checkout 可以只通过仓库命令重建全部产物。
- 修改 FFI 导出后 binding 会重新生成，不会静默使用旧 ABI。

### 完成条件

- Xcode 中可以构造 `Shell360Runtime` 类型。
- App 暂时不需要把 Rust 调用暴露给 Web。

---

## 阶段 3：最小 Web → Rust 垂直链路

### 目标

打通以下完整回路：

```text
React bridge.health
    → WKScriptMessageHandler
    → Swift BridgeRouter
    → Swift RustBridge
    → UniFFI Shell360Runtime.healthCheck
    → Swift
    → JavaScript Promise
```

并验证 Rust `FfiEventSink` 可以反向推送事件到当前 Web client。

### Swift 组件职责

| 组件 | 职责 |
| --- | --- |
| `JavaScriptBridge` | 注册消息 handler、注入 adapter、收发 JSON |
| `BridgeMessage` | 严格解析请求、响应和事件模型 |
| `BridgeRouter` | 白名单路由和错误归一化 |
| `RustBridge` | UniFFI 参数、结果、线程和错误适配 |
| `RustEventSink` | 接收 Rust 任意线程回调并切回 MainActor |

### JS Adapter

在 document start 注入 `window.shell360Native`，将：

```text
window.shell360Native.postMessage(message)
```

映射到：

```text
window.webkit.messageHandlers.shell360Native.postMessage(message)
```

Swift 回传时调用固定接收入口，最终触发：

```text
window.shell360Native.onmessage({ data: responseJson })
```

不得通过字符串拼接把未转义 JSON 插入 JavaScript。

### Runtime 生命周期

- App Runtime 创建一次 `Shell360Runtime`。
- app data 使用 `Application Support/shell360`。
- cache 使用 `Library/Caches/shell360`。
- 首次初始化前创建目录。
- Web 页面产生独立 `clientId`。
- 页面 `pagehide` 或 WebView 销毁时调用 `bridge.releaseClient`。
- App Runtime 真正释放时调用 `shutdown`。

### 线程模型

UniFFI 当前导出为同步 Swift API，Rust 内部会 `block_on` Tokio。所有可能阻塞的调用在专用
后台 executor 上执行，响应与 WebKit 操作切回 MainActor。Rust 事件回调也不得直接调用
WebKit。

### 验证

- `bridge.health` 成功返回 `ok`。
- 不存在的方法返回结构化 `BRIDGE_UNSUPPORTED`。
- 非法 JSON、缺失字段、超大消息得到结构化错误。
- Rust health event 能到达正确 client。
- WebView reload 后旧 client 资源会释放。
- 主线程在模拟慢 FFI 调用时仍可响应 UI。

### 完成条件

- 最小链路和事件链路均有自动化测试或可重复验证步骤。

---

## 阶段 4：Keygen、Data 与错误模型

### 目标

接入不依赖复杂系统 UI 的核心业务，验证数据库、加密、持久化和错误映射。

### 范围

- `keygen.generate`
- 全部现有 `data.*` 方法
- `data.authedChange` 事件
- Rust `FfiError` 到 Bridge Error 的映射

### 任务

- 将 Swift JSON 值稳定序列化为 Rust 所需的 `paramsJson`。
- 将 Rust 返回 JSON 解析为 Bridge `result`，避免双重 JSON 字符串。
- 对齐 Android 的 Data、InvalidRequest 和未知错误映射。
- 验证数据库、config、known_hosts 等文件位于 App 沙箱的预期目录。
- 验证升级、重装、App 重启后的数据行为。
- 评估 iCloud/iTunes backup 排除规则，敏感缓存不得备份。
- 生物识别未落地前明确返回不支持，不能伪造成功结果。

### 验证

- Keygen 各算法成功，错误不暴露私钥或 passphrase。
- Host、Key、PortForwarding CRUD 与 Android/桌面数据结构一致。
- 密码初始化、解锁、变更、重置流程可重复执行。
- `data.authedChange` 只通知当前有效 WebView。
- App 重启后数据持久化符合预期。

### 完成条件

- 非 SSH 的核心数据页面在 iOS 可用。
- Rust 与 Swift 错误有稳定、可测试的映射。

---

## 阶段 5：SSH Terminal

### 目标

实现 SSH Session、认证和交互式 Shell，验证高频双向消息与生命周期管理。

### 范围

- `ssh.session.*`
- `ssh.shell.*`
- known_hosts 和服务器指纹校验
- 密码、公钥、证书、keyboard-interactive 等现有认证方式
- disconnect、data、eof、close 事件

### 任务

- 保持 Android 相同的 session ID、shell ID 和 client ID 关系。
- Terminal 输入和输出继续使用 Base64，避免 Unicode/二进制损坏。
- 高频 `shell.send` 和 `shell.resize` 不经过主线程阻塞队列。
- 保持事件 sequence，不在 Swift 中任意重排同一目标的事件。
- WebView reload、Scene 关闭和 App Runtime 释放时清理 SSH 资源。
- 定义进入后台后的连接策略和用户提示。
- 验证蜂窝、Wi-Fi、IPv6-only、网络切换和锁屏恢复。

### 验证

- 密码和密钥认证可连接真实测试服务器。
- 终端中 UTF-8、ANSI、粘贴、大量输出和 resize 正常。
- 跳板连接与 known_hosts 行为和 Android 一致。
- 页面重载不会遗留孤立连接。
- 网络断开会收到一次可诊断 disconnect 事件。
- 主线程和 WebView 在持续终端输出下保持可响应。

### 完成条件

- SSH Terminal 主流程可在真机稳定运行。
- 生命周期与错误恢复场景通过验证。

---

## 阶段 6：SFTP 与 iOS 平台能力

### 目标

补齐首版移动 App 所需的文件中转和系统能力。

### SFTP 文件模型

Web 不能把任意本地绝对路径交给 Rust。上传和下载使用以下流程：

```text
上传:
UIDocumentPicker → security-scoped URL → App cache 临时文件 → Rust SFTP

下载:
Rust SFTP → App cache 临时文件 → UIDocumentPicker/export → 用户目标
```

操作完成、取消或失败后必须清理临时文件并结束 security-scoped access。

### 平台能力

| 方法 | iOS 实现 |
| --- | --- |
| `app.getVersion` | Bundle metadata |
| `app.setSystemBarsAppearance` | SwiftUI/UIKit 外观适配 |
| `machineUid.getMachineUid` | 随机 UUID，优先 Keychain |
| `core.openUrl` | `UIApplication.open` + scheme allowlist |
| `clipboard.readText` | `UIPasteboard` |
| `clipboard.writeText` | `UIPasteboard` |
| `dialog.open` | `UIDocumentPickerViewController` |
| `dialog.save` | Document picker/export flow |
| `fs.readTextFile` | App data 相对路径或受控 token |
| `fs.writeTextFile` | App data 相对路径或受控 token |

### 文件安全

- App Data 路径必须标准化并限制在 `Application Support/shell360` 下。
- 拒绝 `..`、符号链接越界和非授权 scheme。
- security-scoped URL 只在实际 IO 窗口内持有。
- 临时文件名使用随机 ID，不使用远端路径直接拼接。
- 大文件不经过 JSON/Base64 Bridge。
- 文件 picker 同一时间只允许一个，冲突返回 `BRIDGE_BUSY`。

### 验证

- 从 Files/iCloud Drive 导入并上传文件。
- 下载文件并保存到用户选择位置。
- 取消 picker 不会留下挂起 Promise 或临时文件。
- App data 路径穿越测试全部被拒绝。
- 外部 URL 只允许规定 scheme。
- 剪贴板权限和隐私提示行为符合目标 iOS 版本。

### 完成条件

- SFTP 浏览、上传、下载和导入导出核心流程可用。
- 平台能力与 `bridge/native` capability 声明一致。

---

## 阶段 7：构建、CI 与发布

### 目标

从干净 checkout 使用统一命令构建 Debug App 和 Release Archive/IPA。

### 建议命令

```text
pnpm run ios:dev

# 签名归档并导出 IPA
IOS_CERTIFICATE=<p12-base64> \
IOS_CERTIFICATE_PASSWORD=<p12-password> \
IOS_MOBILE_PROVISION=<mobileprovision-base64> \
pnpm dotenvx pnpm run ios:build
```

### Debug 流程

```text
检查工具链
    → 启动 mobile dev server
    → 生成 Swift binding
    → 构建当前模拟器架构的 Debug Rust 静态库
    → xcodebuild Debug
    → 启动模拟器或提示真机开发 URL
```

### Release 流程

```text
pnpm --filter mobile run build
    → 同步 mobile/dist 到生成 WebAssets
    → 生成 Swift binding
    → 构建当前平台的 Release Rust 静态库
    → xcodebuild archive
    → exportArchive
```

### 任务

- iOS 构建、资源同步和 UniFFI 生成全部由 Node.js 执行，不依赖 zsh 辅助脚本。
- Xcode 共享 Scheme 的 Build Pre-action 会在 Release 构建计划创建前通过 `pnpm run ios:web-assets` 生成 WebAssets，Target Build Phase 再通过 `pnpm run ios:build-native` 生成 UniFFI binding 和当前平台静态库；因此命令行和直接点击 Xcode Build 都能使用最新产物。
- iOS 命令由 `scripts/ios/index.ts` 提供，和 Android 一样通过 Node.js 统一编排。
- `pnpm run ios:dev --device <模拟器名称或 UDID>` 可指定模拟器；未指定时交互选择。
- `pnpm run ios:build` 创建签名的 Release device archive，并使用 `app-store-connect` 导出 `ios/build/shell360.ipa`；任一签名变量为空时立即失败。
- 签名流程使用独立的临时 Keychain 和最小文件权限，并在构建结束后恢复 Keychain 搜索列表、删除临时描述文件；描述文件会在归档前校验有效期和 Bundle ID。
- `ios:dev` 从 Xcode Build Settings 读取实际 `.app` 产物路径，不依赖 DerivedData 的内部目录结构；CI 从 `ios/build` 收集 `.xcarchive` 和 `.ipa`。
- `ios:dev` 和 `ios:build` 只负责调用 Xcode；UniFFI 由 Target Build Phase 生成，Release WebAssets 由共享 Scheme 的 Build Pre-action 生成。
- 不固定不存在的 Xcode App 路径；使用明确、可覆盖的 Developer Directory。
- 从统一版本源生成 Marketing Version 和 Build Number。
- 使用 input/output file list 避免每次 Xcode 编译重建全部 Rust。
- Release 强制校验 WebAssets、binding 和 Rust 静态库均来自当前源码。
- 归档 dSYM、Rust 符号信息和必要的原生崩溃分析产物。
- CI 缓存 pnpm、Cargo 和可安全复用的构建缓存，不缓存签名密钥。
- 增加模拟器构建、真机 archive 和无网络 Release 启动验证。

### CI 建议

```text
frontend-check:
  pnpm run tsc
  pnpm run check

rust-check:
  cargo fmt --check
  cargo clippy --all-targets -- -D warnings
  cargo test

ios-bindings:
  生成 UniFFI Swift binding
  校验生成结果

ios-simulator:
  构建 simulator arm64/x86_64 静态库
  xcodebuild Debug

ios-archive:
  构建 mobile Release
  构建 device arm64 静态库
  xcodebuild archive
```

### Release 门禁

- Release 不包含开发服务器 URL。
- Release WebView 不可检查。
- App 断网可进入本地 UI。
- device 构建只链接 `aarch64-apple-ios` 静态库。
- 未签名或签名变量缺失时给出明确错误。
- IPA 不依赖 `src-tauri/gen/apple`。

### 完成条件

- 一条仓库命令可生成可安装的 Debug App。
- 一条仓库命令可生成可发布的 Archive/IPA。
- CI 可以从干净 checkout 重现产物。

---

## 阶段 8：安全、测试与清理

### 目标

在核心流程稳定后完成生产加固，并清理重复的旧 iOS 构建路径。

### WebView 安全清单

- 只接受主 frame 消息。
- 只允许受信 Bundle 页面或 Debug 白名单 origin 注册 Bridge。
- 页面离开白名单后立即失去 Bridge 能力。
- Release 禁止任意 Remote URL、mixed content 和 Web Inspector。
- 导航和新窗口请求经过统一 allowlist。
- 禁止通过 Bridge 动态调用任意 Swift API。
- 响应注入不使用未转义字符串拼接。
- Bridge 有请求大小、超时和并发上限。

### 数据与隐私清单

- 密码、私钥和数据库明文不得进入日志。
- machine UID 不使用 IDFA。
- Keychain access group 和数据可迁移性有明确策略。
- App Switcher 快照按产品要求遮挡敏感终端内容。
- 缓存、临时下载和崩溃日志不进入备份。
- 生物识别通过 LocalAuthentication/Keychain 正确实现后再声明 capability。

### 测试分层

```text
TypeScript:
  NativeTransport 协议、超时、事件和 dispose

Swift Unit:
  BridgeRequest 解析、Router、错误映射、路径约束

Rust:
  shell360-ffi 和业务 crate 测试

iOS Integration:
  WKWebView 请求/响应/事件、reload 和恶意导航

Real Device:
  SSH、SFTP、Keychain、文件 picker、前后台和网络切换
```

### 清理范围

独立 iOS 流程验收完成后再决定删除：

```text
src-tauri/gen/apple/
src-tauri/tauri.ios.conf.json
旧 Tauri iOS 构建脚本和 CI 分支
```

桌面 Tauri 工程必须保留。删除前创建可定位的 Git commit/tag，回滚通过 Git 恢复完整旧
路径，不在新 iOS App 中保留两套运行时开关。

### 完成条件

- 安全清单和测试矩阵全部有结果记录。
- 删除旧路径后 iOS Debug/Release 仍可构建。
- Android、iOS 共用 Bridge 和 Rust Core，桌面 Tauri 不受影响。

---

## 总体验收标准

- iOS 启动后所有业务 UI 由 `mobile` React 提供。
- Release 在无网络环境中可启动和进入本地页面。
- `bridge/native` 同时服务 Android 和 iOS，不存在 iOS 私有业务协议。
- Swift 只处理 WebView、Bridge、生命周期和系统能力。
- Keygen、Data、SSH、SFTP 和端口转发进入现有 Rust Core。
- WebView reload 或 Scene 销毁后旧 client 的 Rust 资源被释放。
- Bridge 不接受非主 frame、非白名单页面和未知方法调用。
- 模拟器 arm64/x86_64 与真机 arm64 均能链接。
- 干净 checkout 可以生成 WebAssets、Swift binding、平台静态库和 App。
- Archive/IPA 不依赖 Tauri 生成的 Apple 工程。
- Android 和桌面现有功能在迁移过程中保持兼容。

## 每阶段交付模板

完成一个阶段时，在对应 PR 或任务中记录：

```text
阶段：
状态：

已完成：
-

未完成/延期：
-

验证命令：
-

真机/模拟器验证：
-

已知风险：
-

文档更新：
-
```

只有“完成条件”全部满足后，才能将阶段状态改为 `已完成`。
