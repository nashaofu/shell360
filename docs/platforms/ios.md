# iOS 平台说明

iOS 使用 `ios/` 与 WKWebView 承载 `mobile/` 页面，通过 UniFFI 接入 Rust。Release 包内的 `WebAssets` 通过 `shell360-app://localhost/` 虚拟站点加载，使 `/static/...` 等根路径始终映射到应用资源目录；路径解析会限制在 `WebAssets` 内，并按扩展名返回 MIME 类型。JSB 控制消息保持文本；二进制 Channel 继续通过独立的 `shell360-binary` `WKURLSchemeHandler` 交换原始字节，具体设计见 [iOS JSB 原生二进制传输方案](./ios-jsb-binary-transport.md)。公共边界遵循 [当前架构](../architecture/jsb/architecture.md)。

```bash
pnpm run ios:dev
pnpm run ios:build
pnpm run ios:build-native --platform iphonesimulator --configuration Debug --archs arm64
```

命令需要 macOS、Xcode、Apple SDK 和签名配置。Windows 上只能记录静态检查，不能宣称 iOS 构建或真机验证完成。
