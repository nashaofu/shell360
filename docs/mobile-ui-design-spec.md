# Shell360 移动端 UI 设计与实现规格

## 1. 文档目的

本文档定义 Shell360 移动端界面的目标布局、导航、视觉令牌、组件尺寸、交互状态和验收标准。实现 Agent 应将本文档视为移动端 UI 改造的产品与设计基线，并在不改变现有业务能力的前提下完成代码实现。

本文档主要约束 `mobile/`，必要时允许复用或扩展 `shared/` 中的后端无关组件。除非任务另有明确要求，不应修改 `desktop/`、原生 Android WebView Host、Bridge API 或 Rust 后端。

## 2. 已确定的产品决策

以下决策已经确认，实现时不得自行替换为其他导航模式：

1. 移动端采用侧边导航，不采用底部主导航。
2. Workspace 入口只保留在侧边栏，Hosts、Keys 等页面的顶部栏和内容区不再重复提供 Workspace 入口。
3. Workspace 是一级页面，左上角按钮用于唤起侧边栏，不是返回按钮。
4. Workspace 内点击顶部标题区域，从页面底部弹出会话选择浮层。
5. Hosts 中必须同时提供 SSH Terminal 和 SFTP 两个直接可见的高频操作。
6. Hosts、Keys、Tunnels、Known Hosts 等页面的搜索位于标题栏下方的页面工具栏。
7. 一级页面的主要创建操作位于顶部栏右侧；编辑、复制、删除等低频条目操作放入更多菜单。
8. Logo 的图形、颜色、比例、圆角、资源文件和展示样式保持不变。
9. 移动端必须支持浅色、深色和跟随系统三种外观模式。
10. 浅色与深色主题必须使用相同的语义令牌和信息层级，不能仅依赖 Radix 默认颜色反转。

## 3. 范围与非目标

### 3.1 本次设计范围

- 移动端全局侧边栏
- 一级与二级页面顶部栏
- Workspace 及会话选择浮层
- Hosts 列表、搜索、筛选及 SSH/SFTP 操作
- Keys、Tunnels、Known Hosts、Settings 的页面框架
- 搜索、筛选、按钮、卡片、列表、表单、对话框和 Bottom Sheet 规范
- 浅色与深色语义颜色令牌
- 手机、横屏手机和平板的响应式规则
- 加载、空状态、错误、禁用、连接中等状态

### 3.2 非目标

- 不修改 Logo 或启动图标
- 不重新设计 SSH、SFTP、密钥或隧道的业务数据结构
- 不改变 Bridge、Tauri 或原生 Android 的通信协议
- 不新增底部主导航
- 不在每个页面额外添加 Workspace 快捷按钮
- 不强制修改桌面端视觉
- 不把移动端做成桌面端布局的等比例缩小版本

## 4. 信息架构

侧边栏是唯一的全局一级导航，顺序固定为：

```text
品牌区域

WORKSPACE
  Workspace             活跃会话数

MANAGE
  Hosts
  Tunnels                活跃隧道数
  Keys
  Known Hosts

底部固定区域
  Settings
```

### 4.1 一级页面

以下页面属于一级页面，左上角均显示侧边栏菜单按钮：

- Workspace
- Hosts
- Tunnels
- Keys
- Known Hosts
- Settings

### 4.2 二级页面

以下页面属于二级页面，左上角显示返回按钮：

- New Host / Edit Host
- New Tunnel / Edit Tunnel
- Generate Key / Import Key / Key Detail
- Known Host Detail
- Settings 的独立设置子页面

一级页面和二级页面不得混用左上角按钮语义。

## 5. 全局页面框架

### 5.1 一级管理页面

```text
┌──────────────────────────────────┐
│ ☰   Page title                 ＋ │  Top bar
├──────────────────────────────────┤
│ [ Search…                   ] [⚙] │  Search toolbar
├──────────────────────────────────┤
│ [ All ] [ Filter A ] [ Filter B ]│  Optional quick filters
├──────────────────────────────────┤
│                                  │
│             Content              │
│                                  │
└──────────────────────────────────┘
```

