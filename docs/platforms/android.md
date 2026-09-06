# Android 平台说明

Android 使用顶层 `android/` 工程承载 WebView，业务 UI 位于 `mobile/`，平台能力通过 `bridge/native` 提供。

## 工程边界

- 不修改生成的 `src-tauri/gen/android`。
- `mobile` 不直接导入 Tauri API 或 `tauri-plugin-*`。
- JSB 公共规范见 [架构](../architecture/jsb/architecture.md) 和 [协议](../architecture/jsb/protocol.md)。

## 开发与构建

```bash
pnpm run android:dev
pnpm run android:build
rustup target add aarch64-linux-android x86_64-linux-android
```

需要 Android SDK、NDK、Java 和设备或模拟器。代码检查或 APK 构建成功不等于 SSH/SFTP 与二进制 Channel 已完成真机验证。
