# Android 平台说明

Android 使用顶层 `android/` 工程承载原生 Compose UI。原生页面位于 `android/app/src/main/java/com/nashaofu/shell360/nativeui/`，视觉令牌和交互以 `mobile/` 的 WebView 页面为基准；`bridge/native` 继续提供运行时与数据能力。

## 工程边界

- 不修改生成的 `src-tauri/gen/android`。
- `mobile` 不直接导入 Tauri API 或 `tauri-plugin-*`。
- Android UI 不通过 WebView 渲染；Hosts、Keys、Known Hosts、Port Forwardings、Settings、Terminal 和 SFTP 页面由 Compose 原生实现。
- 原生 UI 的颜色、字号、圆角、间距和 safe-area 行为应与 `mobile/src/styles/index.less` 及对应组件样式保持一致。
- JSB 公共规范见 [架构](../architecture/jsb/architecture.md) 和 [协议](../architecture/jsb/protocol.md)。

## 开发与构建

```bash
pnpm run android:dev
pnpm run android:build
rustup target add aarch64-linux-android x86_64-linux-android
```

需要 Android SDK、NDK、Java 和设备或模拟器。代码检查或 APK 构建成功不等于 SSH/SFTP 与二进制 Channel 已完成真机验证。