- 顶部栏固定在页面顶部并处理系统顶部安全区。
- 搜索工具栏位于顶部栏下方。
- 快捷筛选是可选区域，只能保持单行横向滚动。
- 内容区域独立滚动。
- 页面底部必须包含系统安全区与至少 24px 的内容留白。

### 5.2 二级编辑页面

```text
┌──────────────────────────────────┐
│ ‹   Edit Host                 Save│
├──────────────────────────────────┤
│                                  │
│              Form                │
│                                  │
└──────────────────────────────────┘
```

- Save 是文本操作，不应只使用含义不明确的图标。
- 表单未修改时 Save 可以禁用。
- 存在未保存内容时，退出必须确认。
- 高级配置使用折叠分组或独立二级页面，不在首屏平铺所有字段。

## 6. 侧边栏

### 6.1 布局

- 手机：覆盖式 Drawer，宽度为视口的 82%，最大 304px。
- 平板：视口宽度大于等于 840px 时可常驻，展开宽度 200px，折叠宽度 56px。
- Logo 保持当前资源和视觉样式，不添加滤镜、描边、重绘或比例调整。
- Settings 固定在侧边栏底部。
- Workspace 固定在第一个导航位置，不与普通管理页面混在同一连续列表中。

### 6.2 Workspace 导航项

- 高度 52px，高于普通导航项。
- 右侧显示活跃会话数量；数量为 0 时可以隐藏。
- 存在连接中或已连接会话时显示状态点。
- 当前页面为 Workspace 时使用品牌弱背景和品牌文字色。
- 侧边栏点击 Workspace 后恢复最后活跃的会话；没有会话时展示 Workspace 空状态。

### 6.3 打开与关闭

- 所有一级页面通过左上角菜单按钮打开侧边栏。
- 点击遮罩关闭。
- 向左拖动侧边栏可以关闭。
- 不把从系统屏幕边缘右滑作为唯一入口，避免与 Android 返回手势冲突。
- 系统返回键优先关闭当前打开的 Bottom Sheet，其次关闭侧边栏，再执行页面返回。

## 7. 顶部栏

### 7.1 一级管理页面顶部栏

```text
[Menu 44px] [Title flex] [Primary action 44px]
```

- 左侧：侧边栏菜单按钮。
- 中间：页面标题。
- 右侧：最多一个页面主操作。
- 没有主操作时保留布局空间或保持标题位置稳定，不应放入装饰性按钮。

页面主操作：

| 页面 | 右侧操作 |
| --- | --- |
| Hosts | New Host |
| Tunnels | New Tunnel |
| Keys | 打开 Generate / Import 选择菜单 |
| Known Hosts | 无 |
| Settings | 无 |

### 7.2 Workspace 顶部栏

```text
┌──────────────────────────────────┐
│ ☰   API Production           ▾  ⋯│
│     Terminal · Connected         │
└──────────────────────────────────┘
```

- 左侧按钮只负责打开侧边栏，不是返回。
- 中间标题区域整体可点击，用于打开会话选择 Bottom Sheet。
- 第一行显示当前会话名称。
- 第二行显示会话类型和状态，例如 `Terminal · Connected` 或 `SFTP · /home/ubuntu`。
- 当前会话名称过长时单行省略。
- SFTP 路径过长时保留尾部路径，例如 `SFTP · …/projects/shell360`。
- 右侧更多按钮只操作当前会话。
- 当前没有会话时标题显示 `Workspace`，不显示下拉箭头。

## 8. 搜索、筛选与页面操作

### 8.1 搜索位置

搜索框固定放在标题栏下方的工具栏中，不放入标题栏，也不使用只显示搜索图标、点击后替换标题的模式。

```text
[ Search placeholder…                 ] [Filter]
```

- 默认完整显示搜索框。
- 输入时实时过滤。
- 有输入内容时显示清除按钮。
- 搜索工具栏可以与页面顶部保持固定；如果页面空间紧张，可以随内容滚动后吸顶。
- 空列表仍保持搜索工具栏位置，避免页面结构跳变。

