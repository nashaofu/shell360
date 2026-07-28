# Android 原生 WebView 迁移方案

## 目标

Android 使用仓库现有的 `android/` 原生工程承载 WebView，通过
`bridge/native` 和 `shell360-ffi` 调用独立 Rust 业务库，不再依赖 Tauri
Android 工程。桌面端继续使用 Tauri，后续 iOS 可以复用相同的 Bridge 协议、
Rust 业务库和 FFI 层。

## 固定架构

```text
mobile React
    |
    v
bridge/native
    |
    v
Android WebMessage Bridge
    |                         \
    v                          v
shell360-ffi              Kotlin 平台能力
    |                     dialog/fs/app/clipboard
    +-- shell360-ssh
    +-- shell360-data
    +-- shell360-keygen

shell360-pty
    ^
    |
tauri-plugin-pty（桌面）
```

约束：

- 直接使用现有顶层 `android/`，不新建 Android 工程。
- 不改造 `src-tauri/gen/android`，迁移完成后整体删除。
- `shell360-ssh`、`shell360-data`、`shell360-pty` 和
  `shell360-keygen` 是相互独立的业务库。
- `shell360-ffi` 只负责绑定、生命周期、调用转换和事件转发，不承载业务逻辑。
- Android 和未来 iOS 共用 `bridge/native` 的消息协议。
- Android/iOS 不启用 PTY。

## 优先级定义

| 优先级 | 含义 |
| --- | --- |
| P0 | 架构基础和最小可运行链路，后续功能都依赖 |
| P1 | Android 首个可用版本必须具备的核心能力 |
| P2 | 可在核心版本稳定后实现，或只影响桌面重构和工程清理 |

## 阶段与方案文件

| 阶段 | 优先级 | 功能点 | 方案 |
| --- | --- | --- | --- |
| 0 | P0 | Android WebView 宿主与开发环境 | [01-android-webview-host.md](./01-android-webview-host.md) |
| 0 | P0 | Bridge 消息协议和 TypeScript Transport | [02-bridge-protocol.md](./02-bridge-protocol.md) |
| 0 | P0 | Rust 业务库拆分规则 | [03-rust-library-boundaries.md](./03-rust-library-boundaries.md) |
| 0 | P0 | `shell360-ffi` 与 Android 绑定 | [04-shell360-ffi.md](./04-shell360-ffi.md) |
| 0 | P0 | Keygen 最小垂直链路 | [05-keygen-vertical-slice.md](./05-keygen-vertical-slice.md) |
| 1 | P1 | Data、SQLite 和加密 | [06-data.md](./06-data.md) |
| 1 | P1 | SSH Session 和终端 | [07-ssh-terminal.md](./07-ssh-terminal.md) |
| 1 | P1 | SFTP 和 Android 文件中转 | [08-sftp-file-transfer.md](./08-sftp-file-transfer.md) |
| 1 | P1 | Android 平台能力 | [09-android-platform-capabilities.md](./09-android-platform-capabilities.md) |
| 2 | P2 | SSH 端口转发 | [10-port-forwarding.md](./10-port-forwarding.md) |
| 2 | P2 | PTY 独立库与桌面适配 | [11-pty.md](./11-pty.md) |
| 2 | P2 | 旧 Tauri Android 清理与 CI | [12-migration-cleanup.md](./12-migration-cleanup.md) |

## 推荐实施顺序

1. 完成 01、02，建立可加载页面和可观测的 Bridge 通道。
2. 完成 03、04，但只建立最小 FFI 框架。
3. 完成 05，以 keygen 验证 WebView 到 Rust 的完整链路。
4. 并行推进 06 和 07。
5. 在 SSH 基础稳定后完成 08 和 09。
6. 完成 Android 核心流程验收后推进 10、11、12。

## 总体验收

- Debug WebView 通过 `adb reverse` 加载 Rsbuild 开发服务器并支持 HMR。
- Release WebView 只加载 APK 内置资源。
- `mobile` 不直接导入 Tauri API 或 `tauri-plugin-*`。
- Android APK 不链接或初始化 Tauri。
- Host、Key、SSH Terminal、SFTP 和导入导出核心流程可用。
- 桌面端现有 Tauri 功能在 Rust 拆库过程中保持兼容。
- 删除 `src-tauri/gen/android` 后 Android Debug/Release 构建仍然成立。
