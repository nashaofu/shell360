# iOS 平台说明

iOS 使用 `ios/` 与 WKWebView 承载 `mobile/` 页面，通过 UniFFI 接入 Rust。JSB 控制消息保持文本，二进制 Channel 遵循 [当前架构](../architecture/jsb/architecture.md)。

```bash
pnpm run ios:dev
pnpm run ios:build
pnpm run ios:build-native --platform iphonesimulator --configuration Debug --archs arm64
```

命令需要 macOS、Xcode、Apple SDK 和签名配置。Windows 上只能记录静态检查，不能宣称 iOS 构建或真机验证完成。