### 8.2 筛选位置

- 筛选按钮位于搜索框右侧。
- 存在有效筛选条件时，使用品牌色并显示数量或小圆点。
- 点击后打开筛选 Bottom Sheet。
- 筛选浮层底部提供 Reset 和 Apply。
- 常用标签可以作为搜索栏下方的一行快捷筛选，禁止换行。

### 8.3 条目操作层级

- 卡片或列表中直接显示高频操作。
- 低频操作放入更多菜单。
- 删除操作不应作为默认可见的实心红色按钮。
- 危险操作执行前必须确认。

## 9. Hosts 页面

### 9.1 页面布局

```text
┌──────────────────────────────────┐
│ ☰   Hosts                      ＋ │
├──────────────────────────────────┤
│ [ Search hosts…             ] [⚙]│
│ [ All ] [ Production ] [Personal]│
├──────────────────────────────────┤
│                                  │
│ Host cards                       │
│                                  │
└──────────────────────────────────┘
```

搜索范围至少包含：

- 主机名称
- hostname / IP
- 用户名
- 标签

筛选至少可以覆盖标签。连接状态、最近使用和排序可作为后续增强，但组件结构应允许扩展。

### 9.2 主机卡片

```text
┌──────────────────────────────────┐
│ AP   API Production          ●  ⋯│
│      ubuntu@10.0.0.12:22         │
│      Production · Singapore      │
│                                  │
│ [ >_ SSH                 ] [SFTP]│
└──────────────────────────────────┘
```

必须满足：

- SSH 和 SFTP 两个操作始终直接可见。
- SSH 按钮使用品牌弱背景，视觉权重略高。
- SFTP 使用中性按钮。
- 推荐按钮宽度比例为 3:2；极窄屏幕可以调整为 1:1，但不得隐藏 SFTP。
- 点击 SSH：创建或激活 SSH Terminal 会话并进入 Workspace。
- 点击 SFTP：创建或激活 SFTP 会话并进入 Workspace。
- 点击卡片主体：进入主机详情或编辑页，具体沿用当前业务行为。
- 点击更多：Edit、Duplicate、Test Connection、Delete；只展示当前已经实现的能力，不得伪造不可用功能。
- 不使用双击作为移动端必要交互。
- 长按可以打开与更多按钮相同的菜单，但不能作为唯一入口。

### 9.3 状态与异常

- 连接中：按钮禁用重复提交，并显示进度状态。
- 连接失败：保留在当前页面并展示可重试错误，不创建不可用的重复会话。
- 主机列表为空：展示说明、New Host 主操作和可选导入入口。
- 搜索无结果：展示清除搜索或重置筛选操作，不展示 New Host 空状态。
- SSH 或 SFTP 不可用时，应显示原因，不能静默无响应。

## 10. Workspace

### 10.1 会话内容

Workspace 展示最后活跃会话，内容可以是：

- SSH Terminal
- Local Shell
- SFTP

顶部标题用于切换会话，内容区域只负责当前会话。全局页面导航仍通过左上角侧边栏按钮完成。

### 10.2 会话选择 Bottom Sheet

点击 Workspace 标题区域后打开：

```text
┌──────────────────────────────────┐
│           Drag handle            │
│ Workspace · 4                 ＋ │
│                                  │
│ TERMINALS                        │
│ ● API Production             ✓  │
│   ubuntu@10.0.0.12               │
│                                  │
│ ● Local Shell                    │
│   Connected                      │
│                                  │
│ SFTP                             │
│ ● API Production                 │
│   /var/www                       │
└──────────────────────────────────┘
```

行为要求：

