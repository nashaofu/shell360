# Shell360 设计令牌（跨平台单一来源）

[`design/tokens.json`](../../design/tokens.json) 是 Android / iOS / HarmonyOS 原生界面**唯一**的样式来源。任何颜色、字号、圆角、间距、动效都必须由它派生，不允许在某个平台里单独硬编码数值。

## 为什么不是"跟 mobile/ WebView 一致"

移动端正在从 WebView 迁移到原生实现。原生界面应当使用各平台的原生观感（Android 用 Material 3），所以样式**不再以 `mobile/` 的 CSS 为准**。跨平台一致指的是**同一套品牌令牌和同一套语义角色**，而不是像素级复制 WebView 的样式。

## 为什么关闭 Material You 动态取色

Android 12+ 的动态取色会按设备壁纸生成配色，同一款 App 在不同设备上颜色都不同，与"各平台样式一致"直接冲突。因此 `Shell360Theme` 固定使用本文件的品牌色；`dynamicColor` 参数已移除。

## 颜色：Material 3 语义角色

颜色用 Material 3 的角色名命名，这是三端都能对应上的最小公共语义集。

| M3 角色 | SwiftUI 对应 | ArkUI 对应 |
| --- | --- | --- |
| `primary` / `onPrimary` | `.tint` / 主色上的前景 | 主题色 / `font_on_primary` |
| `primaryContainer` / `onPrimaryContainer` | 主色的浅色容器 | 主题容器色 |
| `secondary` / `tertiary` | 次要、强调语义色 | 次要、强调色 |
| `error` / `errorContainer` | `.red` / 错误容器 | 警告色 |
| `background` / `onBackground` | `.systemBackground` / `.label` | 页面背景 / 文本主色 |
| `surface` / `onSurface` | `.systemBackground` / `.label` | 卡片背景 / 文本主色 |
| `surfaceVariant` / `onSurfaceVariant` | `.secondarySystemBackground` / `.secondaryLabel` | 次级背景 / 文本次色 |
| `surfaceContainer*` | 分层背景（Lowest→Highest 由浅到深） | 分层容器色 |
| `outline` / `outlineVariant` | `.separator` / 分隔线 | 描边 / 分割线 |
| `inverseSurface` / `inverseOnSurface` | 反色容器（Snackbar、Tooltip） | 反色提示 |
| `scrim` | 模态遮罩 | 模态遮罩 |

除 M3 标准角色外，本文件额外定义了 `success` / `warning` / `info` 三组状态色（各含 `on*` 与 `*Container`），用于连接状态、提示等场景。状态色**必须**与文字或图标同时出现，不允许只靠颜色表达状态。

## 排版、形状、间距

- `typography`：Material 3 基线字号表（`display*` / `headline*` / `title*` / `body*` / `label*`），含 size / lineHeight / letterSpacing / weight。其他平台用同数值，字体族用各平台系统字体。
- `shape`：`extraSmall 4` / `small 8` / `medium 12` / `large 16` / `extraLarge 28`。按钮使用 12dp 中圆角，字段使用 12dp 圆角，卡片使用 16dp 圆角；避免把所有控件做成胶囊或卡片。
- `spacing`：4 的倍数（4/8/12/16/24/32），所有内外边距都从这里取值。
- `size`：交互控件与图标的唯一尺寸来源，见下方「控件尺寸规则」。
- `contentMaxWidth` / `compactFormMaxWidth` / `wideScreenBreakpoint`：限制宽屏内容行宽、表单宽度，并统一决定何时显示常驻侧栏。
- SFTP 表格列宽、行高、图标槽、状态栏和搜索框宽度也使用 `sftp*` 尺寸令牌，避免表头与文件行各自漂移。
- `motion`、`elevation`：动效时长与层级阴影强度。

## 连接视图（Workspace / Terminal / SFTP）

这三个界面保留终端工具需要的信息层级和原有交互；使用本文件的令牌与 Material 3 组件，不要求像素级复制 `mobile/` 的 WebView 样式。终端内容继续使用主机独立的终端主题，连接状态与应用状态使用语义颜色。

