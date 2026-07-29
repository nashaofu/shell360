# P0：Android WebView 宿主与开发环境

## 目标

将现有顶层 `android/` Compose 空壳改造成 Shell360 的唯一 Android 宿主，
负责 WebView 生命周期、开发服务器加载和 Release 静态资源加载。

## 依赖

- 无前置功能依赖。
- Bridge 通信由 [02-bridge-protocol.md](./02-bridge-protocol.md) 补充。

## 范围

- 保留现有 `android/` 的包名、Gradle 工程和 Compose 基础。
- 使用 Compose `AndroidView` 承载单个 WebView。
- Debug 使用 `http://127.0.0.1:1421`。
- Release 使用 `WebViewAssetLoader` 加载 `mobile/dist`。
- 处理安全区域、软键盘、返回键、页面错误和 WebView 调试开关。

不包含：

- Rust 和 FFI 接入。
- 具体 Bridge 命令。
- 文件选择、剪贴板等平台能力。

## 工程调整

建议增加：

```text
android/app/src/main/java/com/nashaofu/shell360/
├── MainActivity.kt
└── webview/
    ├── Shell360WebView.kt
    ├── Shell360WebViewClient.kt
    └── WebViewEnvironment.kt
```

Gradle 为不同构建类型提供：

```text
Debug:
  WEBVIEW_URL=http://127.0.0.1:1421
  WEBVIEW_ORIGIN=http://127.0.0.1:1421

Release:
  WEBVIEW_URL=https://appassets.androidplatform.net/assets/www/index.html
  WEBVIEW_ORIGIN=https://appassets.androidplatform.net
```

## 开发环境

统一通过 ADB 反向代理：

```bash
pnpm run android:dev
```

该命令执行 ADB 反向代理、启动 Rsbuild、安装 Debug APK 并打开 Activity。这样模拟器
和真机都可以使用 `127.0.0.1`。多设备场景先设置
`ANDROID_SERIAL=<serial>` 指定目标设备。

Debug manifest 单独允许明文 HTTP，Release manifest 不允许。开发服务器继续监听
`0.0.0.0:1421`，HMR WebSocket 复用相同端口。

## Release 资源

- 增加 Gradle 任务，在打包前执行 `pnpm --filter mobile run build`。
- 将 `mobile/dist` 同步到生成目录，不建议把构建产物提交到 Git。
- `WebViewAssetLoader` 将生成目录映射到
  `https://appassets.androidplatform.net/assets/www/`。
- SPA 路由必须验证刷新和深链接不会返回 404。

## WebView 安全基线

- 只允许 Debug 和 Release 两个受信来源。
- 禁止 `file://` 访问和跨文件访问。
- Release 禁止 mixed content。
- Release 禁止 WebView 调试。
- 外部 HTTP/HTTPS 导航交给系统浏览器。
- 禁止未受信页面获得 Native Bridge。

## 实施步骤

1. 用 WebView 替换示例 `Greeting` 页面。
2. 完成 Debug URL 加载和 `adb reverse` 脚本。
3. 增加 Release 静态资源同步任务和 AssetLoader。
4. 配置加载失败页面、返回键和软键盘行为。
5. 增加 Debug/Release WebView 配置测试。

## 验收标准

- 模拟器和真机都能加载开发服务器。
- 修改 React 页面后 HMR 正常。
- Release APK 在无网络环境下可启动。
- Release 无法加载明文 HTTP 页面。
- 外部链接不会在受信 WebView 内获得 Bridge 权限。