- 按 Terminal 和 SFTP 分组。
- 当前会话显示勾选和品牌弱背景。
- 点击会话立即切换并关闭浮层。
- 会话少时高度自适应；默认最大高度为屏幕 64%。
- 会话过多时列表内部滚动，并允许向上拖到屏幕 90%。
- 点击遮罩、向下滑动或系统返回键关闭。
- 右上角新建按钮打开 `New Terminal` / `New Local Shell` 菜单，只展示现有产品支持的创建方式。
- 长按会话可以打开 Reconnect、Rename、Duplicate、Close Session；只展示已实现能力。
- 左滑关闭必须先露出关闭操作，再由用户确认点击，不能一次手势直接销毁会话。

### 10.3 Workspace 空状态

```text
Workspace

No active sessions
Open a host terminal or start a local shell to begin.

[ Browse Hosts ]
[ Local Shell ]
```

- Browse Hosts 导航到 Hosts。
- Local Shell 直接创建本地会话。
- 这些是空状态操作，不是额外的全局 Workspace 入口。

### 10.4 Terminal

- Terminal 内容默认采用专用深色终端主题，即使应用是浅色模式。
- 底部可以保留 Ctrl、Alt、Esc、Tab、方向键和键盘切换快捷栏。
- 快捷栏处理系统底部安全区与软键盘高度。
- 激活 Ctrl/Alt 时使用品牌弱背景，不能只靠颜色表达激活状态。

### 10.5 SFTP

- 移动端使用文件列表，不使用桌面表格。
- 文件行展示文件名、类型、大小或修改时间。
- 点击文件夹进入，点击文件执行预览或打开操作菜单。
- 长按进入多选模式。
- 路径区域位于 SFTP 内容内；顶部 Workspace 标题只展示简化路径。
- 传输任务使用可收起的底部任务面板，不与会话选择浮层同时打开。

## 11. 其他页面

### 11.1 Keys

```text
☰  Keys                          ＋
[ Search keys…                ] [⚙]
```

- 新建按钮打开 Generate Key / Import Key 选择菜单。
- 列表优先展示名称、类型、指纹摘要和创建时间。
- 私钥内容默认不得直接展示。
- Copy、Export、Rename、Delete 放入更多菜单。
- 筛选可以包含 ED25519、RSA、ECDSA、Imported、Generated。

### 11.2 Tunnels

```text
☰  Tunnels                       ＋
[ Search tunnels…             ] [⚙]

ACTIVE
INACTIVE
```

- Active 和 Inactive 分组展示。
- 每项直接显示 Start 或 Stop。
- 地址和端口使用等宽字体。
- 状态点必须同时配合状态文字。
- 其他操作放入更多菜单。

### 11.3 Known Hosts

```text
☰  Known Hosts
[ Search hostname or fingerprint… ]
```

- 默认不显示新建按钮。
- 使用双行列表展示 hostname 和指纹摘要。
- 删除、查看详情放入更多菜单。

### 11.4 Settings

- 设置项较少时不显示搜索。
- 使用分组列表，而不是卡片网格。
- Appearance 至少提供 Follow System、Light、Dark。
- 切换外观后立即生效，不需要额外保存。
- Known Hosts 可以继续保留一级入口；Settings 中可以提供同一功能的安全分组入口，但不得产生两套页面实现。

## 12. 语义设计令牌

实现应优先使用语义令牌，组件中禁止继续散落硬编码颜色。可以将以下令牌映射到 Radix 变量，但组件只能依赖语义名称。

### 12.1 浅色主题

| Token | Value | Usage |
| --- | --- | --- |
| `--mobile-bg-page` | `#F5F7F5` | 页面背景 |
| `--mobile-bg-frame` | `#EDF1EE` | 顶栏、侧边栏框架 |
| `--mobile-bg-surface` | `#FFFFFF` | 卡片、一级面板 |
| `--mobile-bg-subtle` | `#F0F3F1` | 输入、二级表面 |
| `--mobile-bg-pressed` | `#E6EBE8` | 按下、强悬浮 |
| `--mobile-border-subtle` | `#E0E5E2` | 弱边框 |
| `--mobile-border-strong` | `#CDD5D0` | 强边框 |
| `--mobile-text-primary` | `#17201B` | 主文字 |
| `--mobile-text-secondary` | `#5F6B63` | 次文字 |
| `--mobile-text-muted` | `#89938D` | 弱文字 |
| `--mobile-accent` | `#119C42` | 主要操作、焦点 |
| `--mobile-accent-hover` | `#0E8739` | 强交互状态 |
| `--mobile-accent-soft` | `#E5F6EA` | 选中、品牌弱背景 |
| `--mobile-accent-border` | `#A8E8BB` | 品牌弱边框 |
| `--mobile-accent-text` | `#087431` | 品牌文字 |