- Workspace：`feature/workspace/` —— 52dp 三栏顶栏（44 / 1fr / 44）、会话名 15/600 + 14dp 下拉箭头 + `Terminal · Connecting|Failed|Connected` / `SFTP · <简化路径>` 副标题、64dp 圆角 16 空态图标块、会话清单 sheet（大写分组标签 + 8dp 状态点 + 88dp 左滑关闭）。文案规则在 `SessionText.kt`，会话命名与计数规则对齐 `packages/shared/src/atoms/session.atom.ts`。
- Terminal：`feature/terminal/` —— 6 套终端主题（`TerminalTheme.kt`，含完整 16 色调色板与 cursor/selection，**每主机独立、不随应用明暗**）、CSS 字体族解析（`TerminalFont.kt`）、虚拟键盘 4 套布局与全部字节序列（`KeyboardLayouts.kt`：Ctrl/Shift/Alt 可独立切换、DECCKM 应用模式、修饰键 CSI 形式）。终端网格从内容区左上角 0,0 起排，**不给终端加 padding**。
  - 三态浮层（`SshLoadingMask.kt`，终端与 SFTP 共用）：**无遮罩**的全区域不透明面板，`maskIcon`(42) 主机块 + 主机名 + `ssh …` 命令 + `progressThickness`(6) 进度条；只有失败态才追加错误区（红框消息盒 + 动作）。**连接中态没有 Close 按钮**。
  - 错误分派（`TerminalError.kt`）：`error.type` 优先，否则按 `error.code` 映射 `SSH_UNKNOWN_SERVER_KEY` / `SSH_AUTHENTICATION_FAILED` / `SSH_KEYBOARD_INTERACTIVE_REQUIRED`，落到 Default / UnknownServerKey / Authentication / KeyboardInteractive 四种呈现；UnknownKey 与 Authentication 使用分裂按钮（主动作 + 溢出菜单项）。
  - 认证表单（`TerminalAuthForm.kt`）：`Authentication` 与 `KeyboardInteractive` 两种呈现会在遮罩内插入表单（`SshLoadingMask` 的 `formContent` 插槽）。认证方式下拉为 Password / PublicKey / Certificate / SSH Agent / Keyboard Interactive；Password 显示密码框（上限 100 字符，与参考的 `maxLength` 一致），PublicKey / Certificate 显示密钥下拉且**首项为 `+ Add key`**（哨兵值 `ADD_KEY_OPTION_VALUE`，点击进入新增密钥流程）。
- SFTP：`feature/sftp/` —— 工具条与面包屑同排（`/` 根按钮 + 140dp 省略分段 + 编辑铅笔），动作按钮统一 `chipHeight`(32) 且搜索为**原位内联**的 `sftpSearchWidth`(180dp) 过滤框；表头 12sp/600 大写、**所有可排序列恒显 ▲/▼**（激活列 accent）；行高 `sftpRowHeight`(48dp)、无底色图标、名称 14/500、时间与权限两段 11sp；尺寸列 `sftpSizeColumnWidth`(90dp) 与操作列 `sftpActionColumnWidth`(96dp) 由**同一组令牌**同时驱动表头与行，3×32dp 操作位正好等于 96；状态栏 `sftpStatusBarHeight`(28dp)，↑/↓/✓ 计数来自 `SftpTransferSummary`；连接中/失败时浏览器层被隐藏并由共用的 `SshLoadingMask` 覆盖（连接中无 Close）；文件编辑弹窗 `SFTP_MODAL_WIDTH_FRACTION`(0.94) × `SFTP_MODAL_HEIGHT_FRACTION`(0.8)、48dp 头/脚、40% 遮罩；删除确认按钮用 `statusWarning`（橙）。
  - 有意偏离参考之处：保留空目录文案（参考为空列表，无文案）；行用**单击**打开（参考为双击名称单元）；传输面板与进度未实现（依赖尚未接入的 SFTP 桥接）。

这些界面新增的取值已进入 `design/tokens.json` 的 `size`，并由 `ComponentSizeTest` / `SpacingScaleTest` 守卫。

