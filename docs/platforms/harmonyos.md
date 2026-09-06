# HarmonyOS 平台说明

HarmonyOS 宿主位于 `harmonyos/`，使用 ArkUI/ArkWeb 承载 `mobile/` 页面，并通过 N-API/FFI 接入 Rust。宿主不承载 SSH、SFTP 或 Data 业务策略。

```bash
pnpm run harmonyos:dev
pnpm run harmonyos:build
```

Release 应加载 HAP 内置 Web 资源；Debug 才可使用开发服务器。静态检查或 HAP 构建成功不等于真机 FFI、SSH 或二进制链路验证完成。

详见 [JSB 架构](../architecture/jsb/architecture.md)、[JSB 协议](../architecture/jsb/protocol.md)和[验证状态](../architecture/jsb/README.md)。