### 12.2 深色主题

| Token | Value | Usage |
| --- | --- | --- |
| `--mobile-bg-page` | `#121613` | 页面背景 |
| `--mobile-bg-frame` | `#191E1B` | 顶栏、侧边栏框架 |
| `--mobile-bg-surface` | `#1C221E` | 卡片、一级面板 |
| `--mobile-bg-subtle` | `#232A25` | 输入、二级表面 |
| `--mobile-bg-pressed` | `#2A332C` | 按下、强悬浮 |
| `--mobile-border-subtle` | `#29322C` | 弱边框 |
| `--mobile-border-strong` | `#374239` | 强边框 |
| `--mobile-text-primary` | `#EDF3EF` | 主文字 |
| `--mobile-text-secondary` | `#AAB5AE` | 次文字 |
| `--mobile-text-muted` | `#748078` | 弱文字 |
| `--mobile-accent` | `#35E566` | 主要操作、焦点 |
| `--mobile-accent-hover` | `#48EE78` | 强交互状态 |
| `--mobile-accent-soft` | `#183721` | 选中、品牌弱背景 |
| `--mobile-accent-border` | `#286D3D` | 品牌弱边框 |
| `--mobile-accent-text` | `#79F498` | 品牌文字 |

### 12.3 状态色

状态色必须配合图标或文本：

| State | Light | Dark |
| --- | --- | --- |
| Success | `#168A45` | `#53D985` |
| Warning | `#B56A09` | `#F2B84B` |
| Error | `#C83D49` | `#FF707A` |
| Info | `#3678D4` | `#70A7FF` |
| Offline | `#7B8580` | `#7D8981` |

品牌强调色与成功状态在语义上必须区分，不能所有绿色都引用同一个变量。

## 13. 组件尺寸规范

所有值均为 CSS px；在原生界面中可按同等逻辑 dp 实现。

### 13.1 页面与布局

| Component | Size |
| --- | --- |
| 页面水平边距 | 16px |
| 小于 360px 的窄屏水平边距 | 12px |
| 一级/二级顶部栏 | 52px，不含系统顶部安全区 |
| 搜索工具栏 | 56px |
| 页面区块间距 | 24px |
| 列表项间距 | 8px |
| 卡片间距 | 10px |
| 内容底部留白 | 24px + safe area |
| 平板内容最大宽度 | 720px |

### 13.2 触摸区域

| Component | Minimum target |
| --- | --- |
| 任意主要点击目标 | 44×44px |
| 顶部栏图标按钮 | 44×44px |
| 普通图标按钮 | 40×40px，外部触摸区至少 44px |
| 卡片更多按钮 | 36×36px，外部触摸区至少 44px |
| 可点击筛选标签 | 32px 高，外部触摸区至少 44px |

视觉图标允许小于触摸区域，但命中区域不得缩小。

### 13.3 顶部栏

| Element | Size |
| --- | --- |
| 菜单/返回图标 | 22px |
| 一级页面标题 | 18px / 600 |
| Workspace 会话标题 | 15px / 600 |
| Workspace 状态副标题 | 11px / 400 |
| 标题与副标题间距 | 2px |
| 底部分隔线 | 1px |

### 13.4 侧边栏

| Element | Size |
| --- | --- |
| 手机宽度 | 82vw，最大 304px |
| 平板展开/折叠宽度 | 200px / 56px |
| 品牌区域 | 64px + safe area |
| 普通导航项 | 46px |
| Workspace 导航项 | 52px |
| 导航项水平内边距 | 14px |
| 导航项圆角 | 10px |
| 导航图标 | 20px |
| 导航文字 | 14px / 500 |
| 分组标题 | 11px / 600 |
| 分组间距 | 20px |
| 导航项间距 | 4px |