## 控件尺寸规则

同一种控件在任意页面只能有一个尺寸。曾经出现过图标按钮 36 / 44 / 48dp 三种、图标 16 / 18 / 20 / 22 / 24dp 五种，同一个界面里按钮大小不一。

| 角色 | 令牌 | 值 | 说明 |
| --- | --- | --- | --- |
| 按钮 / 分段按钮高度 | `controlHeight` | `40` | 所有常规按钮保持统一触控高度 |
| 输入框 / 下拉 / 搜索栏高度 | `fieldHeight` | `56` | 标签在控件外；控件内部垂直居中 |
| 标签 chip 高度 | `chipHeight` | `32` | `FilterChip` / `InputChip` / `AssistChip` 默认 |
| 列表行 / 侧栏条目高度 | `listRow` / `sidebarItem` | `56` / `48` | |
| 顶栏高度 | `topBar` | `64` | |
| 页面内容最大宽度 | `contentMaxWidth` | `960` | 宽屏居中，手机与平板共用同一内容边距 |
| 紧凑表单最大宽度 | `compactFormMaxWidth` | `480` | Unlock 等窄表单 |
| 常驻侧栏断点 | `wideScreenBreakpoint` | `840` | dp；低于该宽度保留抽屉导航 |
| 图标按钮触点 | `iconButton` | `48` | 用 `IconButton` 默认触点 |
| 图标按钮内的图标 | `icon` | `24` | `Icon` 默认值，不要写 size |
| 行内辅助图标（菜单项、表格、横幅） | `inlineIcon` | `20` | |
| 按钮 / chip 内的前导图标 | `buttonIcon` | `18` | |
| 表格排序箭头等极小图标 | `tableIcon` | `14` | |
| 列表前导图标块 | `iconTile` | `44` | `AppIconTile` 默认值 |
| 会话/连接视图顶栏 | `sessionHeader` | `52` | 参考 mobile `.header` |
| 空态图标块 | `emptyIconBox` | `64` | 圆角 16，内图标 `smallTile`(32)；**不是**圆形 |
| 空态图标圈 | `emptyCircle` + `emptyIcon` | `88` + `36` | 圆形变体，必须成对使用 |
| 状态圆点 | `statusDot` | `8` | 参考 mobile `.statusDot` |
| 列表左滑动作区宽度 | `swipeAction` | `88` | 实心 `statusError` 底 + 白字 |
| 虚拟键盘按键高 | `keyboardKey` | `34` | 圆角 8、1px 描边、键间距 2、容器内边距 4 |
| 键盘开关 | `keyboardToggleWidth` / `keyboardToggleHeight` | `38` / `26` | 圆角 4，激活时 accent 描边 + 12% accent 底 |

规范集之外的尺寸（如 15 / 17 / 22 / 30 / 46）不允许出现。`android/app/src/test/java/com/nashaofu/shell360/ui/theme/ComponentSizeTest.kt` 会扫描主源码中所有 `Modifier.size(N.dp)`，值不在 `size` 令牌内即测试失败。iOS / HarmonyOS 落地时请照抄同样的守卫。

## 布局边距规则

三端共用同一套间距，禁止出现刻度外的数值（曾出现过 10/14/20/28/96 混用，导致各页左右边距不一致）：

| 位置 | 取值 |
| --- | --- |
| 页面左右内边距 | `16` |
| 顶栏与首个内容的间距 | `8` |
| 搜索栏与列表内容的间距 | `16` |
| 列表项 / 卡片之间的纵向间距 | `12`（紧凑列表 `8`） |
| 卡片内部内边距 | `16` |
| 分组之间的间距（设置页等） | `24` |
| 分组标题与卡片边缘 | 与卡片左边缘对齐（同一内边距，不要再额外偏移） |
| 列表底部留白 | `24`（系统导航栏 inset 由 Scaffold 单独处理，不要重复叠加，也不要为不存在的 FAB 预留 88/96） |
| 列表图标与文字的间距 | `12` |
| 空态图标圈 | `88` 直径 + `24` 与文字间距 |

