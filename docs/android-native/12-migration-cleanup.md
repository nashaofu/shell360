# P2：迁移清理与 CI

## 目标

在原生 Android 核心功能验收通过后，删除旧 Tauri Android 工程和配置，建立独立、
可重复的 Android 构建与发布流程。

## 依赖

- P0、P1 全部方案验收通过。
- P2 端口转发是否阻塞清理，由首个 Android 发布范围决定。
- [11-pty.md](./11-pty.md) 不阻塞 Android 清理。

## 废弃范围

整体删除，不做原地改造：

```text
src-tauri/gen/android/
src-tauri/tauri.android.conf.json
```

如果 Tauri iOS 暂时保留：

- `src-tauri/capabilities/mobile.json` 移除 Android platform。
- 保留 iOS 所需配置。

`src-tauri` 继续作为桌面 Tauri 工程，不能因为 Android 清理删除桌面依赖。

## 脚本调整

- `scripts/android.sh` 和 `scripts/android.ps1` 改为调用顶层 `android/gradlew`。
- 增加统一开发脚本：启动 Rsbuild、执行 `adb reverse`、安装并启动 Debug APK。
- Android Release 先构建 `mobile` 和 Rust FFI，再执行 Gradle bundle。
- 移除 Android 对 Tauri CLI 的调用。

## CI 阶段

建议拆分：

```text
frontend-check:
  pnpm run tsc
  pnpm run check

rust-check:
  cargo fmt --check
  各业务 crate cargo clippy/test

android-debug:
  构建 mobile
  cargo-ndk 构建 shell360-ffi
  ./android/gradlew assembleDebug

android-release:
  ./android/gradlew bundleRelease
```

Release CI 应缓存 Cargo、Gradle 和 pnpm，但不能缓存或提交签名密钥。

## 文档调整

- 更新 `AGENTS.md` 项目结构和 Android 命令。
- 更新 README 的 Android 构建方式。
- 明确 `src-tauri/gen/android` 不再生成或维护。
- 记录 Rust target、NDK、JDK 和 Android SDK 版本。
- 删除失效的 Tauri Android capability 和脚本说明。

## 发布检查

- ABI 覆盖和包体大小。
- Release WebView 不连接开发服务器。
- Release 禁止 cleartext 和 WebView debugging。
- ProGuard/R8 不删除 UniFFI binding。
- native crash 符号文件归档。
- 数据备份规则不包含敏感数据和 staging 文件。
- 签名、versionCode 和 versionName 来自统一发布配置。

## 回滚策略

删除旧工程前保留一个可定位的 Git commit/tag。回滚通过 Git 恢复完整旧工程，不在新
Android 工程中保留两套运行时开关。

## 验收标准

- 删除旧 Tauri Android 目录后 Android Debug/Release 均可构建。
- Android APK/AAB 不包含 Tauri runtime。
- Android 开发、测试和发布命令不调用 Tauri CLI。
- 桌面 Tauri 和暂时保留的 iOS 构建不受影响。
- CI 可以从干净 checkout 生成 APK/AAB。