### 13.5 搜索和快捷筛选

| Element | Size |
| --- | --- |
| 搜索框 | 40px 高 |
| 搜索框圆角 | 10px |
| 搜索图标 | 18px |
| 搜索文字 | 14px |
| 筛选按钮 | 40×40px |
| 搜索与筛选间距 | 8px |
| 快捷筛选标签 | 32px 高 |
| 标签间距 | 6px |

### 13.6 主机卡片

| Element | Size |
| --- | --- |
| 卡片最小高度 | 138px |
| 卡片内边距 | 14px |
| 卡片圆角 | 12px |
| 边框 | 1px |
| 头像 | 40×40px |
| 头像圆角 | 10px |
| 主机名称 | 15px / 600 |
| 地址 | 12px / monospace |
| 元数据 | 12px |
| 状态点 | 8px |
| SSH/SFTP 按钮 | 36px 高 |
| 按钮间距 | 8px |
| 内容与操作区间距 | 12px |

### 13.7 列表项

| Type | Height |
| --- | --- |
| 单行 | 48px |
| 双行 | 60px |
| 三行 | 72px |

列表左右内边距 16px，图标 20px，图标与文字间距 12px；主文字 14px / 500，次文字 12px / 400。

### 13.8 按钮

| Type | Height | Horizontal padding | Radius |
| --- | --- | --- | --- |
| Primary | 40px | 16px | 9px |
| Secondary | 40px | 14px | 9px |
| Card action | 36px | 12px | 8px |
| Compact | 32px | 10px | 8px |
| Icon | 40×40px | - | 9px |
| Destructive confirm | 44px | 18px | 10px |

### 13.9 表单

| Element | Size |
| --- | --- |
| 普通输入框 | 44px 高 |
| 多行输入 | 最小 96px |
| 输入框圆角 | 9px |
| 水平内边距 | 12px |
| 输入文字 | 15px |
| 字段标签 | 13px / 500 |
| 辅助/错误文字 | 12px |
| 标签与输入间距 | 8px |
| 字段间距 | 18px |
| 表单分组间距 | 28px |
| 分组标题 | 12px / 600 |

### 13.10 Bottom Sheet 与对话框

| Element | Size |
| --- | --- |
| Bottom Sheet 顶部圆角 | 18px |
| 默认最大高度 | 64vh |
| 扩展最大高度 | 90vh |
| 标题区域 | 56px |
| 拖动条 | 36×4px |
| 会话项 | 58px |
| 水平内边距 | 16px |
| 对话框宽度 | calc(100vw - 32px)，最大 360px |
| 对话框圆角 | 16px |
| 对话框内边距 | 20px |

## 14. 视觉与排版规则

- 应用正文使用系统无衬线字体栈；技术地址、端口、指纹和终端信息使用等宽字体。
- 不使用 11px 以下的正文；10px 仅允许用于极少量非关键元数据。
- 卡片默认不使用明显阴影，以表面明度和 1px 边框区分。
- 阴影只用于 Drawer、Bottom Sheet、菜单和对话框等浮层。
- 页面中一次只允许一个高权重主按钮。
- 不在组件中硬编码 Logo 绿色作为任意成功状态色。
- 不允许纯黑铺满整个应用；终端背景可以使用接近黑色的专用主题。
- 不允许通过颜色单独传达连接、错误或选中状态。

## 15. 动效与反馈

- Hover/pressed 状态：120ms。
- Drawer 与 Bottom Sheet：180–220ms。
- 二级页面进入：最多 180ms 的轻微转场。
- 不添加装饰性整页滑动和弹跳动画。
- 支持 `prefers-reduced-motion`。
- 连接成功后直接进入 Workspace，不显示多余成功弹窗。
- 连接失败使用可诊断的错误信息并提供 Retry。
- 长任务显示局部进度，不阻塞无关页面操作。
- 按钮提交后应防止重复触发。