动效里出现的 `1`/`2` dp 只允许用于徽标内边距、描边等视觉微调，不用于布局间距。

`android/app/src/test/java/com/nashaofu/shell360/ui/theme/SpacingScaleTest.kt` 会扫描主源码，把所有 `padding()` / `spacedBy()` / `PaddingValues()` / `Spacer()` 里的字面量逐一比对刻度（`0/1/2` 作为视觉微调放行），出现刻度外数值即测试失败。iOS / HarmonyOS 落地时请照抄同样的守卫。

## 安全区（insets）规则

`MainActivity` 调用了 `enableEdgeToEdge()`，界面绘制在状态栏、导航栏与挖孔之下，所以安全区**必须**处理。正确做法是把 inset 交给系统组件，而不是逐页手写 padding：

- **单一来源**：每个页面的 `Scaffold` 使用默认 `contentWindowInsets`（`systemBars`），`AppTopBar` 使用默认 `windowInsets`。顶部 inset 由顶栏消费、底部由内容消费，两者不会重复叠加。页面内**不要**再写 `statusBarsPadding()` / `navigationBarsPadding()`。
- `Shell360Navigation` 外层容器的 `Scaffold` 把 `contentWindowInsets` 置零，是为了不与内层页面的 Scaffold 重复计算。**新增页面必须自带 Scaffold**，否则那一页会完全丢失安全区。
- **平板常驻侧栏**在任何 Scaffold 之外，需自行应用 `systemBars ∪ displayCutout` 的 start/top/bottom 内边距（横屏时挖孔在左侧）。
- **软键盘**：抽屉、终端、SFTP、Unlock 使用 `imePadding()`，保证键盘弹出时不遮挡底部操作区。
- **状态栏 / 导航栏图标的明暗必须跟随应用主题**，不能只依赖 `enableEdgeToEdge()`：它按**系统**深色模式决定图标颜色，而应用主题是独立的（Light / Dark / Auto）。`MainActivity` 在主题变化时用 `WindowCompat.getInsetsController(...)` 的 `isAppearanceLightStatusBars` / `isAppearanceLightNavigationBars` 覆盖。否则「应用深色 + 系统浅色」时状态栏图标会消失在深色背景里。
- 列表底部的内容留白属于内容间距，安全区由 Scaffold 另行叠加，两者不可互相替代。

各平台对应：Android `WindowInsets` / iOS `safeAreaInsets` / HarmonyOS `getWindowAvoidArea`。WebView 时代的 `env(safe-area-inset-*)` 在原生端没有对应物。

## 各平台如何消费

- **Android**：`android/app/src/main/java/com/nashaofu/shell360/ui/theme/` 下的 `Color.kt` / `Type.kt` / `Tokens.kt` / `Theme.kt` 把本文件映射成 Material 3 `ColorScheme` / `Typography` / `Shapes`。界面代码只用 `MaterialTheme.colorScheme.*`、`MaterialTheme.typography.*`、`MaterialTheme.shapes.*`，或 `ui/components/` 里的封装组件。
- **iOS**：把颜色角色写进 Asset Catalog（Light/Dark 两套），字号写成统一的 `Font` 扩展，圆角写成 `RoundedRectangle` 常量。
- **HarmonyOS**：写进 `resources/base/element/color.json` 与 `float.json`，字号圆角同为资源项。

## 一致性保障

`android/app/src/test/java/com/nashaofu/shell360/ui/theme/DesignTokensTest.kt` 会在单元测试阶段读取 `design/tokens.json`，逐项比对 Android 侧的 Kotlin 令牌：

- 颜色角色的键集合与每个色值（含浅色与深色）必须完全一致；
- 排版每一项的 size / lineHeight / letterSpacing / weight 必须一致；
- 形状与间距的每一项必须一致。

任何一侧漂移都会让 `:app:testDebugUnitTest` 失败。新增平台时请照抄这个测试模式（读取同一份 JSON 比对本地令牌），这样"三端一致"就是可执行、可验证的约束，而不是口头约定。
