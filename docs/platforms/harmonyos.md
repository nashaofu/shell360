# HarmonyOS 平台说明

HarmonyOS 宿主位于 `harmonyos/`，使用 ArkUI/ArkWeb 承载 `mobile/` 页面，并通过 N-API/FFI 接入 Rust。宿主不承载 SSH、SFTP 或 Data 业务策略。

```bash
pnpm run harmonyos:dev
pnpm run harmonyos:build
```

Release 应加载 HAP 内置 Web 资源；Debug 才可使用开发服务器。静态检查或 HAP 构建成功不等于真机 FFI、SSH 或二进制链路验证完成。

## CI 发布签名

`pnpm run harmonyos:build` 支持通过独立环境变量临时注入发布签名。CI 需要提供以下 GitHub Secrets：

- `HARMONYOS_SIGNING_P12_B64`、`HARMONYOS_SIGNING_CER_B64`、`HARMONYOS_SIGNING_P7B_B64`：对应文件的 Base64 内容
- `HARMONYOS_SIGNING_STORE_PASSWORD`：`.p12` 密钥库密码
- `HARMONYOS_SIGNING_KEY_PASSWORD`：密钥密码

密钥别名固定为 `upload`，与 Android 签名配置保持一致。

仓库中的 `.github/workflows/release.yaml` 将这些 Base64 secrets 传给 `scripts/harmonyos/signing.ts`。签名模块会在系统临时目录创建权限受限的临时目录，构建期间临时写入 `build-profile.json5` 的 `default` 签名配置，并在构建结束后清理文件、恢复原配置。HAP 产物仍输出到 `build/`。`.csr` 仅用于申请证书，不参与 HAP 构建，也不应上传到 CI。

详见 [JSB 架构](../architecture/jsb/architecture.md)、[JSB 协议](../architecture/jsb/protocol.md)和[验证状态](../architecture/jsb/README.md)。