## 16. 响应式规则

### 16.1 窄屏，小于 360px

- 页面水平边距降为 12px。
- Hosts 的 SSH 与 SFTP 可以改为 1:1，但保持同一行。
- 顶部标题优先省略，左右图标触摸区域不得缩小。
- 快捷筛选保持横向滚动，不换行。

### 16.2 普通手机，360px–839px

- 使用覆盖式侧边栏。
- 内容单列。
- Bottom Sheet 用于筛选、会话选择和条目操作。

### 16.3 平板，大于等于 840px

- 侧边栏允许常驻并折叠。
- 管理页面内容最大宽度 720px，并在剩余区域内合理居中或左对齐。
- 不将 Hosts 自动切换为桌面端多列卡片，除非后续单独确认平板布局。
- Workspace 继续使用标题点击加 Bottom Sheet 的会话切换方式，保持交互一致。

## 17. 无障碍要求

- 所有图标按钮必须有 `aria-label` 或可访问名称。
- 触摸目标至少 44×44px。
- 焦点状态不能只依赖浏览器默认且不能被全局移除。
- 文本和背景应满足 WCAG AA 对比度；非文本控件边界至少满足 3:1。
- 状态必须同时有文字、图标或形状辅助。
- Bottom Sheet 打开后焦点限制在浮层内，关闭后恢复到触发按钮。
- 系统返回键与 Escape 应优先关闭最上层浮层。
- 动画遵循减少动态效果设置。

## 18. 建议的组件边界

实现 Agent 应优先复用现有组件；确有重复时再引入下列语义组件。不要为了包装单个元素而创建只增加间接层的组件。

建议边界：

- `MobileTopBar`：一级菜单、二级返回、标题、右侧操作三种槽位。
- `SearchToolbar`：搜索输入、清除、可选筛选按钮。
- `MobileSidebar`：全局导航、Workspace 计数、遮罩和安全区。
- `BottomSheet`：会话选择、筛选和操作菜单的通用浮层基础。
- `WorkspaceSessionSheet`：会话分组、切换和当前状态。
- `HostCard`：主机信息、SSH、SFTP 和更多操作。
- `StatusDot`：连接状态图形与可访问文本。
- `EmptyState`：图标、标题、描述、主次操作。

建议 Props 方向，仅作为实现参考：

```ts
type MobileTopBarProps = {
  navigation: "menu" | "back";
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onNavigation: () => void;
  onTitleClick?: () => void;
  action?: React.ReactNode;
};

type SearchToolbarProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onFilter?: () => void;
  activeFilterCount?: number;
};

type HostCardProps = {
  host: Host;
  onOpenSsh: () => void;
  onOpenSftp: () => void;
  onOpenDetails: () => void;
  actions: React.ReactNode;
  sshPending?: boolean;
  sftpPending?: boolean;
};
```

Props 应保持业务语义，不要把内部 CSS 类名、任意颜色值或布局像素暴露为公共 API。

## 19. 实施顺序

建议按以下阶段实现，每阶段保持应用可运行：

### Phase 1：基础令牌与页面框架

- 建立浅色/深色语义令牌。
- 统一 safe area、页面背景、顶部栏和滚动容器。
- 保持现有外观设置可用。

### Phase 2：侧边栏与导航

- 重构侧边栏信息架构。
- Workspace 只保留一个侧边栏入口。
- 统一一级菜单按钮和二级返回行为。

### Phase 3：Hosts

- 实现搜索工具栏与筛选入口。
- 重做 HostCard。
- 确保 SSH 和 SFTP 都是直接操作。
- 完成加载、空状态、无结果和错误状态。

### Phase 4：Workspace

- 实现可点击的标题区域。
- 实现会话选择 Bottom Sheet。
- 统一 Terminal、Local Shell 和 SFTP 会话展示。
- 验证系统返回、软键盘和安全区行为。

### Phase 5：其他管理页面

