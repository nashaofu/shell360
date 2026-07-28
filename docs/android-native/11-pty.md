# P2：PTY 独立库与桌面适配

## 目标

将现有 Tauri PTY 插件中的本地终端实现提取为独立 `shell360-pty`，保持桌面使用，
并明确 Android/iOS 不启用 PTY。

## 依赖

- [03-rust-library-boundaries.md](./03-rust-library-boundaries.md)

本方案不阻塞 Android P0/P1，可以与 Android 迁移独立推进。

## shell360-pty 范围

- 打开本地 shell。
- stdin 写入。
- resize。
- close。
- stdout/stderr 数据事件。
- 进程退出事件和退出码。
- Windows、macOS、Linux 平台差异。

## 去除 Tauri 耦合

- `PtyManager` 不依赖 Tauri `State`。
- 数据和退出通知使用 `PtyEventSink`。
- Shell ID 和生命周期由业务库管理。
- Tauri 插件只转换 command 参数和 Channel 事件。
- 平台选择继续使用 Rust `cfg`，不放到 Tauri adapter。

## 移动端策略

- `shell360-ffi` 默认 feature 不包含 PTY。
- Android/iOS 不编译 `shell360-pty`。
- `bridge/native` 对 PTY 返回 `PLATFORM_PTY_UNSUPPORTED`。
- 移动 UI 不展示本地终端入口。

## 测试

- 每个桌面平台的 open/send/resize/close。
- shell 异常退出。
- 重复 close。
- 大输出和 UTF-8 边界。
- Tauri Channel 事件兼容。

## 验收标准

- `shell360-pty` 可独立于 Tauri 编译和测试。
- 桌面本地终端行为不变。
- Android APK 不包含 PTY 依赖或相关 native 代码。
- `tauri-plugin-pty` 只保留 Tauri adapter 职责。
