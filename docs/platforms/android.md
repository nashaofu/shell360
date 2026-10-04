# Android 平台说明

Android 使用顶层 `android/` 工程承载原生 Compose UI。原生界面的视觉与交互以 `mobile/` 的 WebView 页面为基准；`bridge/native` 继续提供运行时与数据能力。

## 代码结构

原生界面按功能分包，不再使用历史上的 `nativeui/` 包名：

- `ui/theme/`：Android 侧的样式令牌，全部由 [`design/tokens.json`](../../design/tokens.json) 派生（见 [设计令牌规范](../design/README.md)）。`Color.kt` 是颜色角色表，`Type.kt` 是 Material 3 字号表，`Tokens.kt` 是圆角/间距/层级/动效，`Theme.kt` 把它们装配成 Material 3 `ColorScheme` + `Typography` + `Shapes`。新增界面只用 `MaterialTheme.colorScheme`、`MaterialTheme.typography`、`MaterialTheme.shapes` 或 `ui/components/` 的封装组件，不要硬编码颜色与字号。
- `ui/components/`：跨页面复用的界面基元，一律基于原生 Material 3 组件（`Buttons.kt` 按钮、`FormFields.kt` 输入框/下拉/分段按钮/标签、`Common.kt` 底部抽屉/空态/搜索栏/过滤 chip/反馈、`Surfaces.kt` 顶栏/卡片/图标块/徽标）。
- `core/data/`：界面模型（`Models.kt`）、页面状态（`Shell360Store.kt`）、持久化设置（`AppPrefs.kt`）与导入导出序列化（`AppDataJson.kt`）。
- `feature/<domain>/`：每个页面一个包，包含 `*Screen.kt`（Compose 界面）、`*Action.kt`（用户动作）、`*UiState.kt`（界面状态）与 `*ViewModel.kt`（状态迁移）。
- `app/navigation/`：`TopLevelDestination`、`Shell360NavHost` 与 `SidebarPanel`；`Shell360Navigation.kt` 提供抽屉外壳、应用锁入口与根路由返回。

样式不再以 `mobile/` 的 WebView 为基准：原生界面走各平台原生观感（Android 为 Material 3），跨平台一致靠同一份 `design/tokens.json` 保证。Material You 动态取色已关闭——它会按设备壁纸生成配色，导致同一款 App 在不同设备与平台上颜色不同。

**例外：会话/连接视图**（`feature/workspace/`、`feature/terminal/`、`feature/sftp/`）按需求完全参考 `mobile/` 的 WebView 实现，逐项对齐结构、文案与交互（顶栏 52dp 三栏、空态 64dp 图标块、会话清单分组与左滑关闭、终端主题/字体/虚拟键盘字节表、SFTP 工具条与表格），但组件与令牌仍用原生的这一套。

## 当前状态

- 页面界面与交互已按 `mobile/` 对齐：Hosts（含完整主机编辑表单与 Save & Connect）、Keys（编辑器与生成器）、Known Hosts、Tunnels、Settings（含真实的 SAF 导入导出与加密口令对话框）、WorkSpace、Terminal、SFTP、Unlock。手机为模态抽屉，`screenWidthDp >= 840` 时为可折叠的常驻侧栏。
- 数据保存在 `Shell360Store` 进程内存中；加密开关、加密口令与主题模式通过 `AppPrefs`（SharedPreferences）持久化，因此开启加密后重启会进入 Unlock 页。
- 把 `Shell360Store` 的读写替换为 `bridge/native` 调用即可接入真实数据层，页面代码无需改动。
- 尚未接入运行时能力：SSH/SFTP 连接、密钥生成、端口转发运行时与会话恢复仍需要后台实现；相关位置在界面上以连接中/失败状态和提示呈现，而不是隐藏入口。
- 上述页面已在 API 35 模拟器（Pixel_10_Pro）上逐页验证可见可操作，包括表单校验、会话创建、虚拟键盘、SFTP 新建/重命名/删除、平板侧栏与加解密锁定流程。
- 样式令牌、圆角与间距应与 `mobile/src/styles/index.less` 及对应组件样式保持一致。
- 带输入框的界面（抽屉、终端、SFTP、Unlock）必须保持 `imePadding()`，否则 Android 上软键盘会盖住底部操作区。

## 工程边界

- 不修改生成的 `src-tauri/gen/android`。
- `mobile` 不直接导入 Tauri API 或 `tauri-plugin-*`。
- Android UI 不通过 WebView 渲染。
- 新增界面基元放入 `ui/components/`，新增领域模型放入 `core/data/`，不要在 `feature/` 包内重复定义跨页面模型。
- JSB 公共规范见 [架构](../architecture/jsb/architecture.md) 和 [协议](../architecture/jsb/protocol.md)。

## 开发与构建

```bash
pnpm run android:dev
pnpm run android:build

# 仅编译与单测（不依赖设备）
cd android
./gradlew :app:compileDebugKotlin :app:testDebugUnitTest :app:assembleDebug
rustup target add aarch64-linux-android x86_64-linux-android
```

需要 Android SDK、NDK、Java 和设备或模拟器。代码检查或 APK 构建成功不等于 SSH/SFTP 与二进制 Channel 已完成真机验证。