- 将 Keys、Tunnels、Known Hosts、Settings 迁移到统一页面模板。
- 统一列表项、更多菜单、筛选和创建操作。

### Phase 6：验证和细节

- 验证浅色、深色和跟随系统。
- 验证窄屏、普通手机、横屏和平板。
- 验证键盘、焦点、屏幕阅读器名称和减少动态效果。
- 清理不再使用的样式与重复组件。

## 20. 工程约束

- 遵守根目录 `AGENTS.md` 的代码风格和验证要求。
- 移动端业务代码通过 `bridge/*` 调用后端，不直接依赖 Tauri API。
- 共享组件不得引入移动端路由或平台专属实现。
- 不创建重复的全局主题系统；应在现有 Radix Theme 与 appearance atom 上增加语义映射。
- 不在 JSX 中批量硬编码颜色、阴影和尺寸。
- 不因视觉改造更改数据模型、路由语义或会话生命周期。
- 不修改 Logo 资源。
- 不修改生成的 `src-tauri/gen/android`。

## 21. 验收标准

实现完成必须同时满足：

### 导航

- [ ] 移动端没有底部主导航。
- [ ] Workspace 只存在于侧边栏。
- [ ] 所有一级页面左上角都打开侧边栏。
- [ ] 所有二级页面左上角都是返回。
- [ ] Workspace 从侧边栏进入时恢复最后活跃会话。

### Workspace

- [ ] 点击 Workspace 标题区域打开底部会话浮层。
- [ ] 会话按 Terminal 和 SFTP 分组。
- [ ] 点击会话后切换并关闭浮层。
- [ ] 系统返回优先关闭浮层。
- [ ] 无会话时展示明确空状态。

### Hosts

- [ ] 每个 Host 条目直接提供 SSH 和 SFTP。
- [ ] 两个操作均能创建或激活正确会话并进入 Workspace。
- [ ] 搜索支持名称、地址、用户名和标签。
- [ ] 创建操作位于顶部栏右侧。
- [ ] 编辑、复制和删除等低频操作位于更多菜单。

### 视觉

- [ ] 浅色与深色均使用语义令牌。
- [ ] Logo 的资源与样式没有变化。
- [ ] 页面没有大面积纯黑或无层级的同色灰。
- [ ] 状态不只依赖颜色表达。
- [ ] 所有主要触摸目标至少 44×44px。

### 响应式与无障碍

- [ ] 320px 或项目支持的最窄视口没有横向溢出。
- [ ] Bottom Sheet 正确处理系统底部安全区。
- [ ] 软键盘不会遮挡 Terminal 关键操作和表单当前字段。
- [ ] 图标按钮具有可访问名称。
- [ ] 焦点和系统返回行为符合浮层层级。

### 工程验证

- [ ] `pnpm run tsc` 通过。
- [ ] `pnpm run check:fix` 执行完成，且无本次引入的问题。
- [ ] 在至少一个窄屏手机、一个普通手机和一个平板尺寸下完成视觉检查。
- [ ] 检查是否需要同步更新 `AGENTS.md`；只有新增长期工程约束时才更新。

## 22. Agent 实施提示词

后续可以将以下内容直接交给代码 Agent：

```text
请按照 docs/mobile-ui-design-spec.md 实现 Shell360 移动端 UI。

先阅读根目录 AGENTS.md 和该设计规格，检查当前工作树并保留已有改动。按文档的 Phase 顺序实施，不要修改 Logo，不要添加底部导航，不要在侧边栏以外增加 Workspace 入口，也不要改变 Bridge 或后端业务协议。

优先复用现有组件和状态；只有出现真实重复时才提取通用组件。所有新样式使用语义令牌，确保浅色、深色和跟随系统可用。Hosts 必须同时直接提供 SSH 与 SFTP；Workspace 左上角打开侧边栏，点击标题后通过 Bottom Sheet 切换会话。

完成后运行 AGENTS.md 要求的前端检查，并报告修改文件、交互变化、验证结果和仍需真机确认的事项。
```
