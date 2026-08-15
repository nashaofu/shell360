# Android 原生 WebView

Shell360 的 Android 宿主使用仓库现有的 `android/` 原生工程承载 WebView，
通过 `bridge/native` 和 `shell360-ffi` 调用共享 Rust 业务库，不依赖 Tauri
Android 工程。本文是 Android 原生实现的统一说明。

## 目标架构

```text
mobile React -> bridge/native -> Android WebMessage Bridge -> shell360-ffi
                                                        \-> Kotlin 平台能力
shell360-ffi -> shell360-ssh / shell360-store / shell360-keygen
```

Android、桌面和未来的 iOS 共用 Rust 业务库；Android 和 iOS 共用
`bridge/native` 的请求、响应、事件和错误协议。`shell360-ffi` 只负责绑定、
生命周期、调用转换和事件转发，不承载业务逻辑。

## 工程边界

- 直接使用顶层 `android/`，不新建 Android 工程。
- 不修改生成的 `src-tauri/gen/android`；迁移完成后再整体删除旧路径。
- `mobile` 不直接导入 Tauri API 或 `tauri-plugin-*`。
- `shell360-ssh`、`shell360-store`、`shell360-pty` 和 `shell360-keygen` 保持为独立业务库。
- Android/iOS 不启用 PTY；PTY 仅由桌面端适配。
- Bridge 使用 WebMessage 白名单路由，仅接受配置的主文档来源；外部链接使用明确的 scheme allowlist。
- 文件选择通过 Android content URI 的受控 token 适配 Rust，不把平台 URI 暴露给公共业务层。

## 实施状态

| 优先级 | 能力 | 状态 |
| --- | --- | --- |
| P0 | WebView、Bridge、FFI、Keygen | 已完成基础链路 |
| P1 | Data、SSH、终端、SFTP、平台能力 | Data、SSH、终端已完成，其余按需接入 |
| P2 | 端口转发、PTY、旧路径清理与 CI | 后续扩展与工程收尾 |

当前已完成：顶层 Android WebView 宿主、Bridge 白名单路由、UniFFI FFI、Keygen、
共享 SQLite Data、认证状态事件、结构化错误、SSH Session、known_hosts、交互式
Shell 和终端事件。Android APK 支持 `arm64-v8a` 与 `x86_64`。

SFTP、部分 Android 平台能力和端口转发按当前实现状态逐步接入；移动端不提供本地
PTY。真实 SSH 服务器集成、真机 HMR、离线 Release 启动和 instrumentation 测试
需要在目标环境完成。

## 开发与构建

```bash
pnpm run android:dev
pnpm run android:build
```

首次构建需要 Android SDK、Platform-Tools、项目配置版本的 NDK、JDK 以及 Rust
Android targets：

```bash
rustup target add aarch64-linux-android x86_64-linux-android
```

`android:dev` 支持 `--host` 和 `--port`，默认使用本机局域网 IPv4 地址和端口
`1421`。Debug 加载 Rsbuild 开发服务器并支持 HMR，Release 只加载 APK 内置资源。

## 验收标准

- Debug WebView 可通过 `--host` 和 `--port` 加载开发服务器并支持 HMR。
- Release WebView 只加载 APK 内置资源，APK 不链接或初始化 Tauri。
- APK 同时包含 `arm64-v8a` 和 `x86_64` Rust 库。
- Bridge 来源校验、外部导航限制、文件 token 和错误路径均可观测。
- Host、Key、Data、SSH Terminal、SFTP 及导入导出核心流程通过目标环境验收。
- 桌面端现有 Tauri 功能在 Rust 拆库过程中保持兼容。
- 删除 `src-tauri/gen/android` 后 Android Debug/Release 构建仍然成立。
